import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import Users from "../models/User.js";
import type { UserDocument } from "../types/modelTypes/User.js";
import type { UserRole } from "../types/auth.types.js";
import { AppError } from "../middleware/appError.js";
import { getOrganizationId } from "./organizationTenantService.js";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
const roles: UserRole[] = ["employee", "support_agent", "admin"];

export interface AdminUserInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  department?: string;
}

export interface AdminUserChanges {
  name?: string;
  email?: string;
  role?: UserRole;
  department?: string | null;
  isActive?: boolean;
}

export const toAdminUser = (user: UserDocument) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validatePage = (page: number, limit: number): void => {
  if (!Number.isInteger(page) || page < 1 || page > 10_000) {
    throw new AppError(
      400,
      "page must be between 1 and 10000.",
      "INVALID_PAGE",
    );
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError(
      400,
      "limit must be between 1 and 100.",
      "INVALID_LIMIT",
    );
  }
};

export async function listUsers(options: {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}) {
  validatePage(options.page, options.limit);
  if (options.role && !roles.includes(options.role)) {
    throw new AppError(400, "role is invalid.", "INVALID_ROLE");
  }
  const filter: Record<string, unknown> = {};
  if (options.role) filter.role = options.role;
  if (options.isActive !== undefined) filter.isActive = options.isActive;
  if (options.search?.trim()) {
    const search = new RegExp(escapeRegex(options.search.trim()), "i");
    filter.$or = [{ name: search }, { email: search }, { department: search }];
  }

  const [users, total] = await Promise.all([
    Users.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1, _id: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .exec(),
    Users.countDocuments(filter),
  ]);
  return {
    items: users.map(toAdminUser),
    page: options.page,
    limit: options.limit,
    total,
    totalPages: Math.ceil(total / options.limit),
  };
}

export async function createManagedUser(input: AdminUserInput) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const department = input.department?.trim();
  if (!name || name.length > 160) {
    throw new AppError(
      400,
      "name must be between 1 and 160 characters.",
      "INVALID_NAME",
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "email must be valid.", "INVALID_EMAIL");
  }
  if (input.password.length < 8 || input.password.length > 256) {
    throw new AppError(
      400,
      "password must be 8 to 256 characters.",
      "INVALID_PASSWORD",
    );
  }
  const role = input.role ?? "employee";
  if (!roles.includes(role)) {
    throw new AppError(400, "role is invalid.", "INVALID_ROLE");
  }
  if (department && department.length > 120) {
    throw new AppError(
      400,
      "department must be at most 120 characters.",
      "INVALID_DEPARTMENT",
    );
  }

  try {
    const user = await Users.create({
      name,
      email,
      tenantId: getOrganizationId(),
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      role,
      department: department || undefined,
      isActive: true,
    });
    return toAdminUser(user);
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      throw new AppError(
        409,
        "An account with that email already exists.",
        "EMAIL_EXISTS",
      );
    }
    throw error;
  }
}

const assertCanRemoveAdmin = async (
  target: UserDocument,
  actorId: string,
  changes: AdminUserChanges,
): Promise<void> => {
  const removingAdminAccess =
    target.role === "admin" &&
    target.isActive &&
    ((changes.role !== undefined && changes.role !== "admin") ||
      changes.isActive === false);
  if (!removingAdminAccess) return;

  if (target._id.toString() === actorId) {
    throw new AppError(
      409,
      "You cannot remove your own active admin access.",
      "LAST_ADMIN_PROTECTED",
    );
  }
  const activeAdmins = await Users.countDocuments({
    role: "admin",
    isActive: true,
  });
  if (activeAdmins <= 1) {
    throw new AppError(
      409,
      "The last active administrator cannot be removed.",
      "LAST_ADMIN_PROTECTED",
    );
  }
};

export async function updateManagedUser(
  userId: string,
  actorId: string,
  changes: AdminUserChanges,
) {
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError(400, "userId is invalid.", "INVALID_USER_ID");
  }
  if (!Object.keys(changes).length) {
    throw new AppError(
      400,
      "At least one supported field is required.",
      "EMPTY_UPDATE",
    );
  }
  if (changes.role !== undefined && !roles.includes(changes.role)) {
    throw new AppError(400, "role is invalid.", "INVALID_ROLE");
  }
  if (
    changes.name !== undefined &&
    (!changes.name.trim() || changes.name.trim().length > 160)
  ) {
    throw new AppError(
      400,
      "name must be between 1 and 160 characters.",
      "INVALID_NAME",
    );
  }
  if (
    changes.email !== undefined &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email.trim())
  ) {
    throw new AppError(400, "email must be valid.", "INVALID_EMAIL");
  }
  if (
    changes.department !== undefined &&
    changes.department !== null &&
    changes.department.trim().length > 120
  ) {
    throw new AppError(
      400,
      "department must be at most 120 characters.",
      "INVALID_DEPARTMENT",
    );
  }
  if (changes.isActive !== undefined && typeof changes.isActive !== "boolean") {
    throw new AppError(
      400,
      "isActive must be a boolean.",
      "INVALID_ACTIVE_STATE",
    );
  }

  const user = await Users.findById(userId).exec();
  if (!user) throw new AppError(404, "User not found.", "USER_NOT_FOUND");
  await assertCanRemoveAdmin(user, actorId, changes);

  if (changes.name !== undefined) user.name = changes.name.trim();
  if (changes.email !== undefined)
    user.email = changes.email.trim().toLowerCase();
  if (changes.role !== undefined) user.role = changes.role;
  if (changes.department !== undefined)
    user.department = changes.department?.trim() || undefined;
  if (changes.isActive !== undefined) user.isActive = changes.isActive;
  try {
    await user.save();
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      throw new AppError(
        409,
        "An account with that email already exists.",
        "EMAIL_EXISTS",
      );
    }
    throw error;
  }
  return toAdminUser(user);
}

export async function deactivateManagedUser(userId: string, actorId: string) {
  return updateManagedUser(userId, actorId, { isActive: false });
}
