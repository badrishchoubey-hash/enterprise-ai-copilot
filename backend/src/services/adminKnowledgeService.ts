import crypto from "node:crypto";
import mongoose, { Types } from "mongoose";
import { GridFSBucket } from "mongodb";
import sanitizeFilename from "sanitize-filename";
import Documents from "../models/Document.js";
import DocumentChunks from "../models/DocumentChunk.js";
import Messages from "../models/Message.js";
import Users from "../models/User.js";
import QueryLogs from "../models/QueryLog.js";
import Feedback from "../models/Feedback.js";
import { AppError } from "../middleware/appError.js";
import {
  getCloudinary,
  getMaxDocumentSizeBytes,
} from "../config/cloudinary.js";
import type { KnowledgeDocument } from "../types/modelTypes/Document.js";
import {
  loadDocumentFile,
  type SupportedDocumentExtension,
} from "./documentLoaderService.js";
import {
  downloadCloudinaryAssetToTemporaryFile,
} from "../utils/tempDocumentFile.js";

const visibilities = ["private", "department", "organization"] as const;
const statuses = [
  "uploaded",
  "processing",
  "completed",
  "failed",
  "archived",
] as const;

const documentMimeTypes: Record<SupportedDocumentExtension, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
};
const documentMimeAliases: Record<string, Set<string>> = {
  pdf: new Set(["application/pdf", "application/octet-stream"]),
  doc: new Set(["application/msword", "application/octet-stream"]),
  docx: new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ]),
  txt: new Set(["text/plain", "application/octet-stream"]),
  md: new Set(["text/markdown", "text/plain", "application/octet-stream"]),
  csv: new Set([
    "text/csv",
    "application/vnd.ms-excel",
    "application/octet-stream",
  ]),
};

export const validateUploadMetadata = (input: {
  filename: string;
  mimeType: string;
  fileSize: number;
  department?: string;
  visibility?: string;
}) => {
  const maxSizeBytes = getMaxDocumentSizeBytes();
  const filename = sanitizeFilename(input.filename);
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (
    !filename ||
    filename.length > 255 ||
    !Object.hasOwn(documentMimeTypes, extension)
  ) {
    throw new AppError(
      415,
      "This file type is not supported.",
      "UNSUPPORTED_FILE_TYPE",
    );
  }
  if (!documentMimeAliases[extension]?.has(input.mimeType)) {
    throw new AppError(
      415,
      "The file type does not match its extension.",
      "INVALID_FILE_TYPE",
    );
  }
  if (
    !Number.isInteger(input.fileSize) ||
    input.fileSize <= 0 ||
    input.fileSize > maxSizeBytes
  ) {
    throw new AppError(
      413,
      `Documents must be no larger than ${Math.floor(maxSizeBytes / (1024 * 1024))} MB.`,
      "FILE_TOO_LARGE",
    );
  }
  const visibility = input.visibility ?? "organization";
  if (!visibilities.includes(visibility as (typeof visibilities)[number])) {
    throw new AppError(
      400,
      "visibility must be private, department, or organization.",
      "INVALID_VISIBILITY",
    );
  }
  if (input.department && input.department.trim().length > 120) {
    throw new AppError(
      400,
      "department must be at most 120 characters.",
      "INVALID_DEPARTMENT",
    );
  }
  if (visibility === "department" && !input.department?.trim()) {
    throw new AppError(
      400,
      "department is required for department visibility.",
      "DEPARTMENT_REQUIRED",
    );
  }
  return {
    filename,
    extension: extension as SupportedDocumentExtension,
    visibility: visibility as DocumentChanges["visibility"],
  };
};

