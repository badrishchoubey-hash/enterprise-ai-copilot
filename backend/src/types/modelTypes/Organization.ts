import type { Document } from "mongoose";

export interface OrganizationDocument extends Document {
  name: string;
  migrationVersion: number;
  createdAt: Date;
  updatedAt: Date;
}
