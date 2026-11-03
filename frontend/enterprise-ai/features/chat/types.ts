export interface AskQuestionResponse {
  success: boolean;
  message: string;
  data: {
    answer: string;
    conversationId: string;
    sources: Citation[];
  };
}

export interface Citation {
  sourceId: string;
  documentId: string;
  documentName: string;
  page: number | null;
  section: string | null;
  chunkIndex: number;
  chunkId: string;
  score: number;
}

export interface AskQuestionInput {
  question: string;
  conversationId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Citation[];
}
