import crypto from "node:crypto";
import mongoose, { Types } from "mongoose";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { AskQuestionInput } from "./questionAnsweringValidation.js";
import { buildGroundedPrompt, KNOWLEDGE_BASE_FALLBACK, type RetrievedEvidence } from "./ragPromptService.js";
import { retrieveRelevantChunks, type RetrievalAccessContext, type RetrievedChunk } from "./vectorRetrievalService.js";
import { createChatModel, getChatModelName } from "../config/chatModel.js";
import Conversations from "../models/Conversation.js";
import Messages from "../models/Message.js";
import QueryLogs from "../models/QueryLog.js";
import { AppError } from "../middleware/appError.js";
import { logError } from "../utils/logger.js";

export interface ChatClient {
  invoke(messages: Array<SystemMessage | HumanMessage>): Promise<{ content: unknown }>;
}

export interface QuestionCitation {
  sourceId: string;
  documentId: string;
  documentName: string;
  page: number | null;
  section: string | null;
  chunkIndex: number;
  chunkId: string;
  score: number;
}

const contextFromChunk = (chunk: RetrievedChunk, index: number): RetrievedEvidence => ({
  sourceId: `S${index + 1}`,
  documentId: chunk.documentId.toString(),
  documentName: chunk.document.name,
  page: typeof chunk.pageNumber === "number" ? chunk.pageNumber : null,
  section:
    typeof chunk.metadata?.section === "string" && chunk.metadata.section.trim()
      ? chunk.metadata.section.trim()
      : null,
  chunkIndex: chunk.chunkIndex,
  content: chunk.content,
});

const citationFromChunk = (
  chunk: RetrievedChunk,
  evidence: RetrievedEvidence,
): QuestionCitation => ({
  sourceId: evidence.sourceId,
  documentId: evidence.documentId,
  documentName: evidence.documentName,
  page: evidence.page,
  section: evidence.section,
  chunkIndex: evidence.chunkIndex,
  chunkId: chunk._id.toString(),
  score: chunk.score,
});

function responseText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .flatMap((part) =>
        typeof part === "object" && part !== null && "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
          ? [(part as { text: string }).text]
          : [],
      )
      .join("")
      .trim();
  }
  return "";
}

export async function generateGroundedAnswer(
  question: string,
  chunks: RetrievedChunk[],
  history: Array<{ role: "user" | "assistant"; content: string }>,
  model?: ChatClient,
): Promise<{ answer: string; sources: QuestionCitation[] }> {
  if (!chunks.length) return { answer: KNOWLEDGE_BASE_FALLBACK, sources: [] };
  const evidence = chunks.map(contextFromChunk);
  const prompt = buildGroundedPrompt(question, evidence, history);
  const timeoutMs = Number(process.env.GEMINI_CHAT_TIMEOUT_MS) || 30_000;
  const chatModel = model ?? createChatModel();
  const modelCall = chatModel.invoke([
    new SystemMessage(prompt.system),
    new HumanMessage(prompt.user),
  ]);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let result: { content: unknown };
  try {
    result = await Promise.race([
      modelCall,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new AppError(504, "The answer service timed out.", "AI_REQUEST_TIMEOUT")),
          timeoutMs,
        );
        timeout.unref?.();
      }),
    ]);
  } catch (error) {
    const status = (error as { status?: number; statusCode?: number })?.status ??
      (error as { statusCode?: number })?.statusCode;
    const errorCode = String((error as { code?: string | number })?.code ?? "");
    const isRateLimited = status === 429 ||
      /RESOURCE_EXHAUSTED|RATE_LIMIT/i.test(`${errorCode} ${String(status ?? "")}`);
    const code = isRateLimited
      ? "AI_RATE_LIMITED"
      : error instanceof AppError
        ? error.code
        : "AI_PROVIDER_FAILED";
    const httpStatus = error instanceof AppError ? error.statusCode : isRateLimited ? 429 : 503;
    logError("ai.answer.generation.failed", {
      errorType: (error as { name?: string })?.name,
      errorCode: (error as { code?: string | number })?.code,
    });
    throw new AppError(
      httpStatus,
      error instanceof AppError
        ? error.message
        : isRateLimited
          ? "The answer provider is rate limited. Try again shortly."
          : "The answer could not be generated right now.",
      code,
      { cause: error },
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const rawAnswer = responseText(result.content);
  if (!rawAnswer) {
    throw new AppError(502, "The answer provider returned an invalid response.", "INVALID_AI_RESPONSE");
  }
  if (rawAnswer === KNOWLEDGE_BASE_FALLBACK) {
    return { answer: KNOWLEDGE_BASE_FALLBACK, sources: [] };
  }

  const sourceById = new Map(evidence.map((item, index) => [item.sourceId, citationFromChunk(chunks[index]!, item)]));
  const referencedIds = new Set<string>();
  const answer = rawAnswer.replace(/\[S(\d+)\]/g, (citation, number: string) => {
    const id = `S${number}`;
    if (!sourceById.has(id)) return "";
    referencedIds.add(id);
    return citation;
  }).trim();
  if (!referencedIds.size || !answer) {
    return { answer: KNOWLEDGE_BASE_FALLBACK, sources: [] };
  }
  return {
    answer,
    sources: [...referencedIds].map((id) => sourceById.get(id)!),
  };
}

const conversationHistory = async (conversationId: Types.ObjectId, userId: Types.ObjectId) => {
  const messages = await Messages.find({
    conversationId,
    userId,
    role: { $in: ["user", "assistant"] },
  })
    .select("role content")
    .sort({ createdAt: -1, _id: -1 })
    .limit(12)
    .lean()
    .exec();
  return messages
    .reverse()
    .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));
};

