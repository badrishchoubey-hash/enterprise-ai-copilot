import { NextResponse } from "next/server";
import { backendError, backendRefresh } from "@/lib/auth/backend";
import {
  getRefreshToken,
  getRoleCookie,
  setAuthCookies,
} from "@/lib/auth/cookies";
export async function POST() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken)
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  try {
    const tokens = await backendRefresh(refreshToken);
    const response = NextResponse.json({ ok: true });
    setAuthCookies(
      response,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresIn,
      await getRoleCookie(),
    );
    return response;
  } catch (error) {
    return NextResponse.json(backendError(error), { status: 401 });
  }
}
