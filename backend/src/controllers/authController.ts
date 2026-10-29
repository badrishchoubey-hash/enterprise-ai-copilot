import type { NextFunction, Request, Response } from "express";
import {
  loginUser,
  refreshAccessToken,
  registerUser,
  revokeRefreshToken,
} from "../services/authService.js";
import type { UserRole } from "../types/auth.types.js";

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";
const isUserRole = (value: unknown): value is UserRole =>
  value === "employee" || value === "support_agent" || value === "admin";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body: unknown = req.body;

    if (!isJsonObject(body)) {
      res.status(400).json({ error: "Request body must be a JSON object." });
      return;
    }

    const { name, email, password, role, department } = body;

    if (!isString(name) || !isString(email) || !isString(password)) {
      res.status(400).json({
        error: "name, email, and password are required.",
      });
      return;
    }

    const result = await registerUser({
      name,
      email,
      password,
      role: isUserRole(role) ? role : undefined,
      department: isString(department) ? department : undefined,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body: unknown = req.body;

    if (!isJsonObject(body)) {
      res.status(400).json({ error: "Request body must be a JSON object." });
      return;
    }

    const { email, password } = body;

    if (!isString(email) || !isString(password)) {
      res.status(400).json({
        error: "email and password are required.",
      });
      return;
    }

    const result = await loginUser(email, password);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body: unknown = req.body;
    const token: unknown = isJsonObject(body) ? body.refreshToken : undefined;

    if (!isString(token) || !token.trim()) {
      res.status(400).json({
        error: "refreshToken is required.",
      });
      return;
    }

    const result = await refreshAccessToken(token);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body: unknown = req.body;
    const token: unknown = isJsonObject(body) ? body.refreshToken : undefined;

    if (isString(token) && token.trim()) {
      await revokeRefreshToken(token);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
