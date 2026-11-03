import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { AppError } from "../middleware/appError.js";
import { validateAskQuestionBody } from "../services/questionAnsweringValidation.js";
import { askKnowledgeBase } from "../services/questionAnsweringService.js";

export async function postAskQuestion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, "Authentication required.", "AUTHENTICATION_REQUIRED");
    }
    const input = validateAskQuestionBody(req.body);
    if (!Types.ObjectId.isValid(req.user.userId)) {
      throw new AppError(401, "Authentication required.", "AUTHENTICATION_REQUIRED");
    }
    const data = await askKnowledgeBase(
      input,
      {
        userId: new Types.ObjectId(req.user.userId),
        role: req.user.role,
        department: req.user.department,
      },
      req.requestId,
      req.requestSignal,
    );
    if (res.writableEnded || req.requestSignal?.aborted) return;
    res.status(200).json({
      success: true,
      message: "Answer generated successfully.",
      data,
    });
  } catch (error) {
    if (res.writableEnded || req.requestSignal?.aborted) return;
    next(error);
  }
}
