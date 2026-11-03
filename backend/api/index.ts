import app from "../src/server.js";
import { connectDB } from "../src/config/database.js";
import { ensureOrganizationTenant } from "../src/services/organizationTenantService.js";

export default async function handler(
  req: Parameters<typeof app>[0],
  res: Parameters<typeof app>[1],
) {
  await connectDB();
  await ensureOrganizationTenant();
  return app(req, res);
}
