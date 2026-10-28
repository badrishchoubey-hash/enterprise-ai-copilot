import type { Document, Types } from 'mongoose';

export interface ConversationDocument extends Document {
  userId: Types.ObjectId;
  title: string;
  tenantId: Types.ObjectId;
  lastMessageAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
