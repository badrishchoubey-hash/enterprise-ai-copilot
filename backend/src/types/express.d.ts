import type { AuthenticatedUserContext } from "./auth.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserContext;
      requestId?: string;
      requestSignal?: AbortSignal;
    }
  }
}

export {};
