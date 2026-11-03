import type { Document } from "@langchain/core/documents";
import { AppError } from "../middleware/appError.js";
import type {
  ChunkWriter,
  EmbeddingClient,
  IngestionChunkRecord,
} from "../types/ingestion.types.js";
import { createDocumentSplitter } from "../config/documentChunking.js";

export interface IngestionContext {
  documentId: string;
  embeddingModel: string;
  visibility: "private" | "department" | "organization";
  department?: string;
  onProgress?: (completedChunks: number, totalChunks: number) => Promise<void>;
}

const embeddingBatchSize = (): number => {
  const value = Number(process.env.EMBEDDING_BATCH_SIZE);
  return Number.isInteger(value) && value > 0 ? Math.min(value, 128) : 64;
};

const pageNumberFromMetadata = (
  metadata: Record<string, unknown>,
): number | undefined => {
  const direct = metadata.pageNumber;
  if (typeof direct === "number" && Number.isInteger(direct) && direct > 0) {
    return direct;
  }
  const loc = metadata.loc;
  if (typeof loc === "object" && loc !== null && "pageNumber" in loc) {
    const value = (loc as { pageNumber?: unknown }).pageNumber;
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return value;
    }
  }
  return undefined;
};

function validateVectors(vectors: number[][], expectedCount: number): number {
  if (vectors.length !== expectedCount || vectors.length === 0) {
    throw new AppError(
      502,
      "The embedding provider returned an incomplete response.",
      "INVALID_EMBEDDING_RESPONSE",
    );
  }
  const dimensions = vectors[0]?.length ?? 0;
  if (
    dimensions === 0 ||
    vectors.some(
      (vector) =>
        vector.length !== dimensions ||
        vector.some((value) => !Number.isFinite(value)),
    )
  ) {
    throw new AppError(
      502,
      "The embedding provider returned invalid vectors.",
      "INVALID_EMBEDDING_RESPONSE",
    );
  }
  return dimensions;
}

export async function ingestDocumentsIntoChunks(
  documents: Document<Record<string, unknown>>[],
  context: IngestionContext,
  embeddings: EmbeddingClient,
  writer: ChunkWriter,
): Promise<{ totalChunks: number; embeddingDimensions: number }> {
  const splitter = createDocumentSplitter();
  const splitDocuments = (await splitter.splitDocuments(documents)).filter(
    (document) => document.pageContent.trim().length > 0,
  );
  if (!splitDocuments.length) {
    throw new AppError(
      422,
      "No meaningful text was found to index.",
      "EMPTY_DOCUMENT",
    );
  }

  await writer.deleteForDocument(context.documentId);
  let dimensions = 0;
  try {
    await context.onProgress?.(0, splitDocuments.length);
    const batchSize = embeddingBatchSize();
    for (let start = 0; start < splitDocuments.length; start += batchSize) {
      const batch = splitDocuments.slice(start, start + batchSize);
      const vectors = await embeddings.embedDocuments(
        batch.map((document) => document.pageContent),
      );
      const batchDimensions = validateVectors(vectors, batch.length);
      if (dimensions && dimensions !== batchDimensions) {
        throw new AppError(
          502,
          "The embedding provider returned inconsistent vector dimensions.",
          "INVALID_EMBEDDING_RESPONSE",
        );
      }
      dimensions = batchDimensions;

      const records: IngestionChunkRecord[] = batch.map((document, index) => {
        const chunkIndex = start + index;
        return {
          documentId: context.documentId,
          chunkIndex,
          content: document.pageContent,
          embedding: vectors[index] as number[],
          embeddingModel: context.embeddingModel,
          tokenCount: Math.max(1, Math.ceil(document.pageContent.length / 4)),
          pageNumber: pageNumberFromMetadata(document.metadata),
          department: context.department,
          visibility: context.visibility,
          metadata: document.metadata,
        };
      });
      await writer.insertBatch(records);
      await context.onProgress?.(start + batch.length, splitDocuments.length);
    }
  } catch (error) {
    await writer.deleteForDocument(context.documentId).catch(() => undefined);
    throw error;
  }

  return { totalChunks: splitDocuments.length, embeddingDimensions: dimensions };
}
