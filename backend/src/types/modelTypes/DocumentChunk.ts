import type { Document, Types } from "mongoose";

export interface DocumentChunkDocument extends Document {
  documentId: Types.ObjectId;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
  pageNumber?: number;
  embeddingRef?: string;
  metadata?: Record<string, unknown>;
  tenantId: Types.ObjectId;
  department?: string;
  visibility: "private" | "department" | "organization";
  createdAt: Date;
  updatedAt: Date;
}
