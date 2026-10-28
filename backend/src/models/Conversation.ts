import { Document, Schema, Types } from 'mongoose';
import { objectId, registered, requiredText } from './modelHelpers';

export interface ConversationDocument extends Document {
  userId: Types.ObjectId; title: string; tenantId: Types.ObjectId;
  lastMessageAt?: Date; archivedAt?: Date; createdAt: Date; updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDocument>({
  userId: { type: objectId(), required: true, ref: 'Users', immutable: true }, title: requiredText(300),
  tenantId: { type: objectId(), required: true, ref: 'Users' }, lastMessageAt: Date, archivedAt: Date,
}, { timestamps: true, strict: 'throw' });
conversationSchema.index({ tenantId: 1, userId: 1, updatedAt: -1, _id: -1 });

export const Conversations = registered<ConversationDocument>('Conversations', conversationSchema, 'Conversations');
export default Conversations;
