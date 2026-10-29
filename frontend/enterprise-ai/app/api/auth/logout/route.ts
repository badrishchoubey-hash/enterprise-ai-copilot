import { NextResponse } from "next/server";
import { backendLogout } from "@/lib/auth/backend";
import { clearAuthCookies, getRefreshToken } from "@/lib/auth/cookies";
export async function POST() {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await backendLogout(refreshToken);
    } catch {
      /* Clear local session even if the backend is unavailable. */
    }
  }
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
