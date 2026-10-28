import { Schema } from 'mongoose';
import { objectId, optionalText, registered } from './modelHelpers';
import type { FeedbackDocument } from '../types/modelTypes/Feedback.js';

const feedbackSchema = new Schema<FeedbackDocument>({
  userId: { type: objectId(), required: true, ref: 'Users', immutable: true },
  messageId: { type: objectId(), required: true, ref: 'Messages', immutable: true },
  rating: { type: String, enum: ['up', 'down'], required: true }, comment: optionalText(4000),
}, { timestamps: true, strict: 'throw' });
feedbackSchema.index({ userId: 1, messageId: 1 }, { unique: true });
feedbackSchema.index({ messageId: 1, createdAt: -1 });

export const Feedback = registered<FeedbackDocument>('Feedback', feedbackSchema, 'Feedback');
export default Feedback;
