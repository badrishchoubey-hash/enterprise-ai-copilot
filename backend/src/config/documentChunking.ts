import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { AppError } from "../middleware/appError.js";

const configuredInteger = (
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const value = Number(process.env[key]);
  if (!Number.isInteger(value)) return fallback;
  if (value < minimum || value > maximum) {
    throw new AppError(
      500,
      `${key} must be between ${minimum} and ${maximum}.`,
      "INGESTION_CONFIGURATION_ERROR",
    );
  }
  return value;
};

export function getDocumentChunkingConfig() {
  const chunkSize = configuredInteger("DOCUMENT_CHUNK_SIZE", 1_000, 200, 8_000);
  const chunkOverlap = configuredInteger(
    "DOCUMENT_CHUNK_OVERLAP",
    200,
    0,
    Math.min(2_000, chunkSize - 1),
  );
  return { chunkSize, chunkOverlap };
}

export function createDocumentSplitter() {
  return new RecursiveCharacterTextSplitter({
    ...getDocumentChunkingConfig(),
    keepSeparator: true,
  });
}