export async function validateDocumentFileContent(
  filePath: string,
  extension: SupportedDocumentExtension,
): Promise<void> {
  const { fileTypeFromFile } = await import("file-type");
  const detected = await fileTypeFromFile(filePath);
  const binarySignatures: Partial<
    Record<SupportedDocumentExtension, Set<string>>
  > = {
    pdf: new Set(["pdf"]),
    doc: new Set(["cfb"]),
    docx: new Set(["docx"]),
  };
  const expected = binarySignatures[extension];
  if (expected ? !detected || !expected.has(detected.ext) : detected !== undefined) {
    throw new AppError(
      415,
      "The file content does not match its extension.",
      "INVALID_FILE_SIGNATURE",
    );
  }
}

const normalizedStatusCounts = (
  rows: Array<{ _id: string; count: number }>,
) => {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key =
      row._id === "uploading"
        ? "uploaded"
        : row._id === "ready" || row._id === "processed"
          ? "completed"
          : row._id;
    counts[key] = (counts[key] ?? 0) + row.count;
  }
  return counts;
};

export interface DocumentChanges {
  name?: string;
  department?: string | null;
  visibility?: "private" | "department" | "organization";
}

const getBucket = (): GridFSBucket => {
  const db = mongoose.connection.db;
  if (!db)
    throw new AppError(
      503,
      "File storage is unavailable.",
      "FILE_STORAGE_UNAVAILABLE",
    );
  return new GridFSBucket(db, { bucketName: "knowledgeFiles" });
};

const fileIdFromDocument = (document: KnowledgeDocument): Types.ObjectId => {
  if (!Types.ObjectId.isValid(document.storageKey)) {
    throw new AppError(
      500,
      "Document file reference is invalid.",
      "INVALID_FILE_REFERENCE",
    );
  }
  return new Types.ObjectId(document.storageKey);
};

