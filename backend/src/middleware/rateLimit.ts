import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "./appError.js";

interface Counter {
  count: number;
  resetAt: number;
}

/** In-memory fallback for the current service. Replace the store with Redis when Redis is added. */
export const rateLimit = (
  options: { windowMs?: number; max?: number } = {},
): RequestHandler => {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const max = options.max ?? 100;
  const counters = new Map<string, Counter>();
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, counter] of counters)
      if (counter.resetAt <= now) counters.delete(key);
  }, windowMs);
  interval.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const current = counters.get(key);
    const counter =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + windowMs };
    counter.count += 1;
    counters.set(key, counter);
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - counter.count));
    res.setHeader("RateLimit-Reset", Math.ceil(counter.resetAt / 1000));
    if (counter.count > max) {
      res.setHeader("Retry-After", Math.ceil((counter.resetAt - now) / 1000));
      next(
        new AppError(
          429,
          "Too many requests. Please try again later.",
          "RATE_LIMITED",
        ),
      );
      return;
    }
    next();
  };
};
