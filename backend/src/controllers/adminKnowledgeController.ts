import type { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/appError.js";
import {
  deleteAdminDocument,
  documentFile,
  findAdminDocument,
  getAdminAnalytics,
  createAdminDocumentUploadSignature,
  getKnowledgeBaseSummary,
  listAdminDocuments,
  uploadAdminDocument,
  updateAdminDocument,
  type DocumentChanges,
} from "../services/adminKnowledgeService.js";
import { recordAdminAudit } from "../utils/adminAudit.js";
import {
  queueUploadedDocument,
  reprocessUnindexedDocument,
  retryFailedDocument,
} from "../services/documentProcessingService.js";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const integerParam = (
  value: unknown,
  fallback: number,
  name: string,
): number => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new AppError(
      400,
      `${name} must be an integer.`,
      `INVALID_${name.toUpperCase()}`,
    );
  }
  return parsed;
};

const routeParam = (value: string | string[] | undefined): string =>
  typeof value === "string" ? value : "";

export async function getAdminDocuments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listAdminDocuments({
      page: integerParam(req.query.page, 1, "page"),
      limit: integerParam(req.query.limit, 25, "limit"),
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      status:
        typeof req.query.status === "string" ? req.query.status : undefined,
      department:
        typeof req.query.department === "string"
          ? req.query.department
          : undefined,
      visibility:
        typeof req.query.visibility === "string"
          ? req.query.visibility
          : undefined,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function postAdminDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!isObject(req.body))
      throw new AppError(
        400,
        "Request body must be a JSON object.",
        "INVALID_BODY",
      );
    if (
      req.body.department !== undefined &&
      typeof req.body.department !== "string"
    ) {
      throw new AppError(
        400,
        "department must be a string.",
        "INVALID_DEPARTMENT",
      );
    }
    if (
      req.body.visibility !== undefined &&
      typeof req.body.visibility !== "string"
    ) {
      throw new AppError(
        400,
        "visibility must be a string.",
        "INVALID_VISIBILITY",
      );
    }
    const document = await uploadAdminDocument(
      {
        filename: String(req.body.filename ?? ""),
        mimeType: String(req.body.mimeType ?? ""),
        fileSize: Number(req.body.fileSize),
        department: req.body.department as string | undefined,
        visibility: req.body.visibility as string | undefined,
        publicId: String(req.body.publicId ?? ""),
        version: Number(req.body.version),
      },
      req.user?.userId ?? "",
    );
    const processing = await queueUploadedDocument(document.id);
    const responseDocument = processing ?? document;
    await recordAdminAudit(req, "upload", "document", document.id, {
      name: document.name,
      size: document.fileSize,
      status: responseDocument.status,
    });
    res.status(201).json({ success: true, data: responseDocument });
  } catch (error) {
    next(error);
  }
}

export async function retryAdminDocumentRoute(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const document = await retryFailedDocument(
      routeParam(req.params.documentId),
    );
    if (!document)
      throw new AppError(404, "Document not found.", "DOCUMENT_NOT_FOUND");
    await recordAdminAudit(req, "retry-processing", "document", document.id, {
      status: document.status,
    });
    res.status(202).json({ success: true, data: document });
  } catch (error) {
    next(error);
  }
}

export async function reprocessUnindexedDocumentRoute(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const document = await reprocessUnindexedDocument(
      routeParam(req.params.documentId),
    );
    if (!document)
      throw new AppError(404, "Document not found.", "DOCUMENT_NOT_FOUND");
    await recordAdminAudit(req, "reprocess-unindexed", "document", document.id, {
      status: document.status,
    });
    res.status(202).json({ success: true, data: document });
  } catch (error) {
    next(error);
  }
}

