import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from './appError.js';

export const requestTimeout = (timeoutMs = Number(process.env.API_TIMEOUT_MS) || 30_000): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) next(new AppError(504, 'The request timed out.', 'API_TIMEOUT'));
    }, timeoutMs);
    res.once('finish', () => clearTimeout(timer));
    res.once('close', () => clearTimeout(timer));
    next();
  };
