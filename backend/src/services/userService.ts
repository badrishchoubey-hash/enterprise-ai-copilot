import Users from "../models/User.js";
import type { UserProfile } from "../types/user.types.js";

export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const user = await Users.findOne({
    _id: userId,
    isActive: true,
  }).exec();

  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
