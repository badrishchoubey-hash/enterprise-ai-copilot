import { Types, type PipelineStage } from "mongoose";
import DocumentChunks from "../models/DocumentChunk.js";
import { AppError } from "../middleware/appError.js";
import { logError } from "../utils/logger.js";
import {
  createEmbeddings,
  getLegacyEmbeddingModelIdentifier,
} from "../config/embeddings.js";
import { getVectorSearchConfig } from "../config/vectorSearch.js";
import { requireQueryableVectorIndex } from "./vectorIndexService.js";
import { getQueryEmbeddingTimeoutMs } from "../config/aiTimeouts.js";
import { withAiDeadline } from "./aiDeadlineService.js";

export interface RetrievalAccessContext {
  role: "employee" | "support_agent" | "admin";
  department?: string;
}

export interface RetrievedChunk {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  metadata?: Record<string, unknown>;
  score: number;
  document: {
    _id: Types.ObjectId;
    name: string;
    type: string;
    status: string;
    visibility: "private" | "department" | "organization";
    department?: string;
  };
}

export interface VectorRetrievalDependencies {
  embedQuery(question: string, format?: "current" | "legacy-raw", signal?: AbortSignal): Promise<number[]>;
  getStoredModels(): Promise<string[]>;
  search(pipeline: PipelineStage[]): Promise<RetrievedChunk[]>;
}

const accessRule = (
  prefix: "" | "document.",
  access: RetrievalAccessContext,
): Record<string, unknown> => {
  if (access.role === "admin") return {};
  const allowedVisibility = access.department
    ? {
        $or: [
          { [`${prefix}visibility`]: "organization" },
          {
            [`${prefix}visibility`]: "department",
            [`${prefix}department`]: access.department,
          },
        ],
      }
    : { [`${prefix}visibility`]: "organization" };
  return allowedVisibility;
};

export function buildVectorRetrievalPipeline(
  queryVector: number[],
  access: RetrievalAccessContext,
  embeddingModel?: string,
): PipelineStage[] {
  const config = getVectorSearchConfig();
  if (
    queryVector.length !== config.dimensions ||
    queryVector.some((value) => !Number.isFinite(value))
  ) {
    throw new AppError(
      502,
      "The query embedding does not match the configured vector index.",
      "EMBEDDING_DIMENSION_MISMATCH",
    );
  }
  return [
    {
      $vectorSearch: {
        index: config.indexName,
        path: config.vectorField,
        queryVector,
        numCandidates: config.numCandidates,
        limit: Math.min(config.numCandidates, Math.max(config.topK * 3, config.topK)),
        filter: {
          $and: [
            ...(access.role === "admin" ? [] : [accessRule("", access)]),
            { embeddingModel: embeddingModel ?? config.embeddingModel },
          ],
        },
      },
    } as unknown as PipelineStage,
    { $set: { score: { $meta: "vectorSearchScore" } } },
    {
      $lookup: {
        from: "Documents",
        localField: "documentId",
        foreignField: "_id",
        as: "document",
      },
    },
    { $unwind: "$document" },
    {
      $match: {
        $and: [
          accessRule("document.", access),
          { "document.status": { $in: ["completed", "processed", "ready"] } },
          { score: { $gte: config.threshold } },
        ],
      },
    },
    { $sort: { score: -1, documentId: 1, chunkIndex: 1 } },
    { $limit: config.topK },
    {
      $project: {
        _id: 1,
        documentId: 1,
        chunkIndex: 1,
        content: 1,
        pageNumber: 1,
        metadata: 1,
        score: 1,
        document: {
          _id: "$document._id",
          name: "$document.name",
          type: "$document.type",
          status: "$document.status",
          visibility: "$document.visibility",
          department: "$document.department",
        },
      },
    },
  ];
}

