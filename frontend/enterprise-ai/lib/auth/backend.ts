import axios from "axios";
import type { AuthResponse, UserProfileResponse } from "./types";
const defaultBackendUrl =
  process.env.NODE_ENV === "production"
    ? "https://enterprise-ai-copilot-7gda.vercel.app/api"
    : "http://localhost:5000/api";
const configuredBackendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  defaultBackendUrl;
const trimmedBackendUrl = configuredBackendUrl.replace(/\/+$/, "");
const backendBaseUrl = /\/api$/i.test(trimmedBackendUrl)
  ? trimmedBackendUrl
  : `${trimmedBackendUrl}/api`;

const backendAuth = axios.create({
  baseURL: backendBaseUrl,
  // Leave room for the backend's 30-second request timeout to return a
  // meaningful database error instead of closing the proxy request first.
  timeout: Number(process.env.BACKEND_REQUEST_TIMEOUT_MS) || 35_000,
  headers: { "Content-Type": "application/json" },
});
export async function backendLogin(payload: unknown) {
  const { data } = await backendAuth.post<AuthResponse>("/auth/login", payload);
  return data;
}
export async function backendRegister(payload: unknown) {
  const { data } = await backendAuth.post<AuthResponse>(
    "/auth/register",
    payload,
  );
  return data;
}
export async function backendRefresh(refreshToken: string) {
  const { data } = await backendAuth.post<AuthResponse["tokens"]>(
    "/auth/refresh",
    { refreshToken },
  );
  return data;
}
export async function backendLogout(refreshToken: string) {
  await backendAuth.post("/auth/logout", { refreshToken });
}
export async function backendGetProfile(accessToken: string) {
  const { data } = await backendAuth.get<UserProfileResponse>("/user/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}
export function backendError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return { error: "Authentication service is unavailable." };
  }

  const responseData: unknown = error.response?.data;
  if (typeof responseData !== "object" || responseData === null) {
    return { error: "Authentication request failed." };
  }

  const payload = responseData as {
    error?: unknown;
    message?: unknown;
    code?: unknown;
  };
  const nestedError =
    typeof payload.error === "object" && payload.error !== null
      ? (payload.error as { message?: unknown; code?: unknown })
      : undefined;
  const message =
    (typeof payload.error === "string" && payload.error) ||
    (typeof nestedError?.message === "string" && nestedError.message) ||
    (typeof payload.message === "string" && payload.message) ||
    "Authentication request failed.";
  const code =
    (typeof nestedError?.code === "string" && nestedError.code) ||
    (typeof payload.code === "string" && payload.code) ||
    undefined;

  return { error: message, ...(code ? { code } : {}) };
}

export function backendStatus(error: unknown, fallback = 503): number {
  if (!axios.isAxiosError(error)) return fallback;
  const status = error.response?.status;
  return typeof status === "number" ? status : fallback;
}

export function backendAdminFetch(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${backendBaseUrl}/v1/admin/${path}`, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init.headers).entries()),
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
}