export const toAdminDocument = (document: KnowledgeDocument) => {
  const status =
    document.status === "uploading"
      ? "uploaded"
      : document.status === "ready" || document.status === "processed"
        ? "completed"
        : document.status;
  return {
    id: document._id.toString(),
    name: document.name,
    type: document.type,
    status,
    department: document.department,
    visibility: document.visibility,
    uploadedBy: document.uploadedBy.toString(),
    fileSize: document.fileSize,
    mimeType: document.mimeType,
    pageCount: document.pageCount,
    totalChunks: document.totalChunks ?? 0,
    processingProgress: document.status === "processing" ? document.processingProgress : undefined,
    processedAt: document.processedAt,
    errorMessage: document.errorMessage,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validatePage = (page: number, limit: number): void => {
  if (!Number.isInteger(page) || page < 1 || page > 10_000) {
    throw new AppError(
      400,
      "page must be between 1 and 10000.",
      "INVALID_PAGE",
    );
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError(
      400,
      "limit must be between 1 and 100.",
      "INVALID_LIMIT",
    );
  }
};

export async function listAdminDocuments(options: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  department?: string;
  visibility?: string;
}) {
  validatePage(options.page, options.limit);
  const filter: Record<string, unknown> = {};
  if (options.status) {
    if (!statuses.includes(options.status as (typeof statuses)[number])) {
      throw new AppError(400, "status is invalid.", "INVALID_DOCUMENT_STATUS");
    }
    filter.status =
      options.status === "uploaded"
        ? { $in: ["uploaded", "uploading"] }
        : options.status === "completed"
          ? { $in: ["completed", "processed", "ready"] }
          : options.status;
  }
  if (options.department) filter.department = options.department;
  if (options.visibility) {
    if (
      !visibilities.includes(
        options.visibility as (typeof visibilities)[number],
      )
    ) {
      throw new AppError(400, "visibility is invalid.", "INVALID_VISIBILITY");
    }
    filter.visibility = options.visibility;
  }
  if (options.search?.trim()) {
    filter.name = new RegExp(escapeRegex(options.search.trim()), "i");
  }
  const [documents, total] = await Promise.all([
    Documents.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .exec(),
    Documents.countDocuments(filter),
  ]);
  return {
    items: documents.map(toAdminDocument),
    page: options.page,
    limit: options.limit,
    total,
    totalPages: Math.ceil(total / options.limit),
  };
}

export async function uploadAdminDocument(
  input: {
    filename: string;
    mimeType: string;
    fileSize: number;
    department?: string;
    visibility?: string;
    publicId: string;
    version: number;
  },
  actorId: string,
) {
  const metadata = validateUploadMetadata(input);
  if (!Types.ObjectId.isValid(actorId)) {
    throw new AppError(
      401,
      "Authentication required.",
      "AUTHENTICATION_REQUIRED",
    );
  }

  if (
    !input.publicId.startsWith(`nexa/documents/${actorId}/`) ||
    input.publicId.length > 500 ||
    !Number.isInteger(input.version)
  ) {
    throw new AppError(
      400,
      "The uploaded Cloudinary asset is invalid.",
      "INVALID_CLOUDINARY_ASSET",
    );
  }
  const cloudinary = getCloudinary();
  let asset: Record<string, unknown>;
  try {
    asset = await cloudinary.api.resource(input.publicId, {
      resource_type: "raw",
      type: "authenticated",
    });
  } catch {
    throw new AppError(
      400,
      "The uploaded file could not be verified in Cloudinary.",
      "INVALID_CLOUDINARY_ASSET",
    );
  }
  if (
    asset.public_id !== input.publicId ||
    asset.resource_type !== "raw" ||
    asset.type !== "authenticated" ||
    asset.version !== input.version ||
    typeof asset.bytes !== "number" ||
    asset.bytes <= 0 ||
    asset.bytes > getMaxDocumentSizeBytes() ||
    asset.bytes !== input.fileSize ||
    typeof asset.asset_id !== "string"
  ) {
    throw new AppError(
      400,
      "The uploaded file does not match the authorized document upload.",
      "INVALID_CLOUDINARY_ASSET",
    );
  }
  let temporaryFile: Awaited<
    ReturnType<typeof downloadCloudinaryAssetToTemporaryFile>
  > | undefined;
  let preserveCloudinaryAsset = false;
  try {
    temporaryFile = await downloadCloudinaryAssetToTemporaryFile(
      input.publicId,
      metadata.extension,
      getMaxDocumentSizeBytes(),
    );
    if (
      temporaryFile.byteLength !== asset.bytes ||
      temporaryFile.byteLength !== input.fileSize
    ) {
      throw new AppError(
        400,
        "The uploaded file size does not match its verified content.",
        "INVALID_CLOUDINARY_ASSET",
      );
    }
    await validateDocumentFileContent(
      temporaryFile.filePath,
      metadata.extension,
    );
    const fileHash = temporaryFile.sha256;
    const duplicate = await Documents.findOne({
      $or: [
        { contentHash: fileHash },
        { contentHash: { $exists: false }, fileHash },
      ],
    });
    if (duplicate) {
      if (duplicate.storageKey === input.publicId) {
        preserveCloudinaryAsset = true;
        return toAdminDocument(duplicate);
      }
      throw new AppError(
        409,
        "This content already exists in the knowledge base.",
        "DUPLICATE_DOCUMENT",
      );
    }

    // Parse once before creating the record so malformed or empty files are
    // rejected. Processing later repeats this from the durable Cloudinary file.
    await loadDocumentFile(
      temporaryFile.filePath,
      metadata.extension,
      metadata.filename,
    );
    const document = await Documents.create({
      name: metadata.filename,
      type: metadata.extension,
      status: "uploaded",
      fileHash,
      contentHash: fileHash,
      uploadedBy: actorId,
      visibility: metadata.visibility,
      department: input.department?.trim() || undefined,
      storageKey: input.publicId,
      storageProvider: "cloudinary",
      fileSize: asset.bytes,
      mimeType: documentMimeTypes[metadata.extension],
    });
    return toAdminDocument(document);
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      const existingAssetDocument = await Documents.findOne({
        storageKey: input.publicId,
      });
      if (existingAssetDocument) return toAdminDocument(existingAssetDocument);
      await cloudinary.uploader
        .destroy(input.publicId, {
          resource_type: "raw",
          type: "authenticated",
          invalidate: true,
        })
        .catch(() => undefined);
      throw new AppError(
        409,
        "This content already exists in the knowledge base.",
        "DUPLICATE_DOCUMENT",
      );
    }
    if (!preserveCloudinaryAsset) {
      await cloudinary.uploader
        .destroy(input.publicId, {
          resource_type: "raw",
          type: "authenticated",
          invalidate: true,
        })
        .catch(() => undefined);
    }
    throw error;
  } finally {
    await temporaryFile?.cleanup().catch(() => undefined);
  }
}