export async function getAdminDocumentUploadSignature(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!isObject(req.body))
      throw new AppError(
        400,
        "Request body must be a JSON object.",
        "INVALID_BODY",
      );
    const data = createAdminDocumentUploadSignature(
      {
        filename: String(req.body.filename ?? ""),
        mimeType: String(req.body.mimeType ?? ""),
        fileSize: Number(req.body.fileSize),
        department:
          typeof req.body.department === "string"
            ? req.body.department
            : undefined,
        visibility:
          typeof req.body.visibility === "string"
            ? req.body.visibility
            : undefined,
      },
      req.user?.userId ?? "",
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getAdminDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const document = await findAdminDocument(routeParam(req.params.documentId));
    res.status(200).json({
      success: true,
      data: {
        id: document._id.toString(),
        name: document.name,
        type: document.type,
        status:
          document.status === "uploading"
            ? "uploaded"
            : document.status === "ready" || document.status === "processed"
              ? "completed"
              : document.status,
        department: document.department,
        visibility: document.visibility,
        uploadedBy: document.uploadedBy.toString(),
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        pageCount: document.pageCount,
        totalChunks: document.totalChunks ?? 0,
        processedAt: document.processedAt,
        errorMessage: document.errorMessage,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function patchAdminDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!isObject(req.body)) {
      throw new AppError(
        400,
        "Request body must be a JSON object.",
        "INVALID_BODY",
      );
    }
    const allowed = new Set(["name", "department", "visibility"]);
    if (Object.keys(req.body).some((key) => !allowed.has(key))) {
      throw new AppError(
        400,
        "Request contains unsupported document fields.",
        "UNSUPPORTED_DOCUMENT_FIELD",
      );
    }
    const changes: DocumentChanges = {};
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== "string")
        throw new AppError(400, "name must be a string.", "INVALID_NAME");
      changes.name = req.body.name;
    }
    if (req.body.department !== undefined) {
      if (
        req.body.department !== null &&
        typeof req.body.department !== "string"
      ) {
        throw new AppError(
          400,
          "department must be a string or null.",
          "INVALID_DEPARTMENT",
        );
      }
      changes.department = req.body.department as string | null;
    }
    if (req.body.visibility !== undefined) {
      if (typeof req.body.visibility !== "string")
        throw new AppError(
          400,
          "visibility must be a string.",
          "INVALID_VISIBILITY",
        );
      changes.visibility = req.body.visibility as DocumentChanges["visibility"];
    }
    const document = await updateAdminDocument(
      routeParam(req.params.documentId),
      changes,
    );
    await recordAdminAudit(req, "update", "document", document.id, {
      fields: Object.keys(changes),
      department: document.department,
      visibility: document.visibility,
    });
    res.status(200).json({ success: true, data: document });
  } catch (error) {
    next(error);
  }
}

export async function deleteAdminDocumentRoute(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const document = await deleteAdminDocument(
      routeParam(req.params.documentId),
    );
    await recordAdminAudit(req, "delete", "document", document.id, {
      name: document.name,
      status: document.status,
    });
    res.status(200).json({ success: true, data: { id: document.id } });
  } catch (error) {
    next(error);
  }
}

export async function getAdminDocumentFile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const file = await documentFile(routeParam(req.params.documentId));
    if ("url" in file) {
      res.status(200).json({ success: true, data: { url: file.url } });
      return;
    }
    const { document, length, stream } = file;
    const fileName = encodeURIComponent(document.name).replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    res.setHeader(
      "Content-Type",
      document.mimeType ?? "application/octet-stream",
    );
    res.setHeader("Content-Length", length);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${fileName}`,
    );
    stream.once("error", (error) => {
      if (res.headersSent) res.destroy(error);
      else next(error);
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function getAdminKnowledgeBase(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res
      .status(200)
      .json({ success: true, data: await getKnowledgeBaseSummary() });
  } catch (error) {
    next(error);
  }
}

export async function getAdminAnalyticsRoute(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getAdminAnalytics(
      integerParam(req.query.days, 30, "days"),
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
