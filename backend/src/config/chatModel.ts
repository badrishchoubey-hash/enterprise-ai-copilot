import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AppError } from "../middleware/appError.js";

const positiveInteger = (name: string, fallback: number, maximum: number) => {
  const parsed = Number(process.env[name]);
  if (!Number.isInteger(parsed)) return fallback;
  if (parsed < 1 || parsed > maximum) {
    throw new AppError(
      500,
      `${name} must be between 1 and ${maximum}.`,
      "AI_CONFIGURATION_ERROR",
    );
  }
  return parsed;
};

export function getChatModelName(): string {
  return process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-3.1-flash-lite";
}

export function createChatModel(): ChatGoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(
      503,
      "The AI answer service is not configured. Set GOOGLE_API_KEY.",
      "AI_PROVIDER_UNAVAILABLE",
    );
  }
  const temperature = Number(process.env.GEMINI_CHAT_TEMPERATURE ?? 0);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new AppError(
      500,
      "GEMINI_CHAT_TEMPERATURE must be between 0 and 2.",
      "AI_CONFIGURATION_ERROR",
    );
  }
  return new ChatGoogleGenerativeAI({
    apiKey,
    model: getChatModelName(),
    temperature,
    maxOutputTokens: positiveInteger("GEMINI_CHAT_MAX_OUTPUT_TOKENS", 1024, 8192),
    maxRetries: 0,
    streaming: false,
  });
}
