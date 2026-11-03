import { getEmbeddingModelIdentifier, getEmbeddingModelName, getEmbeddingProvider } from "./embeddings.js";
import { AppError } from "../middleware/appError.js";

const boundedInteger = (
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const value = Number(process.env[key]);
  if (!Number.isInteger(value)) return fallback;
  if (value < minimum || value > maximum) {
    throw new AppError(
      500,
      `${key} must be between ${minimum} and ${maximum}.`,
      "VECTOR_SEARCH_CONFIGURATION_ERROR",
    );
  }
  return value;
};

export function getVectorSearchConfig() {
  const topK = boundedInteger("VECTOR_SEARCH_TOP_K", 5, 1, 50);
  const numCandidates = boundedInteger(
    "VECTOR_SEARCH_NUM_CANDIDATES",
    Math.max(100, topK * 10),
    topK,
    10_000,
  );
  const threshold = Number(process.env.VECTOR_SEARCH_MIN_SCORE ?? 0.45);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new AppError(
      500,
      "VECTOR_SEARCH_MIN_SCORE must be between 0 and 1.",
      "VECTOR_SEARCH_CONFIGURATION_ERROR",
    );
  }
  const vectorField = process.env.VECTOR_SEARCH_FIELD?.trim() || "embedding";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(vectorField)) {
    throw new AppError(500, "VECTOR_SEARCH_FIELD is invalid.", "VECTOR_SEARCH_CONFIGURATION_ERROR");
  }
  return {
    indexName: process.env.VECTOR_SEARCH_INDEX_NAME?.trim() || "document_vector_index",
    vectorField,
    topK,
    numCandidates,
    threshold,
    dimensions: getEmbeddingDimensions(),
    embeddingModel: getEmbeddingModelIdentifier(),
  };
}

export function getEmbeddingDimensions(): number {
  const configured = Number(process.env.EMBEDDING_DIMENSIONS);
  if (Number.isInteger(configured) && configured > 0) return configured;
  const model = getEmbeddingModelName().replace(/^models\//, "");
  if (getEmbeddingProvider() === "gemini") {
    if (model === "gemini-embedding-2") return 768;
    if (model === "gemini-embedding-001") return 3072;
  } else {
    if (model === "text-embedding-3-small") return 1536;
    if (model === "text-embedding-3-large") return 3072;
  }
  throw new AppError(
    500,
    "Set EMBEDDING_DIMENSIONS for the configured embedding model.",
    "VECTOR_SEARCH_CONFIGURATION_ERROR",
  );
}