export function createAdminDocumentUploadSignature(
  input: {
    filename: string;
    mimeType: string;
    fileSize: number;
    department?: string;
    visibility?: string;
  },
  actorId: string,
) {
  const metadata = validateUploadMetadata(input);
  if (!Types.ObjectId.isValid(actorId)) {
    throw new AppError(
      401,
      "Authentication required.",
      "AUTHENTICATION_REQUIRED",
    );
  }
  const cloudinary = getCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `nexa/documents/${actorId}/${crypto.randomUUID()}_${metadata.filename}`;
  const params = {
    timestamp,
    public_id: publicId,
    type: "authenticated",
    overwrite: false,
  };
  const config = cloudinary.config();
  if (!config.api_key || !config.cloud_name || !config.api_secret) {
    throw new AppError(
      503,
      "Cloudinary document storage is unavailable.",
      "CLOUDINARY_UNAVAILABLE",
    );
  }
  return {
    cloudName: config.cloud_name,
    apiKey: config.api_key,
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloud_name}/raw/upload`,
    params,
    signature: cloudinary.utils.api_sign_request(params, config.api_secret),
    filename: metadata.filename,
  };
}

export async function findAdminDocument(documentId: string) {
  if (!Types.ObjectId.isValid(documentId)) {
    throw new AppError(400, "documentId is invalid.", "INVALID_DOCUMENT_ID");
  }
  const document = await Documents.findById(documentId).exec();
  if (!document)
    throw new AppError(404, "Document not found.", "DOCUMENT_NOT_FOUND");
  return document;
}

export async function updateAdminDocument(
  documentId: string,
  changes: DocumentChanges,
) {
  if (!Object.keys(changes).length) {
    throw new AppError(
      400,
      "At least one supported field is required.",
      "EMPTY_UPDATE",
    );
  }
  const document = await findAdminDocument(documentId);
  if (changes.name !== undefined) {
    const name = changes.name.trim();
    if (!name || name.length > 255) {
      throw new AppError(
        400,
        "name must be between 1 and 255 characters.",
        "INVALID_NAME",
      );
    }
    document.name = name;
  }
  if (changes.department !== undefined) {
    const department = changes.department?.trim();
    if (department && department.length > 120) {
      throw new AppError(
        400,
        "department must be at most 120 characters.",
        "INVALID_DEPARTMENT",
      );
    }
    document.department = department || undefined;
  }
  if (changes.visibility !== undefined) {
    if (!visibilities.includes(changes.visibility)) {
      throw new AppError(400, "visibility is invalid.", "INVALID_VISIBILITY");
    }
    if (changes.visibility === "department" && !document.department) {
      throw new AppError(
        400,
        "department is required for department visibility.",
        "DEPARTMENT_REQUIRED",
      );
    }
    document.visibility = changes.visibility;
  }
  await document.save();
  return toAdminDocument(document);
}

export async function deleteAdminDocument(documentId: string) {
  const document = await findAdminDocument(documentId);
  if (document.status === "processing") {
    throw new AppError(
      409,
      "Wait for document processing to finish before deleting it.",
      "DOCUMENT_PROCESSING",
    );
  }
  // Remove external storage first. If that fails, retain the database record
  // so the deletion can be retried without losing the only file reference.
  if (document.storageProvider === "cloudinary") {
    await getCloudinary().uploader.destroy(document.storageKey, {
      resource_type: "raw",
      type: "authenticated",
      invalidate: true,
    });
  } else {
    const fileId = fileIdFromDocument(document);
    const bucket = getBucket();
    const fileExists = await bucket.find({ _id: fileId }).hasNext();
    if (fileExists) await bucket.delete(fileId);
  }
  await Documents.deleteOne({ _id: document._id }).exec();
  await Promise.all([
    DocumentChunks.deleteMany({ documentId: document._id }).exec(),
    Messages.updateMany(
      { "citations.documentId": document._id },
      { $pull: { citations: { documentId: document._id } } },
    ).exec(),
  ]);
  return toAdminDocument(document);
}

export async function documentFile(documentId: string) {
  const document = await findAdminDocument(documentId);
  if (document.storageProvider === "cloudinary") {
    const cloudinary = getCloudinary();
    const url = cloudinary.utils.private_download_url(
      document.storageKey,
      document.type,
      {
        resource_type: "raw",
        type: "authenticated",
        expires_at: Math.floor(Date.now() / 1000) + 60,
        attachment: true,
      },
    );
    return { document, url };
  }
  const fileId = fileIdFromDocument(document);
  const bucket = getBucket();
  const file = await bucket.find({ _id: fileId }).next();
  if (!file)
    throw new AppError(
      404,
      "Document file not found.",
      "DOCUMENT_FILE_NOT_FOUND",
    );
  return {
    document,
    length: file.length,
    stream: bucket.openDownloadStream(fileId),
  };
}

export async function getKnowledgeBaseSummary() {
  const [byStatus, total, bytes, chunks, departments] = await Promise.all([
    Documents.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Documents.countDocuments(),
    Documents.aggregate([
      { $group: { _id: null, bytes: { $sum: "$fileSize" } } },
    ]),
    DocumentChunks.countDocuments(),
    Documents.distinct("department", { department: { $type: "string" } }),
  ]);
  return {
    totalDocuments: total,
    totalFileBytes: bytes[0]?.bytes ?? 0,
    totalChunks: chunks,
    documentsByStatus: normalizedStatusCounts(byStatus),
    departments: departments
      .filter((value): value is string => typeof value === "string")
      .sort(),
    supportedVisibility: [...visibilities],
    processingAvailable: true,
  };
}

export async function getAdminAnalytics(days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new AppError(400, "days must be between 1 and 365.", "INVALID_DAYS");
  }
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [
    totalUsers,
    activeUsers,
    userRoles,
    documentsByStatus,
    totalDocuments,
    totalFileBytes,
    queryMetrics,
    feedbackCounts,
  ] = await Promise.all([
    Users.countDocuments(),
    Users.countDocuments({ isActive: true }),
    Users.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    Documents.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Documents.countDocuments(),
    Documents.aggregate([
      { $group: { _id: null, bytes: { $sum: "$fileSize" } } },
    ]),
    QueryLogs.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          averageLatencyMs: { $avg: "$latencyMs" },
          averageResultCount: { $avg: "$resultCount" },
        },
      },
    ]),
    Feedback.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]),
  ]);
  const queries = queryMetrics[0] ?? {};
  const feedback = Object.fromEntries(
    feedbackCounts.map((item) => [item._id, item.count]),
  );
  return {
    periodDays: days,
    since,
    users: {
      total: totalUsers,
      active: activeUsers,
      byRole: Object.fromEntries(
        userRoles.map((item) => [item._id, item.count]),
      ),
    },
    documents: {
      total: totalDocuments,
      totalFileBytes: totalFileBytes[0]?.bytes ?? 0,
      byStatus: normalizedStatusCounts(documentsByStatus),
    },
    usage: {
      totalQueries: queries.total ?? 0,
      averageLatencyMs: Math.round(queries.averageLatencyMs ?? 0),
      averageResultCount: Number((queries.averageResultCount ?? 0).toFixed(2)),
    },
    feedback: {
      total: (feedback.up ?? 0) + (feedback.down ?? 0),
      positive: feedback.up ?? 0,
      negative: feedback.down ?? 0,
    },
  };
}
