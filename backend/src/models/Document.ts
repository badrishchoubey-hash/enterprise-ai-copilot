import { Schema } from "mongoose";
import {
  accessFields,
  objectId,
  optionalText,
  registered,
  requiredText,
} from "./modelHelpers";
import type { KnowledgeDocument } from "../types/modelTypes/Document.js";

const documentSchema = new Schema<KnowledgeDocument>(
  {
    ...accessFields,
    name: requiredText(255),
    type: { ...requiredText(80), lowercase: true },
    status: {
      type: String,
      enum: [
        "uploaded",
        "uploading",
        "processing",
        "completed",
        "processed",
        "ready",
        "failed",
        "archived",
      ],
      default: "uploaded",
    },
    fileHash: { ...requiredText(128), immutable: true },
    contentHash: { ...optionalText(128), immutable: true },
    uploadedBy: {
      type: objectId(),
      required: true,
      ref: "Users",
      immutable: true,
    },
    storageKey: { ...requiredText(500), immutable: true },
    storageProvider: {
      type: String,
      enum: ["gridfs", "cloudinary"],
      default: "gridfs",
      immutable: true,
    },
    fileSize: { type: Number, min: 1 },
    mimeType: { ...optionalText(120), immutable: true },
    pageCount: { type: Number, min: 1 },
    totalChunks: { type: Number, min: 0, default: 0 },
    processedAt: { type: Date },
    processingHeartbeatAt: { type: Date },
    processingProgress: {
      type: new Schema({
        completedChunks: { type: Number, min: 0, required: true },
        totalChunks: { type: Number, min: 0, required: true },
        retryAt: { type: Date },
      }, { _id: false }),
      default: undefined,
    },
    errorMessage: optionalText(2000),
  },
  { timestamps: true, strict: "throw" },
);
documentSchema.index({ fileHash: 1 }, { unique: true });
documentSchema.index({ status: 1, createdAt: -1, _id: -1 });
documentSchema.index({
  department: 1,
  visibility: 1,
  createdAt: -1,
});

export const Documents = registered<KnowledgeDocument>(
  "Documents",
  documentSchema,
  "Documents",
);
export default Documents;
