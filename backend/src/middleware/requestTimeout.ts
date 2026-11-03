import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "./appError.js";
import { getAiRequestTimeoutMs } from "../config/aiTimeouts.js";

export const requestTimeout =
  (timeoutMs?: number): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const isAsk = req.method === "POST" && req.path.replace(/\/$/, "") === "/api/v1/ai/ask";
    const limit = timeoutMs ?? (isAsk ? getAiRequestTimeoutMs() : Number(process.env.API_TIMEOUT_MS) || 30_000);
    const controller = new AbortController();
    req.requestSignal = controller.signal;
    const timer = setTimeout(() => {
      const error = new AppError(504, isAsk ? "The AI request timed out. Try again shortly." : "The request timed out.", isAsk ? "AI_REQUEST_TIMEOUT" : "API_TIMEOUT");
      controller.abort(error);
      if (!res.headersSent) next(error);
    }, limit);
    res.once("finish", () => clearTimeout(timer));
    res.once("close", () => {
      clearTimeout(timer);
      if (!res.writableFinished) controller.abort(new AppError(499, "The request was cancelled.", "REQUEST_CANCELLED"));
    });
    next();
  };
