import app from "../src/server.js";
import { connectDB } from "../src/config/database.js";

export default async function handler(
  req: Parameters<typeof app>[0],
  res: Parameters<typeof app>[1],
) {
  await connectDB();
  return app(req, res);
}
