export type AdminRole = "employee" | "support_agent" | "admin";
export type DocumentVisibility = "private" | "department" | "organization";
export type AdminDocumentStatus =
  "uploaded" | "processing" | "completed" | "failed" | "archived";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  department?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDocument {
  id: string;
  name: string;
  type: string;
  status: AdminDocumentStatus;
  department?: string;
  visibility: DocumentVisibility;
  uploadedBy: string;
  fileSize?: number;
  mimeType?: string;
  pageCount?: number;
  totalChunks?: number;
  processedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPageResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface KnowledgeBaseSummary {
  totalDocuments: number;
  totalFileBytes: number;
  totalChunks: number;
  documentsByStatus: Record<string, number>;
  departments: string[];
  supportedVisibility: DocumentVisibility[];
  processingAvailable: boolean;
}

export interface AdminAnalytics {
  periodDays: number;
  since: string;
  users: {
    total: number;
    active: number;
    byRole: Record<string, number>;
  };
  documents: {
    total: number;
    totalFileBytes: number;
    byStatus: Record<string, number>;
  };
  usage: {
    totalQueries: number;
    averageLatencyMs: number;
    averageResultCount: number;
  };
  feedback: {
    total: number;
    positive: number;
    negative: number;
  };
}
