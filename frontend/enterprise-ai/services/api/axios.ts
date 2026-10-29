import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { AuthErrorResponse } from "@/lib/auth/types";
export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
let refreshPromise: Promise<void> | null = null;
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers.set("X-Requested-With", "XMLHttpRequest");
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<AuthErrorResponse>) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      original.url?.includes("/auth/refresh")
    )
      throw error;
    original._retry = true;
    refreshPromise ??= apiClient
      .post("/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
    try {
      await refreshPromise;
      return apiClient(original);
    } catch {
      throw error;
    }
  },
);
