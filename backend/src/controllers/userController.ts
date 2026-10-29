import type { NextFunction, Request, Response } from "express";
import { getUserProfile } from "../services/userService.js";
import { AppError } from "../middleware/appError.js";

export async function getMyProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      next(
        new AppError(
          401,
          "Authentication required.",
          "AUTHENTICATION_REQUIRED",
        ),
      );
      return;
    }

    const user = await getUserProfile(userId);

    if (!user) {
      next(
        new AppError(
          404,
          "User profile not found.",
          "USER_NOT_FOUND",
        ),
      );
      return;
    }

    res.type('application/json').status(200).json({
      success: true,
      message: "User profile fetched successfully.",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}