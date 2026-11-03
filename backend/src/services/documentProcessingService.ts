import mongoose, { Types } from "mongoose";
import { GridFSBucket } from "mongodb";
import { createEmbeddings, getEmbeddingModelIdentifier } from "../config/embeddings.js";
import { getMaxDocumentSizeBytes } from "../config/cloudinary.js";
import { AppError } from "../middleware/appError.js";
import DocumentChunks from "../models/DocumentChunk.js";
import Documents from "../models/Document.js";
import type { KnowledgeDocument } from "../types/modelTypes/Document.js";
import { downloadCloudinaryAssetToTemporaryFile, streamToTemporaryDocumentFile } from "../utils/tempDocumentFile.js";
import { logError, logInfo } from "../utils/logger.js";
import { toAdminDocument, validateDocumentFileContent } from "./adminKnowledgeService.js";
import { loadDocumentFile } from "./documentLoaderService.js";
import { ingestDocumentsIntoChunks } from "./documentIngestionPipeline.js";

const getBucket = () => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new AppError(503, "File storage is unavailable.", "FILE_STORAGE_UNAVAILABLE");
  }
  return new GridFSBucket(db, { bucketName: "knowledgeFiles" });
};

async function downloadDocumentToTemporaryFile(document: KnowledgeDocument) {
  if (document.storageProvider === "cloudinary") {
    return downloadCloudinaryAssetToTemporaryFile(
      document.storageKey,
      document.type,
      getMaxDocumentSizeBytes(),
    );
  }
  if (!Types.ObjectId.isValid(document.storageKey)) {
    throw new AppError(500, "Document file reference is invalid.", "INVALID_FILE_REFERENCE");
  }
  const fileId = new Types.ObjectId(document.storageKey);
  const bucket = getBucket();
  const file = await bucket.find({ _id: fileId }).next();
  if (!file) throw new AppError(404, "Document file not found.", "DOCUMENT_FILE_NOT_FOUND");
  if (file.length > getMaxDocumentSizeBytes()) {
    throw new AppError(413, "The stored file exceeds the processing size limit.", "FILE_TOO_LARGE");
  }
  return streamToTemporaryDocumentFile(
    bucket.openDownloadStream(fileId),
    document.type,
    getMaxDocumentSizeBytes(),
  );
}

async function processClaimedDocument(document: KnowledgeDocument): Promise<void> {
  const heartbeat = setInterval(() => {
    void Documents.updateOne(
      { _id: document._id, status: "processing" },
      { $set: { processingHeartbeatAt: new Date() } },
    ).exec().catch(() => undefined);
  }, 30_000);
  heartbeat.unref();
  let temporaryFile: Awaited<ReturnType<typeof downloadDocumentToTemporaryFile>> | undefined;
  try {
    temporaryFile = await downloadDocumentToTemporaryFile(document);
    await validateDocumentFileContent(temporaryFile.filePath, document.type as Parameters<typeof validateDocumentFileContent>[1]);
    const loadedDocuments = await loadDocumentFile(
      temporaryFile.filePath,
      document.type as Parameters<typeof loadDocumentFile>[1],
      document.name,
    );
    const embeddings = createEmbeddings();
    const result = await ingestDocumentsIntoChunks(
      loadedDocuments,
      {
        documentId: document._id.toString(),
        tenantId: document.tenantId.toString(),
        embeddingModel: getEmbeddingModelIdentifier(),
        visibility: document.visibility,
        department: document.department,
      },
      embeddings,
      {
        deleteForDocument: async (documentId) => {
          await DocumentChunks.deleteMany({ documentId }).exec();
        },
        insertBatch: async (chunks) => {
          await DocumentChunks.insertMany(chunks, { ordered: true });
        },
      },
    );
    const pageCount = Math.max(
      0,
      ...loadedDocuments
        .map((item) => {
          const value = item.metadata.loc;
          if (typeof value === "object" && value !== null && "pageNumber" in value) {
            const pageNumber = (value as { pageNumber?: unknown }).pageNumber;
            return typeof pageNumber === "number" ? pageNumber : 0;
          }
          return 0;
        }),
    );
    const completed = await Documents.findOneAndUpdate(
      { _id: document._id, status: "processing" },
      {
        $set: {
          status: "completed",
          totalChunks: result.totalChunks,
          processedAt: new Date(),
          ...(pageCount > 0 ? { pageCount } : {}),
        },
        $unset: { errorMessage: 1, processingHeartbeatAt: 1 },
      },
      { new: true },
    ).exec();
    if (!completed) {
      await DocumentChunks.deleteMany({ documentId: document._id }).exec();
    }
    logInfo("document.processing.completed", {
      documentId: document._id.toString(),
      totalChunks: result.totalChunks,
      embeddingDimensions: result.embeddingDimensions,
    });
  } catch (error) {
    await DocumentChunks.deleteMany({ documentId: document._id }).exec().catch(() => undefined);
    const safeMessage = error instanceof AppError
      ? error.message
      : "Document processing failed. Check the file and embedding provider configuration, then retry.";
    await Documents.updateOne(
      { _id: document._id, status: "processing" },
      {
        $set: { status: "failed", errorMessage: safeMessage },
        $unset: { processingHeartbeatAt: 1 },
      },
    ).exec();
    logError("document.processing.failed", {
      documentId: document._id.toString(),
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode: error instanceof AppError ? error.code : "PROCESSING_FAILED",
    });
  } finally {
    clearInterval(heartbeat);
    await temporaryFile?.cleanup().catch(() => undefined);
  }
}

