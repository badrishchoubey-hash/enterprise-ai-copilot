import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../types/auth.js';
import { AppError } from './appError.js';

export const authorizeRole = (...allowedRoles: UserRole[]) => (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) { next(new AppError(401, 'Authentication required.', 'AUTHENTICATION_REQUIRED')); return; }
  if (!allowedRoles.includes(req.user.role)) { next(new AppError(403, 'Insufficient permissions.', 'FORBIDDEN')); return; }
  next();
};
