import { Schema } from "mongoose";
import {
  objectId,
  optionalText,
  registered,
  requiredText,
} from "./modelHelpers";
import type { AuditLogDocument } from "../types/modelTypes/AuditLog.js";

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    actorId: { type: objectId(), ref: "Users" },
    action: { ...requiredText(120), lowercase: true },
    resourceType: { ...requiredText(80), lowercase: true },
    resourceId: { type: objectId() },
    requestId: optionalText(128),
    ipAddress: optionalText(64),
    userAgent: optionalText(500),
    changes: { type: Schema.Types.Mixed },
  },
  { timestamps: true, strict: "throw" },
);
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 365 * 7 },
);

export const AuditLogs = registered<AuditLogDocument>(
  "AuditLogs",
  auditLogSchema,
  "AuditLogs",
);
export default AuditLogs;