const pendingTasks = new Set<Promise<void>>();

function scheduleClaimedDocument(document: KnowledgeDocument): void {
  const task = processClaimedDocument(document)
    .catch(() => undefined)
    .finally(() => pendingTasks.delete(task));
  pendingTasks.add(task);
}

export async function waitForDocumentProcessing(): Promise<void> {
  await Promise.allSettled([...pendingTasks]);
}

export async function recoverInterruptedDocumentProcessing(): Promise<number> {
  const staleBefore = new Date(Date.now() - 5 * 60_000);
  const result = await Documents.updateMany(
    {
      status: "processing",
      $or: [
        { processingHeartbeatAt: { $lt: staleBefore } },
        {
          processingHeartbeatAt: { $exists: false },
          updatedAt: { $lt: staleBefore },
        },
      ],
    },
    {
      $set: {
        status: "failed",
        errorMessage: "Processing was interrupted. Retry this document.",
      },
      $unset: { processingHeartbeatAt: 1 },
    },
  ).exec();
  return result.modifiedCount;
}

export async function queuePendingUploadedDocuments(): Promise<number> {
  if (process.env.VERCEL === "1") return 0;
  let queued = 0;
  while (true) {
    const pending = await Documents.find({ status: "uploaded" })
      .sort({ createdAt: 1 })
      .select({ _id: 1 })
      .limit(100)
      .lean()
      .exec();
    if (!pending.length) break;
    for (const document of pending) {
      if (await queueUploadedDocument(document._id.toString())) queued += 1;
    }
  }
  return queued;
}

export async function queueUploadedDocument(documentId: string) {
  const document = await Documents.findOneAndUpdate(
    { _id: documentId, status: "uploaded" },
    {
      $set: { status: "processing", processingHeartbeatAt: new Date() },
      $unset: { errorMessage: 1 },
    },
    { new: true },
  ).exec();
  if (!document) return null;
  if (process.env.VERCEL === "1") await processClaimedDocument(document);
  else scheduleClaimedDocument(document);
  return Documents.findById(document._id).then((current) =>
    current ? toAdminDocument(current) : null,
  );
}

export async function retryFailedDocument(documentId: string) {
  if (!Types.ObjectId.isValid(documentId)) {
    throw new AppError(400, "documentId is invalid.", "INVALID_DOCUMENT_ID");
  }
  const document = await Documents.findOneAndUpdate(
    { _id: documentId, status: "failed" },
    {
      $set: { status: "processing", processingHeartbeatAt: new Date() },
      $unset: { errorMessage: 1 },
    },
    { new: true },
  ).exec();
  if (!document) {
    const existing = await Documents.findById(documentId).exec();
    if (!existing) throw new AppError(404, "Document not found.", "DOCUMENT_NOT_FOUND");
    throw new AppError(409, "Only failed documents can be retried.", "DOCUMENT_NOT_RETRYABLE");
  }
  if (process.env.VERCEL === "1") await processClaimedDocument(document);
  else scheduleClaimedDocument(document);
  const current = await Documents.findById(document._id).exec();
  return current ? toAdminDocument(current) : null;
}
