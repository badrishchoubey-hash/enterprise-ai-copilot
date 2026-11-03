import { AppError } from "../middleware/appError.js";
import { getVectorSearchConfig } from "../config/vectorSearch.js";
import DocumentChunks from "../models/DocumentChunk.js";

export function buildVectorIndexDefinition() {
  const config = getVectorSearchConfig();
  return {
    fields: [
      { type: "vector", path: config.vectorField, numDimensions: config.dimensions, similarity: "cosine" },
      { type: "filter", path: "visibility" },
      { type: "filter", path: "department" },
      { type: "filter", path: "embeddingModel" },
    ],
  };
}

export async function requireQueryableVectorIndex(
  listIndexes: () => Promise<Array<{ name: string; type?: string; queryable?: boolean }>> =
    () => DocumentChunks.collection.listSearchIndexes(getVectorSearchConfig().indexName).toArray(),
): Promise<void> {
  const indexes = await listIndexes();
  const config = getVectorSearchConfig();
  const index = indexes.find((item) => item.name === config.indexName);
  if (!index || index.type !== "vectorSearch" || !index.queryable) {
    throw new AppError(503,
      "Knowledge search is not ready. The vector search index is missing or still building. Run the vector index setup and wait until it is queryable.",
      "VECTOR_INDEX_NOT_READY");
  }
}
