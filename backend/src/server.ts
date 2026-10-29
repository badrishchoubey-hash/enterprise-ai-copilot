import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { connectDB } from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { requestTimeout } from "./middleware/requestTimeout.js";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app: Express = express();
const PORT = Number(process.env.PORT) || 5000;

// Security Fix (S5689): Disable X-Powered-By header
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(requestTimeout());
app.use(rateLimit());

// Security & Performance Fix (S5122 & S7776): Use a Set for O(1) CORS origin lookups
const allowedOrigins = new Set<string>([
  process.env.FRONTEND_URL || "http://localhost:3000",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

// Health Check Endpoint
app.get("/health", (req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "OK", message: "OmniMind Backend API is operational" });
});

app.use(errorHandler);

// Connect to MongoDB and start Express server
const startServer = async (): Promise<void> => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`⚡️ [server]: Server running on http://localhost:${PORT}`);
  });
};

// Fix SonarQube S9383: Catch unhandled promise rejections at top-level execution
startServer().catch((error: unknown) => {
  console.error("❌ [server]: Failed to start server:", error);
  process.exit(1);
});
