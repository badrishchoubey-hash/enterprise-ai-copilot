import { apiClient } from "./axios";
import type { AskQuestionInput, AskQuestionResponse } from "@/features/chat/types";

export async function askQuestion(input: AskQuestionInput) {
  const { data } = await apiClient.post<AskQuestionResponse>(
    "/v1/ai/ask",
    input,
  );
  return data.data;
}

export function getAskErrorMessage(error: unknown): string {
  const responseData = (
    error as {
      response?: {
        data?: { error?: unknown; message?: unknown };
      };
    }
  ).response?.data;
  const apiMessage =
    typeof responseData?.error === "string"
      ? responseData.error
      : typeof responseData?.message === "string"
        ? responseData.message
        : undefined;

  if (apiMessage === "Knowledge search is unavailable.") {
    return "Knowledge search is unavailable. Check the MongoDB Atlas Vector Search index configuration.";
  }
  if (
    apiMessage === "The question could not be embedded right now." ||
    apiMessage === "Document embedding is not configured."
  ) {
    return "The AI search service is not ready. Check the backend Gemini configuration.";
  }
  return apiMessage ?? "We could not get an answer. Please try again.";
}
