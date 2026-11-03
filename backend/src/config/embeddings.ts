import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { AppError } from "../middleware/appError.js";

export type EmbeddingTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";
export type EmbeddingProvider = "gemini" | "openai";
export type GeminiEmbeddingFormat = "current" | "legacy-raw";

export const formatGeminiDocumentText = (text: string): string =>
  `title: none | text: ${text}`;

export const formatGeminiQuestionText = (text: string): string =>
  `task: question answering | query: ${text}`;

class GeminiTaskAwareEmbeddings extends GoogleGenerativeAIEmbeddings {
  constructor(
    fields: ConstructorParameters<typeof GoogleGenerativeAIEmbeddings>[0],
    private readonly useQuestionAnsweringPrefixes: boolean,
  ) {
    super(fields);
  }

  override embedDocuments(documents: string[]): Promise<number[][]> {
    return super.embedDocuments(
      this.useQuestionAnsweringPrefixes
        ? documents.map(formatGeminiDocumentText)
        : documents,
    );
  }

  override embedQuery(document: string): Promise<number[]> {
    return super.embedQuery(
      this.useQuestionAnsweringPrefixes
        ? formatGeminiQuestionText(document)
        : document,
    );
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  const configured = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "gemini") return "gemini";
  if (configured === "openai") return "openai";
  throw new AppError(
    500,
    "EMBEDDING_PROVIDER must be either gemini or openai.",
    "INGESTION_CONFIGURATION_ERROR",
  );
}

export function getEmbeddingModelName(): string {
  const configured = process.env.EMBEDDING_MODEL?.trim();
  if (configured) return configured;
  return getEmbeddingProvider() === "gemini"
    ? "gemini-embedding-2"
    : "text-embedding-3-small";
}

export function getEmbeddingModelIdentifier(): string {
  const model = getEmbeddingModelName().replace(/^models\//, "");
  if (getEmbeddingProvider() === "gemini" && model === "gemini-embedding-2") {
    const dimensions = Number(process.env.EMBEDDING_DIMENSIONS);
    const outputDimensions = Number.isInteger(dimensions) && dimensions > 0
      ? dimensions
      : 768;
    return `${model}:qa-prefix-v1:${outputDimensions}`;
  }
  return model;
}

export function getLegacyEmbeddingModelIdentifier(): string | undefined {
  const model = getEmbeddingModelName().replace(/^models\//, "");
  return getEmbeddingProvider() === "gemini" && model === "gemini-embedding-2"
    ? model
    : undefined;
}

export function createEmbeddings(
  task: EmbeddingTask = "RETRIEVAL_DOCUMENT",
  format: GeminiEmbeddingFormat = "current",
):
  | GoogleGenerativeAIEmbeddings
  | OpenAIEmbeddings {
  const provider = getEmbeddingProvider();
  const apiKey =
    provider === "gemini"
      ? process.env.GOOGLE_API_KEY?.trim()
      : process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const variable =
      provider === "gemini"
        ? "GOOGLE_API_KEY"
        : "OPENAI_API_KEY";
    throw new AppError(
      503,
      `Document embedding is not configured. Set ${variable}.`,
      "EMBEDDING_PROVIDER_UNAVAILABLE",
    );
  }

  const batchSizeValue = Number(process.env.EMBEDDING_BATCH_SIZE);
  const batchSize =
    Number.isInteger(batchSizeValue) && batchSizeValue > 0
      ? Math.min(batchSizeValue, 128)
      : 64;
  const dimensionsValue = Number(process.env.EMBEDDING_DIMENSIONS);
  const dimensions =
    Number.isInteger(dimensionsValue) && dimensionsValue > 0
      ? dimensionsValue
      : undefined;

  if (provider === "gemini") {
    const model = getEmbeddingModelName().replace(/^models\//, "");
    const isEmbedding2 = model === "gemini-embedding-2";
    return new GeminiTaskAwareEmbeddings({
      apiKey,
      model,
      ...(!isEmbedding2
        ? {
            taskType:
              task === "RETRIEVAL_QUERY"
                ? TaskType.RETRIEVAL_QUERY
                : TaskType.RETRIEVAL_DOCUMENT,
          }
        : {}),
      outputDimensionality:
        dimensions ??
        (isEmbedding2 ? 768 : undefined),
    }, isEmbedding2 && format === "current");
  }

  const baseURL = process.env.EMBEDDING_BASE_URL?.trim();
  return new OpenAIEmbeddings({
    apiKey,
    model: getEmbeddingModelName(),
    ...(dimensions ? { dimensions } : {}),
    ...(baseURL ? { configuration: { baseURL } } : {}),
    batchSize,
    maxConcurrency: 2,
    maxRetries: 5,
    timeout: 60_000,
  });
}
