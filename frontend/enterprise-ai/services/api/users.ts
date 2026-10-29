import { apiClient } from "./axios";
import type { UserProfile, UserProfileResponse } from "@/lib/auth/types";

export async function getMyProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfileResponse>("/users/profile");
  return data.data;
}
