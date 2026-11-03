import { AppError } from "../middleware/appError.js";

export function getEmbeddingFailureDetails(error: unknown): {
  quotaIds: string[];
  retryDelay?: string;
} {
  const details = (error as { errorDetails?: unknown } | null)?.errorDetails;
  const quotaIds: string[] = [];
  let retryDelay: string | undefined;
  if (Array.isArray(details)) {
    for (const detail of details) {
      if (detail?.["@type"] === "type.googleapis.com/google.rpc.QuotaFailure" && Array.isArray(detail.violations)) {
        for (const violation of detail.violations) {
          if (typeof violation?.quotaId === "string" && /^[\w.-]{1,200}$/.test(violation.quotaId)) quotaIds.push(violation.quotaId);
        }
      }
      if (detail?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo" &&
          typeof detail.retryDelay === "string" && /^\d+(\.\d+)?s$/.test(detail.retryDelay)) retryDelay = detail.retryDelay;
    }
  }
  return { quotaIds, ...(retryDelay ? { retryDelay } : {}) };
}

export function toEmbeddingError(error: unknown): AppError | undefined {
  if (error instanceof AppError) return error;
  if (!error || typeof error !== "object") return undefined;
  const details = error as { name?: string; status?: number; statusCode?: number; response?: { status?: number } };
  const { quotaIds, retryDelay } = getEmbeddingFailureDetails(error);
  if (details.name === "RateLimitQuotaExhaustedError" && quotaIds.some((id) => /PerDay/i.test(id)) && !quotaIds.some((id) => /PerMinute/i.test(id))) {
    return new AppError(429,
      "The embedding provider's daily quota was reached. Check your API project's limits and retry after the daily quota resets or is increased.",
      "EMBEDDING_QUOTA_EXHAUSTED", { cause: error });
  }
  if ((details.status ?? details.statusCode ?? details.response?.status) === 429 ||
      details.name === "RateLimitError" || details.name === "RateLimitCapacityError" || details.name === "RateLimitQuotaExhaustedError") {
    return new AppError(429,
      `The embedding provider returned a rate or quota limit (429). ${retryDelay ? `Retry after ${retryDelay}.` : "Wait before retrying."} Check the Gemini Embedding 2 rate limits for your API project if this persists.`,
      "EMBEDDING_RATE_LIMITED", { cause: error });
  }
  return undefined;
}
