export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "employee" | "support_agent" | "admin";
  department?: string;
}
export interface UserProfile extends AuthUser {
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}
export interface UserProfileResponse {
  success: boolean;
  message: string;
  data: UserProfile;
}
export interface AuthResponse {
  user: AuthUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string | number;
  };
}
export interface SessionResponse {
  user: AuthUser;
}
export interface AuthErrorResponse {
  error?: string;
  message?: string;
}
