import { Document, Schema, Types } from 'mongoose';
import { accessFields, objectId, optionalText, registered, requiredText } from './modelHelpers';

export interface KnowledgeDocument extends Document {
  name: string; type: string; department?: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed' | 'archived';
  fileHash: string; uploadedBy: Types.ObjectId; storageKey: string;
  pageCount?: number; errorMessage?: string; tenantId: Types.ObjectId;
  visibility: 'private' | 'department' | 'organization'; createdAt: Date; updatedAt: Date;
}

const documentSchema = new Schema<KnowledgeDocument>({
  ...accessFields, name: requiredText(255), type: { ...requiredText(80), lowercase: true },
  status: { type: String, enum: ['uploading', 'processing', 'ready', 'failed', 'archived'], default: 'uploading' },
  fileHash: { ...requiredText(128), immutable: true }, uploadedBy: { type: objectId(), required: true, ref: 'Users', immutable: true },
  storageKey: { ...requiredText(500), immutable: true }, pageCount: { type: Number, min: 1 }, errorMessage: optionalText(2000),
}, { timestamps: true, strict: 'throw' });
documentSchema.index({ tenantId: 1, fileHash: 1 }, { unique: true });
documentSchema.index({ tenantId: 1, status: 1, createdAt: -1, _id: -1 });
documentSchema.index({ tenantId: 1, department: 1, visibility: 1, createdAt: -1 });

export const Documents = registered<KnowledgeDocument>('Documents', documentSchema, 'Documents');
export default Documents;
