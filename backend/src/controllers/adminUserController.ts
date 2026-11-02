import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../types/auth.types.js";
import { AppError } from "../middleware/appError.js";
import {
  createManagedUser,
  deactivateManagedUser,
  listUsers,
  updateManagedUser,
  type AdminUserChanges,
  type AdminUserInput,
} from "../services/adminUserService.js";
import { recordAdminAudit } from "../utils/adminAudit.js";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const integerParam = (
  value: unknown,
  fallback: number,
  name: string,
): number => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new AppError(
      400,
      `${name} must be an integer.`,
      `INVALID_${name.toUpperCase()}`,
    );
  }
  return parsed;
};

const routeParam = (value: string | string[] | undefined): string =>
  typeof value === "string" ? value : "";

export async function getAdminUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawActive = req.query.isActive;
    let isActive: boolean | undefined;
    if (rawActive !== undefined) {
      if (rawActive !== "true" && rawActive !== "false") {
        throw new AppError(
          400,
          "isActive must be true or false.",
          "INVALID_ACTIVE_STATE",
        );
      }
      isActive = rawActive === "true";
    }
    const data = await listUsers({
      page: integerParam(req.query.page, 1, "page"),
      limit: integerParam(req.query.limit, 25, "limit"),
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      role:
        typeof req.query.role === "string"
          ? (req.query.role as UserRole)
          : undefined,
      isActive,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function postAdminUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!isObject(req.body)) {
      throw new AppError(
        400,
        "Request body must be a JSON object.",
        "INVALID_BODY",
      );
    }
    const body = req.body;
    if (
      typeof body.name !== "string" ||
      typeof body.email !== "string" ||
      typeof body.password !== "string" ||
      (body.role !== undefined && typeof body.role !== "string") ||
      (body.department !== undefined && typeof body.department !== "string")
    ) {
      throw new AppError(
        400,
        "name, email, password, role, and department must be strings.",
        "INVALID_USER_INPUT",
      );
    }
    const input: AdminUserInput = {
      name: body.name,
      email: body.email,
      password: body.password,
      role: typeof body.role === "string" ? (body.role as UserRole) : undefined,
      department:
        typeof body.department === "string" ? body.department : undefined,
    };
    const created = await createManagedUser(input);
    await recordAdminAudit(req, "create", "user", created.id, {
      role: created.role,
      isActive: created.isActive,
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
}

export async function patchAdminUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!isObject(req.body)) {
      throw new AppError(
        400,
        "Request body must be a JSON object.",
        "INVALID_BODY",
      );
    }
    const allowed = new Set([
      "name",
      "email",
      "role",
      "department",
      "isActive",
    ]);
    const unknownFields = Object.keys(req.body).filter(
      (key) => !allowed.has(key),
    );
    if (unknownFields.length) {
      throw new AppError(
        400,
        "Request contains unsupported user fields.",
        "UNSUPPORTED_USER_FIELD",
      );
    }
    const changes: AdminUserChanges = {};
    const body = req.body;
    if (body.name !== undefined) {
      if (typeof body.name !== "string")
        throw new AppError(400, "name must be a string.", "INVALID_NAME");
      changes.name = body.name;
    }
    if (body.email !== undefined) {
      if (typeof body.email !== "string")
        throw new AppError(400, "email must be a string.", "INVALID_EMAIL");
      changes.email = body.email;
    }
    if (body.role !== undefined) {
      if (typeof body.role !== "string")
        throw new AppError(400, "role must be a string.", "INVALID_ROLE");
      changes.role = body.role as UserRole;
    }
    if (body.department !== undefined) {
      if (body.department !== null && typeof body.department !== "string") {
        throw new AppError(
          400,
          "department must be a string or null.",
          "INVALID_DEPARTMENT",
        );
      }
      changes.department = body.department as string | null;
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean")
        throw new AppError(
          400,
          "isActive must be a boolean.",
          "INVALID_ACTIVE_STATE",
        );
      changes.isActive = body.isActive;
    }

    const updated = await updateManagedUser(
      routeParam(req.params.userId),
      req.user?.userId ?? "",
      changes,
    );
    await recordAdminAudit(req, "update", "user", updated.id, {
      fields: Object.keys(changes),
      role: updated.role,
      isActive: updated.isActive,
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteAdminUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await deactivateManagedUser(
      routeParam(req.params.userId),
      req.user?.userId ?? "",
    );
    await recordAdminAudit(req, "deactivate", "user", user.id, {
      isActive: false,
    });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}
