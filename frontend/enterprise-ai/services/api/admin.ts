import axios from "axios";
import { apiClient } from "./axios";
import type {
  AdminAnalytics,
  AdminDocument,
  AdminPageResult,
  AdminRole,
  AdminUser,
  DocumentVisibility,
  KnowledgeBaseSummary,
} from "@/features/admin/types";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface AdminUserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: AdminRole | "all";
  isActive?: boolean | "all";
}

export interface AdminDocumentFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: AdminDocumentStatusFilter | "all";
  department?: string;
  visibility?: DocumentVisibility | "all";
}

export type AdminDocumentStatusFilter =
  "uploaded" | "processing" | "completed" | "failed" | "archived";

export interface CreateAdminUserInput {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  department?: string;
}

export interface UpdateAdminUserInput {
  name?: string;
  email?: string;
  role?: AdminRole;
  department?: string | null;
  isActive?: boolean;
}

export interface UpdateAdminDocumentInput {
  name?: string;
  department?: string | null;
  visibility?: DocumentVisibility;
}

const queryString = (filters: object) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== "all") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

function findNestedRecord(
  value: unknown,
  matches: (record: Record<string, unknown>) => boolean,
  depth = 0,
): Record<string, unknown> | undefined {
  if (typeof value === "string" && depth <= 8) {
    try {
      return findNestedRecord(JSON.parse(value) as unknown, matches, depth + 1);
    } catch {
      return undefined;
    }
  }
  if (
    depth > 8 ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (matches(record)) return record;

  for (const key of ["data", "result", "analytics", "payload"]) {
    const found = findNestedRecord(record[key], matches, depth + 1);
    if (found) return found;
  }
  for (const [key, nested] of Object.entries(record)) {
    if (["data", "result", "analytics", "payload"].includes(key)) continue;
    const found = findNestedRecord(nested, matches, depth + 1);
    if (found) return found;
  }
  return undefined;
}

export function getAdminErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      { error?: unknown; message?: unknown } | undefined;
    if (typeof payload?.error === "string") return payload.error;
    if (
      typeof payload?.error === "object" &&
      payload.error !== null &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
    ) {
      return payload.error.message;
    }
    if (typeof payload?.message === "string") return payload.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "We couldn’t complete that request. Please try again.";
}

export async function getAdminUsers(
  filters: AdminUserFilters = {},
): Promise<AdminPageResult<AdminUser>> {
  const { data } = await apiClient.get<ApiResponse<AdminPageResult<AdminUser>>>(
    `/v1/admin/users${queryString(filters)}`,
  );
  return data.data;
}

export async function createAdminUser(
  input: CreateAdminUserInput,
): Promise<AdminUser> {
  const { data } = await apiClient.post<ApiResponse<AdminUser>>(
    "/v1/admin/users",
    input,
  );
  return data.data;
}

export async function updateAdminUser(
  userId: string,
  input: UpdateAdminUserInput,
): Promise<AdminUser> {
  const { data } = await apiClient.patch<ApiResponse<AdminUser>>(
    `/v1/admin/users/${encodeURIComponent(userId)}`,
    input,
  );
  return data.data;
}

export async function deactivateAdminUser(userId: string): Promise<AdminUser> {
  const { data } = await apiClient.delete<ApiResponse<AdminUser>>(
    `/v1/admin/users/${encodeURIComponent(userId)}`,
  );
  return data.data;
}

export async function getAdminDocuments(
  filters: AdminDocumentFilters = {},
): Promise<AdminPageResult<AdminDocument>> {
  const { data } = await apiClient.get<
    ApiResponse<AdminPageResult<AdminDocument>> | Record<string, unknown>
  >(`/v1/admin/documents${queryString(filters)}`);
  const body = data as ApiResponse<unknown> & Record<string, unknown>;
  const directResult = (body.data ?? body) as Record<string, unknown>;
  const result =
    Array.isArray(directResult.items) || Array.isArray(directResult.documents)
      ? directResult
      : findNestedRecord(
          data,
          (record) =>
            Array.isArray(record.items) || Array.isArray(record.documents),
        );
  const items = Array.isArray(result?.items)
    ? result.items
    : Array.isArray(result?.documents)
      ? result.documents
      : Array.isArray(data)
        ? data
        : [];
  return {
    items: items as AdminDocument[],
    page: typeof result?.page === "number" ? result.page : filters.page ?? 1,
    limit: typeof result?.limit === "number" ? result.limit : filters.limit ?? 25,
    total: typeof result?.total === "number" ? result.total : items.length,
    totalPages:
      typeof result?.totalPages === "number"
        ? result.totalPages
        : items.length > 0
          ? 1
          : 0,
  };
}

