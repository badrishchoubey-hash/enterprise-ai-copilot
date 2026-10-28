import type { Document, Types } from 'mongoose';

export interface QueryLogDocument extends Document {
  userId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  query: string;
  latencyMs: number;
  resultCount: number;
  retrievalMode: 'keyword' | 'vector' | 'hybrid';
  modelName?: string;
  requestId: string;
  createdAt: Date;
  updatedAt: Date;
}
