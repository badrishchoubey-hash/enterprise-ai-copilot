import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  KnowledgeDocument,
  DocumentStatus,
  DocumentType,
} from "../features/dashboard/types";
const initialDocuments: KnowledgeDocument[] = [
  {
    id: "doc-1",
    name: "HR Policy Handbook",
    type: "PDF",
    size: "2.4 MB",
    uploadedAt: "Today, 09:42",
    updatedAt: "Today, 09:43",
    status: "processed",
    chunks: 84,
    uploadedBy: "Sarah Chen",
    visibility: "HR",
  },
  {
    id: "doc-2",
    name: "Security & Access Guide",
    type: "PDF",
    size: "1.8 MB",
    uploadedAt: "Today, 08:15",
    updatedAt: "Today, 08:16",
    status: "processing",
    chunks: 0,
    uploadedBy: "Sarah Chen",
    visibility: "Security",
  },
  {
    id: "doc-3",
    name: "IT Support Playbook",
    type: "DOCX",
    size: "4.7 MB",
    uploadedAt: "Yesterday, 16:30",
    updatedAt: "Yesterday, 16:32",
    status: "processed",
    chunks: 126,
    uploadedBy: "Marcus Lee",
    visibility: "IT",
  },
  {
    id: "doc-4",
    name: "Employee Benefits FAQ",
    type: "TXT",
    size: "246 KB",
    uploadedAt: "Yesterday, 13:05",
    updatedAt: "Yesterday, 13:05",
    status: "processed",
    chunks: 32,
    uploadedBy: "Sarah Chen",
    visibility: "All employees",
  },
  {
    id: "doc-5",
    name: "Product Troubleshooting v2",
    type: "DOCX",
    size: "3.1 MB",
    uploadedAt: "Oct 24, 11:20",
    updatedAt: "Oct 24, 11:20",
    status: "failed",
    chunks: 0,
    uploadedBy: "David Park",
    visibility: "IT",
    error: "Could not extract text from page 8",
  },
];
const documentsSlice = createSlice({
  name: "documents",
  initialState: { items: initialDocuments, selectedId: null as string | null },
  reducers: {
    addDocument: (
      state,
      action: PayloadAction<{ name: string; type: DocumentType; size: string }>,
    ) => {
      const { name, type, size } = action.payload;
      state.items.unshift({
        id: `doc-${Date.now()}`,
        name,
        type,
        size,
        uploadedAt: "Just now",
        updatedAt: "Just now",
        status: "uploaded",
        chunks: 0,
        uploadedBy: "You",
        visibility: "All employees",
      });
    },
    retryDocument: (state, action: PayloadAction<string>) => {
      const doc = state.items.find((item) => item.id === action.payload);
      if (doc) {
        doc.status = "processing";
        doc.error = undefined;
        doc.updatedAt = "Just now";
      }
    },
    setDocumentStatus: (
      state,
      action: PayloadAction<{ id: string; status: DocumentStatus }>,
    ) => {
      const doc = state.items.find((item) => item.id === action.payload.id);
      if (doc) doc.status = action.payload.status;
    },
    selectDocument: (state, action: PayloadAction<string | null>) => {
      state.selectedId = action.payload;
    },
  },
});
export const { addDocument, retryDocument, setDocumentStatus, selectDocument } =
  documentsSlice.actions;
export default documentsSlice.reducer;
