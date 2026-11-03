import mongoose, { Types } from "mongoose";
import Documents from "../models/Document.js";
import DocumentChunks from "../models/DocumentChunk.js";
import Conversations from "../models/Conversation.js";
import Organizations from "../models/Organization.js";
import Users from "../models/User.js";
import { AppError } from "../middleware/appError.js";
import { logInfo } from "../utils/logger.js";

const DEFAULT_ORGANIZATION_ID = "64f000000000000000000001";
let initialization: Promise<void> | undefined;
let initializedOrganizationId: string | undefined;

export function getOrganizationId(): Types.ObjectId {
  const configured = process.env.ORGANIZATION_ID?.trim() || DEFAULT_ORGANIZATION_ID;
  if (!Types.ObjectId.isValid(configured)) {
    throw new AppError(
      500,
      "ORGANIZATION_ID must be a valid MongoDB ObjectId.",
      "ORGANIZATION_CONFIGURATION_ERROR",
    );
  }
  return new Types.ObjectId(configured);
}

export async function ensureOrganizationTenant(): Promise<void> {
  const organizationId = getOrganizationId();
  if (initializedOrganizationId === organizationId.toString()) return;
  if (initialization) return initialization;
  initialization = (async () => {
    try {
      await Organizations.updateOne(
        { _id: organizationId },
        { $setOnInsert: { name: process.env.ORGANIZATION_NAME?.trim() || "Default Workspace", migrationVersion: 0 } },
        { upsert: true },
      ).exec();
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
    }

    const session = await mongoose.startSession();
    let migrated = false;
    try {
      await session.withTransaction(async () => {
        const organization = await Organizations.findById(organizationId)
          .session(session)
          .exec();
        if (!organization) {
          throw new AppError(503, "Workspace initialization failed.", "ORGANIZATION_INITIALIZATION_FAILED");
        }
        if (organization.migrationVersion >= 1) return;

        const duplicateHashes = await Documents.collection
          .aggregate<{ _id: string; documentIds: Types.ObjectId[] }>(
            [
              { $group: { _id: "$fileHash", documentIds: { $push: "$_id" }, count: { $sum: 1 } } },
              { $match: { count: { $gt: 1 } } },
            ],
            { session },
          )
          .toArray();
        for (const duplicate of duplicateHashes) {
          const documentIds = duplicate.documentIds.sort((a, b) =>
            a.toString().localeCompare(b.toString()),
          );
          for (const documentId of documentIds.slice(1)) {
            await Documents.collection.updateOne(
              { _id: documentId },
              {
                $set: {
                  contentHash: duplicate._id,
                  fileHash: `${duplicate._id.slice(0, 64)}-${documentId.toString()}`,
                },
              },
              { session },
            );
          }
        }
        await Documents.collection.updateMany(
          {},
          [{ $set: {
            tenantId: organizationId,
            contentHash: { $ifNull: ["$contentHash", "$fileHash"] },
          } }],
          { session },
        );
        const migration = { $set: { tenantId: organizationId } };
        await Promise.all([
          Users.collection.updateMany({}, migration, { session }),
          DocumentChunks.updateMany({}, migration, { session }).exec(),
          Conversations.updateMany({}, migration, { session }).exec(),
        ]);
        organization.migrationVersion = 1;
        await organization.save({ session });
        migrated = true;
      });
    } finally {
      await session.endSession();
    }
    if (migrated) {
      logInfo("organization.tenant.migration.completed", {
        organizationId: organizationId.toString(),
      });
    }
    initializedOrganizationId = organizationId.toString();
  })();
  try {
    await initialization;
  } finally {
    initialization = undefined;
  }
}
