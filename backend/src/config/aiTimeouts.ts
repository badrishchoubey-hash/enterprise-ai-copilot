const milliseconds = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export const getQueryEmbeddingTimeoutMs = () => milliseconds("AI_EMBEDDING_TIMEOUT_MS", 15_000);
export const getChatTimeoutMs = () => milliseconds("GEMINI_CHAT_TIMEOUT_MS", 30_000);
export const getAiRequestTimeoutMs = () => Math.max(
  milliseconds("AI_REQUEST_TIMEOUT_MS", 75_000),
  // Allow both current and legacy query embeddings, plus database work.
  getQueryEmbeddingTimeoutMs() * 2 + getChatTimeoutMs() + 15_000,
);
