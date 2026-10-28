// src/types/auth.ts
export type UserRole = 'employee' | 'support_agent' | 'admin';

export interface JwtPayload {
  userId: string;
  role: UserRole;
  department?: string;
}

// Extend Express Request interface to include logged-in user details
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      requestId?: string;
    }
  }
}
