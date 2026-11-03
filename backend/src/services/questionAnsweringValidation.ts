import { AppError } from "../middleware/appError.js";

const maximumQuestionLength = (): number => {
  const configured = Number(process.env.AI_MAX_QUESTION_LENGTH);
  if (!Number.isInteger(configured)) return 2_000;
  if (configured < 1 || configured > 20_000) {
    throw new AppError(
      500,
      "AI_MAX_QUESTION_LENGTH must be between 1 and 20000.",
      "AI_CONFIGURATION_ERROR",
    );
  }
  return configured;
};

export interface AskQuestionInput {
  question: string;
  conversationId?: string;
}

export function validateAskQuestionBody(body: unknown): AskQuestionInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(400, "Request body must be an object.", "INVALID_BODY");
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["question", "conversationId"].includes(key))) {
    throw new AppError(400, "Request contains unsupported fields.", "INVALID_BODY");
  }
  if (typeof record.question !== "string" || !record.question.trim()) {
    throw new AppError(400, "question is required.", "INVALID_QUESTION");
  }
  const question = record.question.trim();
  if (question.length > maximumQuestionLength()) {
    throw new AppError(
      400,
      `question must be at most ${maximumQuestionLength()} characters.`,
      "QUESTION_TOO_LONG",
    );
  }
  if (
    record.conversationId !== undefined &&
    (typeof record.conversationId !== "string" ||
      !/^[a-f\d]{24}$/i.test(record.conversationId))
  ) {
    throw new AppError(400, "conversationId is invalid.", "INVALID_CONVERSATION_ID");
  }
  return {
    question,
    ...(typeof record.conversationId === "string"
      ? { conversationId: record.conversationId }
      : {}),
  };
}
