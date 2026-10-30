import { NextResponse } from "next/server";
import { backendError, backendGetProfile } from "@/lib/auth/backend";
import { getAccessToken } from "@/lib/auth/cookies";

export async function GET() {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    return NextResponse.json(await backendGetProfile(accessToken));
  } catch (error) {
    const response = backendError(error);
    const status =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof error.response === "object" &&
      error.response !== null &&
      "status" in error.response &&
      typeof error.response.status === "number"
        ? error.response.status
        : 500;
    return NextResponse.json(response, { status });
  }
}
