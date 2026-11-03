/// <reference path="./types/express.d.ts" />

import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { connectDB } from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { requestTimeout } from "./middleware/requestTimeout.js";
import { logError, logInfo } from "./utils/logger.js";
import {
  queuePendingUploadedDocuments,
  recoverInterruptedDocumentProcessing,
  waitForDocumentProcessing,
} from "./services/documentProcessingService.js";

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
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://enterprise-ai-copilot-ochre.vercel.app",
]);

if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
    .forEach((origin) => allowedOrigins.add(origin));
}

app.use(
  cors({
    origin: (origin, callback) => {
      const cleanOrigin = origin ? origin.replace(/\/$/, "") : "";
      if (
        !origin ||
        allowedOrigins.has(cleanOrigin) ||
        /^https:\/\/enterprise-ai-copilot.*\.vercel\.app$/.test(cleanOrigin)
      ) {
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

// Root & Health Check Endpoints
app.get("/", (_req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "OK", message: "OmniMind Backend API is operational" });
});

app.get("/health", (_req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "OK", message: "OmniMind Backend API is operational" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/ai", aiRoutes);

app.use(errorHandler);

const startServer = async (): Promise<void> => {
  await connectDB();
  const interrupted = await recoverInterruptedDocumentProcessing();
  const queued = await queuePendingUploadedDocuments();
  if (interrupted || queued) {
    console.log(`[server]: Recovered ${interrupted} interrupted document(s); queued ${queued} pending document(s)`);
  }
  const server = app.listen(PORT, () => {
    console.log(`[server]: Server running on http://localhost:${PORT}`);
  });
  // A recently interrupted worker may not be stale yet when this process starts.
  // Recheck later so it cannot remain in processing until another restart.
  let recoveryRunning = false;
  const recoveryTimer = setInterval(() => {
    if (recoveryRunning) return;
    recoveryRunning = true;
    void recoverInterruptedDocumentProcessing()
      .then((recovered) => {
        if (recovered) logInfo("document.processing.recovered", { recovered });
      })
      .catch(() => logError("document.processing.recovery_failed"))
      .finally(() => { recoveryRunning = false; });
  }, 60_000);
  recoveryTimer.unref();
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(recoveryTimer);
    console.log(`[server]: ${signal} received; draining requests`);
    server.close(() => {
      void waitForDocumentProcessing()
        .then(() => import("./config/database.js"))
        .then(({ disconnectDB }) => disconnectDB())
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
    setTimeout(() => process.exit(1), 25_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

if (process.env.VERCEL !== "1") {
  void startServer().catch((error: unknown) => {
    console.error("[server]: Startup failed:", error);
    process.exit(1);
  });
}

export default app;
