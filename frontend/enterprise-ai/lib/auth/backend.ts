import axios from "axios";
import type { AuthResponse, UserProfileResponse } from "./types";
const backendAuth = axios.create({
  baseURL: process.env.BACKEND_URL ?? "http://localhost:5000/api",
  timeout: 10_000,
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
  if (axios.isAxiosError(error))
    return {
      error: error.response?.data?.error ?? "Authentication request failed.",
    };
  return { error: "Authentication service is unavailable." };
}
