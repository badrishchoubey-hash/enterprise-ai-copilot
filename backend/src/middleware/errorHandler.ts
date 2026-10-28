import type { ErrorRequestHandler } from 'express';
import { AppError } from './appError.js';

const isMongoError = (error: unknown): boolean => {
  const value = error as { name?: string; code?: number };
  return Boolean(value?.name?.startsWith('Mongo') || value?.name === 'MongooseError' || value?.code === 11000);
};

const isRedisError = (error: unknown): boolean => {
  const value = error as { name?: string; code?: string; message?: string };
  return Boolean(value?.name?.toLowerCase().includes('redis') || value?.code?.startsWith('ECONN') || value?.message?.toLowerCase().includes('redis'));
};

const isUploadError = (error: unknown): boolean => {
  const value = error as { name?: string; code?: string };
  return value?.name === 'MulterError' || value?.code === 'LIMIT_FILE_SIZE';
};

const isMongooseValidationError = (error: unknown): boolean =>
  (error as { name?: string })?.name === 'ValidationError' ||
  (error as { name?: string })?.name === 'CastError';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) return;
  const requestId = req.requestId;
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred.';
  if (error instanceof AppError) { status = error.statusCode; code = error.code; message = error.message; }
  else if (typeof (error as { statusCode?: unknown })?.statusCode === 'number' &&
    [400, 401, 409].includes((error as { statusCode: number }).statusCode)) {
    // AuthError is owned by the auth service but still carries a safe public
    // status. Handle it without coupling the middleware to that service.
    status = (error as { statusCode: 400 | 401 | 409 }).statusCode;
    code = status === 401 ? 'AUTHENTICATION_FAILED' : status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR';
    message = (error as { message?: string }).message ?? message;
  }
  else if (isMongoError(error)) { status = 503; code = 'DATABASE_UNAVAILABLE'; message = 'The database is temporarily unavailable.'; }
  else if (isRedisError(error)) { status = 503; code = 'CACHE_UNAVAILABLE'; message = 'The cache service is temporarily unavailable.'; }
  else if (isUploadError(error)) { status = 400; code = 'INVALID_UPLOAD'; message = 'The uploaded file could not be processed.'; }
  else if (isMongooseValidationError(error)) { status = 400; code = 'DATA_VALIDATION_ERROR'; message = 'The supplied data is invalid.'; }
  else if ((error as { type?: string })?.type === 'entity.parse.failed') { status = 400; code = 'INVALID_JSON'; message = 'Request body contains invalid JSON.'; }
  // Log only the safe error category and request metadata; never return stack traces.
  const cause = (error as { cause?: { name?: string; code?: string | number } })?.cause;
  console.error(JSON.stringify({ requestId, method: req.method, path: req.path, status, code, errorType: (error as { name?: string })?.name, causeType: cause?.name, causeCode: cause?.code }));
  res.status(status).json({ error: message, code, requestId });
};
