import { Document, Schema, Types } from 'mongoose';
import { objectId, optionalText, registered, requiredText } from './modelHelpers';

export interface MessageDocument extends Document {
  conversationId: Types.ObjectId; userId: Types.ObjectId;
  role: 'user' | 'assistant' | 'system' | 'tool'; content: string;
  citations: Array<{ documentId: Types.ObjectId; chunkId?: Types.ObjectId; score?: number }>;
  modelName?: string; tokenCount?: number; createdAt: Date; updatedAt: Date;
}

const messageSchema = new Schema<MessageDocument>({
  conversationId: { type: objectId(), required: true, ref: 'Conversations', immutable: true },
  userId: { type: objectId(), required: true, ref: 'Users', immutable: true },
  role: { type: String, enum: ['user', 'assistant', 'system', 'tool'], required: true }, content: requiredText(200_000),
  citations: [{ documentId: { type: objectId(), ref: 'Documents', required: true }, chunkId: { type: objectId(), ref: 'DocumentChunks' }, score: { type: Number, min: 0, max: 1 } }],
  modelName: optionalText(120), tokenCount: { type: Number, min: 0 },
}, { timestamps: true, strict: 'throw' });
messageSchema.index({ conversationId: 1, createdAt: 1, _id: 1 });
messageSchema.index({ userId: 1, createdAt: -1 });

export const Messages = registered<MessageDocument>('Messages', messageSchema, 'Messages');
export default Messages;
