import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { Document } from "@langchain/core/documents";
import { AppError } from "../middleware/appError.js";
import { cleanDocumentText } from "../utils/textCleaning.js";

export type SupportedDocumentExtension =
  | "pdf"
  | "docx"
  | "doc"
  | "txt"
  | "md"
  | "csv";

export async function loadDocumentFile(
  filePath: string,
  extension: SupportedDocumentExtension,
  originalFilename: string,
): Promise<Document<Record<string, unknown>>[]> {
  let loaded: Document<Record<string, unknown>>[];
  switch (extension) {
    case "pdf":
      loaded = await new PDFLoader(filePath).load();
      break;
    case "docx":
      loaded = await new DocxLoader(filePath).load();
      break;
    case "doc":
      loaded = await new DocxLoader(filePath, { type: "doc" }).load();
      break;
    case "csv":
      loaded = await new CSVLoader(filePath).load();
      break;
    case "txt":
    case "md":
      loaded = await new TextLoader(filePath).load();
      break;
    default: {
      const exhaustive: never = extension;
      throw new AppError(
        415,
        `Files with extension .${exhaustive} are not supported.`,
        "UNSUPPORTED_FILE_TYPE",
      );
    }
  }

  const documents = loaded
    .map(
      (document) =>
        new Document({
          pageContent: cleanDocumentText(document.pageContent),
          metadata: {
            ...document.metadata,
            source: originalFilename,
            fileType: extension,
          },
        }),
    )
    .filter((document) => document.pageContent.length > 0);

  if (!documents.length) {
    throw new AppError(
      422,
      "No readable text was found in this file.",
      "EMPTY_DOCUMENT",
    );
  }
  return documents;
}
