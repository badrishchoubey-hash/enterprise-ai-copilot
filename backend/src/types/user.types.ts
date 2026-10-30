import type { UserRole } from "./auth.types.js";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetUserProfileResponse {
  success: boolean;
  message: string;
  data: UserProfile;
}