export async function retrieveRelevantChunks(
  question: string,
  access: RetrievalAccessContext,
  dependencies?: VectorRetrievalDependencies,
  requestSignal?: AbortSignal,
): Promise<RetrievedChunk[]> {
  requestSignal?.throwIfAborted();
  const config = getVectorSearchConfig();
  let storedModels: string[];
  try {
    storedModels = dependencies
      ? await dependencies.getStoredModels()
      : await DocumentChunks.distinct("embeddingModel", {
          embedding: { $exists: true },
        }).exec();
  } catch (error) {
    throw new AppError(
      503,
      "Knowledge search is unavailable.",
      "VECTOR_SEARCH_UNAVAILABLE",
      { cause: error },
    );
  }
  if (storedModels.some((model) => model !== config.embeddingModel)) {
    const legacyModel = getLegacyEmbeddingModelIdentifier();
    if (
      legacyModel &&
      storedModels.every(
        (model) => model === config.embeddingModel || model === legacyModel,
      )
    ) {
      // Existing model-2 vectors created before task-prefix support remain
      // queryable with matching raw query embeddings; they are never rebuilt.
    } else {
      throw new AppError(
        409,
        "Stored document vectors use a different embedding model. Configure the matching embedding model before asking questions.",
        "EMBEDDING_MODEL_MISMATCH",
      );
    }
  }
  if (!storedModels.length) return [];
  if (!dependencies) {
    try {
      await requireQueryableVectorIndex();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, "Knowledge search index status could not be checked.", "VECTOR_SEARCH_UNAVAILABLE", { cause: error });
    }
  }
  const compatibleModels = [
    ...(storedModels.includes(config.embeddingModel) ? [config.embeddingModel] : []),
    ...(getLegacyEmbeddingModelIdentifier() &&
      storedModels.includes(getLegacyEmbeddingModelIdentifier()!)
      ? [getLegacyEmbeddingModelIdentifier()!]
      : []),
  ];
  const results: RetrievedChunk[] = [];
  for (const modelIdentifier of compatibleModels) {
    const format = modelIdentifier === getLegacyEmbeddingModelIdentifier()
      ? "legacy-raw"
      : "current";
    let vector: number[];
    try {
      vector = await withAiDeadline(
        (signal) => dependencies
          ? dependencies.embedQuery(question, format, signal)
          : createEmbeddings("RETRIEVAL_QUERY", format, undefined, signal).embedQuery(question),
        getQueryEmbeddingTimeoutMs(),
        new AppError(504, "The question embedding service timed out. Try again shortly.", "EMBEDDING_QUERY_TIMEOUT"),
        requestSignal,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      const status = (error as { status?: number; statusCode?: number })?.status ??
        (error as { statusCode?: number })?.statusCode;
      const errorCode = String((error as { code?: string | number })?.code ?? "");
      const isRateLimited = status === 429 ||
        /RESOURCE_EXHAUSTED|RATE_LIMIT/i.test(`${errorCode} ${String(status ?? "")}`);
      const code = isRateLimited ? "EMBEDDING_RATE_LIMITED" : "EMBEDDING_PROVIDER_FAILED";
      logError("ai.embedding.query.failed", {
        errorType: (error as { name?: string })?.name,
        errorCode: (error as { code?: string })?.code,
      });
      throw new AppError(
        isRateLimited ? 429 : 503,
        isRateLimited
          ? "The question embedding provider is rate limited. Try again shortly."
          : "The question could not be embedded right now.",
        code,
        { cause: error },
      );
    }
    const pipeline = buildVectorRetrievalPipeline(vector, access, modelIdentifier);
    requestSignal?.throwIfAborted();
    try {
      const matches = dependencies
        ? await dependencies.search(pipeline)
        : await DocumentChunks.aggregate<RetrievedChunk>(pipeline).exec();
      results.push(...matches);
    } catch (error) {
      logError("ai.vector_search.failed", {
        indexName: config.indexName,
        errorType: (error as { name?: string })?.name,
        errorCode: (error as { code?: string | number })?.code,
      });
      throw new AppError(
        503,
        "Knowledge search is unavailable. Check the Atlas Vector Search index configuration.",
        "VECTOR_SEARCH_UNAVAILABLE",
        { cause: error },
      );
    }
  }
  const unique = new Map(results.map((item) => [item._id.toString(), item]));
  return [...unique.values()]
    .sort((left, right) => right.score - left.score ||
      left.documentId.toString().localeCompare(right.documentId.toString()) ||
      left.chunkIndex - right.chunkIndex)
    .slice(0, config.topK);
}
