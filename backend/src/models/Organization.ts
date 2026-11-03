import { Schema } from "mongoose";
import { registered, requiredText } from "./modelHelpers";
import type { OrganizationDocument } from "../types/modelTypes/Organization.js";

const organizationSchema = new Schema<OrganizationDocument>(
  {
    name: requiredText(160),
    migrationVersion: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, strict: "throw" },
);

export const Organizations = registered<OrganizationDocument>(
  "Organizations",
  organizationSchema,
  "Organizations",
);
export default Organizations;
