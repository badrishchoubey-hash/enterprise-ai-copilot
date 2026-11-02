import type { Request } from "express";
import AuditLogs from "../models/AuditLog.js";
import { logError } from "./logger.js";

export async function recordAdminAudit(
  req: Request,
  action: string,
  resourceType: string,
  resourceId?: string,
  changes?: Record<string, unknown>,
): Promise<void> {
  try {
    await AuditLogs.create({
      actorId: req.user?.userId,
      action,
      resourceType,
      resourceId,
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      changes,
    });
  } catch (error) {
    logError("admin.audit.failed", {
      requestId: req.requestId,
      action,
      resourceType,
      errorType: (error as { name?: string })?.name,
    });
  }
}
