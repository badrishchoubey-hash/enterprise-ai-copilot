import type { Document, Types } from 'mongoose';

export interface MessageDocument extends Document {
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  citations: Array<{
    documentId: Types.ObjectId;
    chunkId?: Types.ObjectId;
    score?: number;
  }>;
  modelName?: string;
  tokenCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
