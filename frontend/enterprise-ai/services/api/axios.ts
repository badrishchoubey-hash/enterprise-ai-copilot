import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { AuthErrorResponse } from "@/lib/auth/types";
export const apiClient = axios.create({
  // Browser requests must go through this Next.js app's same-origin API
  // routes, which read the HttpOnly auth cookies and proxy to the backend.
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
type SessionRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _sessionEpoch?: number;
};

let refreshPromise: Promise<void> | null = null;
let refreshController: AbortController | null = null;
let loggingOut = false;
let sessionEpoch = 0;

function cancelSessionRefresh() {
  refreshController?.abort();
  refreshController = null;
  refreshPromise = null;
}

export function setLoggingOut(value: boolean) {
  if (value && !loggingOut) {
    sessionEpoch += 1;
    cancelSessionRefresh();
  }
  loggingOut = value;
}
export function beginAuthSession() {
  sessionEpoch += 1;
  loggingOut = false;
  cancelSessionRefresh();
}
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers.set("X-Requested-With", "XMLHttpRequest");
  (config as SessionRequestConfig)._sessionEpoch = sessionEpoch;
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<AuthErrorResponse>) => {
    const original = error.config as SessionRequestConfig | undefined;
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      loggingOut ||
      original._sessionEpoch !== sessionEpoch ||
      /\/auth\/(?:login|register|logout|refresh)(?:\?|$)/.test(
        original.url ?? "",
      )
    )
      throw error;
    original._retry = true;
    if (!refreshPromise) {
      const controller = new AbortController();
      refreshController = controller;
      refreshPromise = apiClient
        .post("/auth/refresh", undefined, { signal: controller.signal })
        .then(() => undefined)
        .finally(() => {
          if (refreshController === controller) {
            refreshController = null;
            refreshPromise = null;
          }
        });
    }
    try {
      await refreshPromise;
      if (loggingOut || original._sessionEpoch !== sessionEpoch) throw error;
      return apiClient(original);
    } catch {
      throw error;
    }
  },
);
