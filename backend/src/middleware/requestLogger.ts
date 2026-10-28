import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const requestLogger: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  const startedAt = process.hrtime.bigint();
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    // Deliberately log metadata only: never request bodies, tokens, passwords, or credentials.
    console.info(JSON.stringify({ requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Math.round(durationMs) }));
  });
  next();
};
