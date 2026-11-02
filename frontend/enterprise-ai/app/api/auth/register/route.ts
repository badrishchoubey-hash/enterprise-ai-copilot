import { NextResponse } from "next/server";
import {
  backendError,
  backendRegister,
  backendStatus,
} from "@/lib/auth/backend";
import { setAuthCookies } from "@/lib/auth/cookies";
export async function POST(request: Request) {
  try {
    const result = await backendRegister(await request.json());
    const response = NextResponse.json({ user: result.user }, { status: 201 });
    setAuthCookies(
      response,
      result.tokens.accessToken,
      result.tokens.refreshToken,
      result.tokens.expiresIn,
      result.user.role,
    );
    return response;
  } catch (error) {
    return NextResponse.json(backendError(error), {
      status: backendStatus(error),
    });
  }
}
