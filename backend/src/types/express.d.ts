import type { JwtPayload } from "./auth.types.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: JwtPayload;
    requestId?: string;
  }
}
