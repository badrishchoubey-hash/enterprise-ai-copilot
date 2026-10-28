import { Document, Schema, Types } from 'mongoose';
import { objectId, optionalText, registered, requiredText } from './modelHelpers';

export interface QueryLogDocument extends Document {
  userId: Types.ObjectId; conversationId?: Types.ObjectId; query: string;
  latencyMs: number; resultCount: number; retrievalMode: 'keyword' | 'vector' | 'hybrid';
  modelName?: string; requestId: string; createdAt: Date; updatedAt: Date;
}

const queryLogSchema = new Schema<QueryLogDocument>({
  userId: { type: objectId(), required: true, ref: 'Users' }, conversationId: { type: objectId(), ref: 'Conversations' }, query: requiredText(20_000),
  latencyMs: { type: Number, required: true, min: 0 }, resultCount: { type: Number, required: true, min: 0 },
  retrievalMode: { type: String, enum: ['keyword', 'vector', 'hybrid'], required: true }, modelName: optionalText(120),
  requestId: { ...requiredText(128), immutable: true },
}, { timestamps: true, strict: 'throw' });
queryLogSchema.index({ requestId: 1 }, { unique: true });
queryLogSchema.index({ userId: 1, createdAt: -1, _id: -1 });
queryLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export const QueryLogs = registered<QueryLogDocument>('QueryLogs', queryLogSchema, 'QueryLogs');
export default QueryLogs;
