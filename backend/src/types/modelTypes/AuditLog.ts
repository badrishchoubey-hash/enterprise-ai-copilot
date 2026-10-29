import type { Document, Types } from "mongoose";

export interface AuditLogDocument extends Document {
  actorId?: Types.ObjectId;
  action: string;
  resourceType: string;
  resourceId?: Types.ObjectId;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
