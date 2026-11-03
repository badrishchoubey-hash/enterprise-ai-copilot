import type { Document, Types } from "mongoose";

export interface UserDocument extends Document {
  name: string;
  tenantId: Types.ObjectId;
  email: string;
  passwordHash?: string;
  role: "employee" | "support_agent" | "admin";
  department?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
