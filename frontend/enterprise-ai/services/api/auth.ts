import { apiClient } from "./axios";
import type { SessionResponse } from "@/lib/auth/types";
export interface SignInInput {
  email: string;
  password: string;
}
export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  role: "employee" | "support_agent" | "admin";
  department?: string;
}
export async function signIn(input: SignInInput) {
  const { data } = await apiClient.post<SessionResponse>("/auth/login", input);
  return data;
}
export async function signUp(input: SignUpInput) {
  const { data } = await apiClient.post<SessionResponse>(
    "/auth/register",
    input,
  );
  return data;
}
export async function signOut() {
  await apiClient.post("/auth/logout");
}