export async function uploadAdminDocument(input: {
  file: File;
  department?: string;
  visibility: DocumentVisibility;
  onProgress?: (percent: number) => void;
}): Promise<AdminDocument> {
  const extension = input.file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = input.file.type ||
    ({
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      md: "text/markdown",
      csv: "text/csv",
    } as Record<string, string>)[extension] || "application/octet-stream";
  const { data: signatureResponse } = await apiClient.post<
    ApiResponse<{
      cloudName: string;
      apiKey: string;
      uploadUrl: string;
      params: {
        timestamp: number;
        public_id: string;
        type: string;
        overwrite: boolean;
      };
      signature: string;
      filename: string;
    }>
  >("/v1/admin/documents/upload-signature", {
    filename: input.file.name,
    mimeType,
    fileSize: input.file.size,
    department: input.department,
    visibility: input.visibility,
  });

  const signed = findNestedRecord(
    signatureResponse,
    (record) =>
      typeof record.apiKey === "string" &&
      typeof record.uploadUrl === "string" &&
      typeof record.signature === "string" &&
      Boolean(record.params && typeof record.params === "object"),
  ) as
    | {
        cloudName: string;
        apiKey: string;
        uploadUrl: string;
        params: {
          timestamp: number;
          public_id: string;
          type: string;
          overwrite: boolean;
        };
        signature: string;
        filename: string;
      }
    | undefined;

  if (!signed) {
    const responseKeys =
      signatureResponse && typeof signatureResponse === "object"
        ? Object.keys(signatureResponse).join(", ")
        : typeof signatureResponse;
    const responseError = findNestedRecord(
      signatureResponse,
      (record) =>
        typeof record.error === "string" || typeof record.message === "string",
    );
    const message =
      (typeof responseError?.error === "string" && responseError.error) ||
      (typeof responseError?.message === "string" && responseError.message);
    throw new Error(
      message ||
        `The configured backend did not return an upload signature (response: ${responseKeys || "no fields"}). Check the frontend deployment's BACKEND_URL and the backend's CLOUDINARY_URL, then redeploy both services.`,
    );
  }

  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("api_key", signed.apiKey);
  formData.append("timestamp", String(signed.params.timestamp));
  formData.append("public_id", signed.params.public_id);
  formData.append("type", signed.params.type);
  formData.append("overwrite", String(signed.params.overwrite));
  formData.append("signature", signed.signature);

  const uploadedAsset = (await new Promise<{
    public_id?: string;
    version?: number;
    error?: { message?: string };
  }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", signed.uploadUrl);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        input.onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    request.onerror = () => reject(new Error("The Cloudinary upload connection failed."));
    request.onload = () => {
      let response: {
        public_id?: string;
        version?: number;
        error?: { message?: string };
      };
      try {
        response = JSON.parse(request.responseText) as typeof response;
      } catch {
        reject(new Error("Cloudinary returned an unreadable upload response."));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(response.error?.message ?? "Cloudinary could not store this file."));
        return;
      }
      resolve(response);
    };
    request.send(formData);
  }));
  const uploadedAssetResponse = uploadedAsset as {
    public_id?: string;
    version?: number;
    error?: { message?: string };
  };
  if (!uploadedAssetResponse.public_id || !uploadedAssetResponse.version) {
    throw new Error(uploadedAssetResponse.error?.message ?? "Cloudinary could not store this file.");
  }
  input.onProgress?.(100);

  const fileDigest = await crypto.subtle.digest(
    "SHA-256",
    await input.file.arrayBuffer(),
  );
  const fileHash = Array.from(new Uint8Array(fileDigest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  const { data } = await apiClient.post<ApiResponse<AdminDocument>>(
    "/v1/admin/documents/upload",
    {
      filename: signed.filename,
      mimeType,
      fileSize: input.file.size,
      department: input.department,
      visibility: input.visibility,
      publicId: uploadedAssetResponse.public_id,
      version: uploadedAssetResponse.version,
      fileHash,
    },
  );
  return data.data;
}

export async function updateAdminDocument(
  documentId: string,
  input: UpdateAdminDocumentInput,
): Promise<AdminDocument> {
  const { data } = await apiClient.patch<ApiResponse<AdminDocument>>(
    `/v1/admin/documents/${encodeURIComponent(documentId)}`,
    input,
  );
  return data.data;
}

export async function deleteAdminDocument(documentId: string): Promise<void> {
  await apiClient.delete(
    `/v1/admin/documents/${encodeURIComponent(documentId)}`,
  );
}

export async function downloadAdminDocument(
  documentId: string,
): Promise<Blob | string> {
  const { data, headers } = await apiClient.get<Blob>(
    `/v1/admin/documents/${encodeURIComponent(documentId)}/file`,
    { responseType: "blob" },
  );
  if (
    typeof headers["content-type"] === "string" &&
    headers["content-type"].includes("application/json")
  ) {
    const payload = JSON.parse(await data.text()) as ApiResponse<{ url: string }>;
    return payload.data.url;
  }
  return data;
}

export async function getKnowledgeBaseSummary(): Promise<KnowledgeBaseSummary> {
  const { data } = await apiClient.get<ApiResponse<KnowledgeBaseSummary>>(
    "/v1/admin/knowledge-base",
  );
  return data.data;
}

export async function getAdminAnalytics(days = 30): Promise<AdminAnalytics> {
  const { data } = await apiClient.get<unknown>(
    `/v1/admin/analytics?days=${days}`,
  );
  const response = data as ApiResponse<AdminAnalytics>;
  return response.data;
}