async function persistConversationTurn(
  input: AskQuestionInput,
  userId: Types.ObjectId,
  tenantId: Types.ObjectId,
  answer: string,
  sources: QuestionCitation[],
): Promise<string> {
  const session = await mongoose.startSession();
  let conversationId: Types.ObjectId | undefined;
  try {
    await session.withTransaction(async () => {
      let conversation;
      if (input.conversationId) {
        conversation = await Conversations.findOne({
          _id: input.conversationId,
          userId,
          tenantId,
          archivedAt: { $exists: false },
        }).session(session).exec();
        if (!conversation) {
          throw new AppError(404, "Conversation not found.", "CONVERSATION_NOT_FOUND");
        }
      } else {
        [conversation] = await Conversations.create(
          [{
            userId,
            tenantId,
            title: input.question.slice(0, 300),
            lastMessageAt: new Date(),
          }],
          { session },
        );
      }
      if (!conversation) throw new AppError(503, "Conversation could not be saved.", "CONVERSATION_SAVE_FAILED");
      conversationId = conversation._id;
      const messageCitations = sources.map((source) => ({
        documentId: new Types.ObjectId(source.documentId),
        chunkId: new Types.ObjectId(source.chunkId),
        score: source.score,
        documentName: source.documentName,
        ...(source.page === null ? {} : { page: source.page }),
        ...(source.section === null ? {} : { section: source.section }),
        chunkIndex: source.chunkIndex,
      }));
      await Messages.create(
        [
          { conversationId, userId, role: "user", content: input.question, citations: [] },
          { conversationId, userId, role: "assistant", content: answer, citations: messageCitations, modelName: getChatModelName() },
        ],
        { session },
      );
      conversation.lastMessageAt = new Date();
      await conversation.save({ session });
    });
  } finally {
    await session.endSession();
  }
  if (!conversationId) throw new AppError(503, "Conversation could not be saved.", "CONVERSATION_SAVE_FAILED");
  return conversationId.toString();
}

export async function askKnowledgeBase(
  input: AskQuestionInput,
  access: RetrievalAccessContext & { userId: Types.ObjectId },
  requestId?: string,
): Promise<{ answer: string; sources: QuestionCitation[]; conversationId: string }> {
  const startedAt = Date.now();
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (input.conversationId) {
    const conversation = await Conversations.findOne({
      _id: input.conversationId,
      userId: access.userId,
      tenantId: access.tenantId,
      archivedAt: { $exists: false },
    }).select("_id").lean().exec();
    if (!conversation) throw new AppError(404, "Conversation not found.", "CONVERSATION_NOT_FOUND");
    history = await conversationHistory(conversation._id, access.userId);
  }

  const chunks = await retrieveRelevantChunks(input.question, access);
  const generated = await generateGroundedAnswer(
    input.question,
    chunks,
    history,
  );
  const conversationId = await persistConversationTurn(
    input,
    access.userId,
    access.tenantId,
    generated.answer,
    generated.sources,
  );

  const latencyMs = Date.now() - startedAt;
  try {
    await QueryLogs.create({
      userId: access.userId,
      conversationId: new Types.ObjectId(conversationId),
      query: input.question,
      latencyMs,
      resultCount: chunks.length,
      retrievalMode: "vector",
      modelName: getChatModelName(),
      requestId: requestId || crypto.randomUUID(),
    });
  } catch (error) {
    logError("ai.query_log.failed", {
      requestId,
      errorType: (error as { name?: string })?.name,
      errorCode: (error as { code?: string | number })?.code,
    });
  }
  return { ...generated, conversationId };
}
