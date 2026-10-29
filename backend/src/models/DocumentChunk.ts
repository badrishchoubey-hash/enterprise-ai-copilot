import { Schema } from "mongoose";
import {
  accessFields,
  objectId,
  optionalText,
  registered,
  requiredText,
} from "./modelHelpers";
import type { DocumentChunkDocument } from "../types/modelTypes/DocumentChunk.js";

const chunkSchema = new Schema<DocumentChunkDocument>(
  {
    ...accessFields,
    documentId: {
      type: objectId(),
      required: true,
      ref: "Documents",
      immutable: true,
    },
    chunkIndex: { type: Number, required: true, min: 0, max: 1_000_000 },
    content: requiredText(100_000),
    tokenCount: { type: Number, min: 1 },
    pageNumber: { type: Number, min: 1 },
    embeddingRef: optionalText(500),
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true, strict: "throw" },
);
chunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
chunkSchema.index({ tenantId: 1, documentId: 1, chunkIndex: 1 });

export const DocumentChunks = registered<DocumentChunkDocument>(
  "DocumentChunks",
  chunkSchema,
  "DocumentChunks",
);
export default DocumentChunks;
