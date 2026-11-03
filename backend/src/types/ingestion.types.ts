export interface IngestionChunkRecord {
  tenantId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  embeddingModel: string;
  tokenCount: number;
  pageNumber?: number;
  department?: string;
  visibility: "private" | "department" | "organization";
  metadata: Record<string, unknown>;
}

export interface ChunkWriter {
  deleteForDocument(documentId: string): Promise<void>;
  insertBatch(chunks: IngestionChunkRecord[]): Promise<void>;
}

export interface EmbeddingClient {
  embedDocuments(texts: string[]): Promise<number[][]>;
}
