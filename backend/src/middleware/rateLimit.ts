import type { NextFunction, Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { AppError } from "./appError.js";

/** Shared MongoDB-backed fixed-window limiter, safe across app instances. */
export const rateLimit = (
  options: { windowMs?: number; max?: number } = {},
): RequestHandler => {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const max = options.max ?? 100;
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const collection = mongoose.connection.db?.collection(
        "rateLimitCounters",
      ) as
        | import("mongodb").Collection<{
            _id: string;
            count: number;
            resetAt: Date;
          }>
        | undefined;
      if (!collection) throw new Error("Rate limit storage is unavailable.");
      const key = `${windowMs}:${max}:${req.ip || "unknown"}`;
      const now = Date.now();
      await collection.updateOne(
        { _id: key },
        [
          {
            $set: {
              count: {
                $cond: [
                  { $gt: ["$resetAt", new Date(now)] },
                  { $add: [{ $ifNull: ["$count", 0] }, 1] },
                  1,
                ],
              },
              resetAt: {
                $cond: [
                  { $gt: ["$resetAt", new Date(now)] },
                  "$resetAt",
                  new Date(now + windowMs),
                ],
              },
            },
          },
        ],
        { upsert: true },
      );
      const counter = await collection.findOne({ _id: key });
      const count = Number(counter?.count ?? 1);
      const resetAt = new Date(counter?.resetAt ?? now + windowMs).getTime();
      res.setHeader("RateLimit-Limit", max);
      res.setHeader("RateLimit-Remaining", Math.max(0, max - count));
      res.setHeader("RateLimit-Reset", Math.ceil(resetAt / 1000));
      if (count > max) {
        res.setHeader("Retry-After", Math.ceil((resetAt - now) / 1000));
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
    })().catch(next);
  };
};
