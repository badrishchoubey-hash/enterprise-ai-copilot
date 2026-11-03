import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { backendApiFetch } from "@/lib/auth/backend";

export const maxDuration = 90;

export async function POST(request: Request) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Sign in to ask a question.", code: "AUTHENTICATION_REQUIRED" },
      { status: 401 },
    );
  }

  try {
    const body: unknown = await request.json();
    const upstream = await backendApiFetch("ai/ask", accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(Number(process.env.BACKEND_AI_REQUEST_TIMEOUT_MS) || 85_000),
      ]),
    });
    const payload: unknown = await upstream.json().catch(() => ({
      error: "The answer service returned an invalid response.",
    }));
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "The AI request timed out. Try again shortly.", code: "AI_PROXY_TIMEOUT" },
        { status: 504, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      {
        error: "The answer service is temporarily unavailable. Try again shortly.",
        code: "AI_SERVICE_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
