import type { Document, Types } from "mongoose";

export interface FeedbackDocument extends Document {
  userId: Types.ObjectId;
  messageId: Types.ObjectId;
  rating: "up" | "down";
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}
