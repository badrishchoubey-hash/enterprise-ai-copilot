import type { Document, Types } from 'mongoose';

export interface KnowledgeDocument extends Document {
  name: string;
  type: string;
  department?: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed' | 'archived';
  fileHash: string;
  uploadedBy: Types.ObjectId;
  storageKey: string;
  pageCount?: number;
  errorMessage?: string;
  tenantId: Types.ObjectId;
  visibility: 'private' | 'department' | 'organization';
  createdAt: Date;
  updatedAt: Date;
}
