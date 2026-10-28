import type { NextFunction, Request, Response } from 'express';
import Users from '../models/User.js';
import { verifyAccessToken } from '../services/authService.js';
import { AuthError } from '../services/authService.js';

export async function authenticateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) { res.status(401).json({ error: 'Authentication required.' }); return; }
  try {
    const user = verifyAccessToken(header.slice(7).trim());
    const activeUser = await Users.findOne({ _id: user.userId, isActive: true }).select('_id role department');
    if (!activeUser) { res.status(401).json({ error: 'Authentication required.' }); return; }
    req.user = { userId: activeUser._id.toString(), role: activeUser.role, department: activeUser.department };
    next();
  } catch (error: unknown) {
    if (error instanceof AuthError) { res.status(401).json({ error: error.message, code: 'INVALID_TOKEN' }); return; }
    next(error);
  }
}
