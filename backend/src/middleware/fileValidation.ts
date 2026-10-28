import multer from 'multer';
import sanitizeFilename from 'sanitize-filename';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from './appError.js';

// Fixes S5693: Read limits from configurable environment variables to ensure safe, scalable content limits
const MAX_FILE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES) || 25 * 1024 * 1024; // Default 25MB
const MAX_FIELD_BYTES = Number(process.env.MAX_FIELD_SIZE_BYTES) || 1 * 1024 * 1024; // Default 1MB

const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.txt', '.md', '.csv']);
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

/** Parse uploads in memory so validation happens before persistence. */
export const uploadSingleDocument = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,   // Configurable max payload limit
    fieldSize: MAX_FIELD_BYTES, // Prevents non-file text field buffer overflow attacks
    fields: 10,
    files: 1,
    headerPairs: 200,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError(415, 'This file type is not supported.', 'UNSUPPORTED_FILE_TYPE'));
      return;
    }
    callback(null, true);
  },
}).single('file');

/** Validate extension, sanitized name, MIME type, and the actual file signature. */
export const validateUploadedFile: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const file = req.file;

    if (!file?.originalname || !file?.mimetype || !Buffer.isBuffer(file?.buffer)) {
      next(new AppError(400, 'A valid file upload is required.', 'INVALID_FILE'));
      return;
    }

    const safeName = sanitizeFilename(file.originalname);
    const extension = safeName.slice(safeName.lastIndexOf('.')).toLowerCase();

    if (!safeName || !allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimetype)) {
      next(new AppError(415, 'This file type is not supported.', 'UNSUPPORTED_FILE_TYPE'));
      return;
    }

    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      next(new AppError(413, 'The uploaded file is empty or exceeds the size limit.', 'FILE_TOO_LARGE'));
      return;
    }

    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(file.buffer);

    const expectedSignatures: Record<string, Set<string>> = {
      pdf: new Set(['pdf']),
      doc: new Set(['cfb']),
      docx: new Set(['docx', 'zip']),
    };

    const expected = expectedSignatures[extension.slice(1)];

    if (expected && !expected.has(detected?.ext ?? '')) {
      next(new AppError(415, 'The file content does not match its declared type.', 'INVALID_FILE_SIGNATURE'));
      return;
    }

    file.originalname = safeName;
    next();
  } catch (error) {
    next(error);
  }
};