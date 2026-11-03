import { setTimeout as delay } from "node:timers/promises";
import { getEmbeddingFailureDetails } from "./embeddingErrorService.js";
import { logInfo } from "../utils/logger.js";

export interface EmbeddingRetryBudget {
  remainingRetries: number;
  onRetry?: (waitMs: number) => Promise<void>;
}

export async function withEmbeddingRetry<T>(
  request: () => Promise<T>,
  wait: (milliseconds: number) => Promise<unknown> = delay,
  budget: EmbeddingRetryBudget = { remainingRetries: 3 },
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      const { quotaIds, retryDelay } = getEmbeddingFailureDetails(error);
      const seconds = retryDelay ? Number(retryDelay.slice(0, -1)) : NaN;
      // Only retry explicit short-lived throttling, never daily limits or billing.
      if (status !== 429 || attempt >= 3 || budget.remainingRetries <= 0 || !Number.isFinite(seconds) ||
          seconds < 0 || seconds > 59 || quotaIds.some((id) => /PerDay/i.test(id))) throw error;
      const waitMs = Math.ceil(seconds * 1000) + 1000;
      budget.remainingRetries -= 1;
      logInfo("document.embedding.retry_scheduled", { attempt: attempt + 1, waitMs, quotaIds });
      await budget.onRetry?.(waitMs);
      await wait(waitMs);
    }
  }
}
