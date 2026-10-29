export type DocumentStatus = "processed" | "processing" | "failed" | "uploaded";
export type DocumentType = "PDF" | "DOCX" | "TXT";
export interface KnowledgeDocument {
  id: string;
  name: string;
  type: DocumentType;
  size: string;
  uploadedAt: string;
  updatedAt: string;
  status: DocumentStatus;
  chunks: number;
  uploadedBy: string;
  visibility: "All employees" | "HR" | "IT" | "Security";
  error?: string;
}
export interface DashboardStats {
  label: string;
  value: string;
  change: string;
  description: string;
}
