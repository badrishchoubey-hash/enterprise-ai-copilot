import { apiClient } from "./axios";
import type { UserProfile, UserProfileResponse } from "@/lib/auth/types";

export async function getMyProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfileResponse>("/v1/user/profile");
  return data.data;
}
