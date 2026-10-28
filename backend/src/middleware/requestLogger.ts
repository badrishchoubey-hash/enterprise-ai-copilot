import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { logError, logInfo } from '../utils/logger.js';

export const requestLogger: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  const startedAt = process.hrtime.bigint();
  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  res.json = ((body: unknown) => { responseBody = body; return originalJson(body); }) as Response['json'];
  res.send = ((body?: unknown) => { responseBody = body; return originalSend(body); }) as Response['send'];
  logInfo('api.request', { requestId, method: req.method, path: req.path, payload: req.body });
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logInfo('api.response', { requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Math.round(durationMs), response: responseBody });
  });
  res.once('close', () => {
    if (!res.writableFinished) logError('api.connection_closed', { requestId, method: req.method, path: req.path });
  });
  next();
};
