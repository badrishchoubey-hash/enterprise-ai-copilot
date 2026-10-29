import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  body,
  validationResult,
  type ValidationChain,
} from "express-validator";
import { AppError } from "./appError.js";

export type BodyValidator = (body: unknown) => string | undefined;

export const validateBody =
  (validator: BodyValidator): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const error = validator(req.body);
    if (error) {
      next(new AppError(400, error, "VALIDATION_ERROR"));
      return;
    }
    next();
  };

export const validateObjectBody: RequestHandler = (req, _res, next) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    next(
      new AppError(400, "Request body must be a JSON object.", "INVALID_BODY"),
    );
    return;
  }
  next();
};

export const registrationValidation: ValidationChain[] = [
  body("name")
    .isString()
    .trim()
    .isLength({ min: 1, max: 160 })
    .withMessage("name must be between 1 and 160 characters."),
  body("email").isEmail().normalizeEmail().withMessage("email must be valid."),
  body("password")
    .isString()
    .isLength({ min: 8, max: 256 })
    .withMessage("password must be between 8 and 256 characters."),
  body("role")
    .optional()
    .isIn(["employee", "support_agent", "admin"])
    .withMessage("role must be employee, support_agent, or admin."),
  body("department")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage("department is too long."),
];

export const loginValidation: ValidationChain[] = [
  body("email").isEmail().normalizeEmail().withMessage("email must be valid."),
  body("password")
    .isString()
    .isLength({ min: 1, max: 256 })
    .withMessage("password is required."),
];

export const refreshValidation: ValidationChain[] = [
  body("refreshToken")
    .isString()
    .isLength({ min: 20, max: 4096 })
    .withMessage("refreshToken is invalid."),
];

export const handleValidationErrors: RequestHandler = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    next(new AppError(400, "Request validation failed.", "VALIDATION_ERROR"));
    return;
  }
  next();
};
