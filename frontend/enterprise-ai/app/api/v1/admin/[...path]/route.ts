import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/cookies";
import { backendAdminFetch } from "@/lib/auth/backend";

type AdminRouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyAdminRequest(
  request: Request,
  context: AdminRouteContext,
): Promise<NextResponse> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Authentication required.", code: "AUTHENTICATION_REQUIRED" },
      { status: 401 },
    );
  }

  try {
    const { path } = await context.params;
    const encodedPath = path.map(encodeURIComponent).join("/");
    const requestUrl = new URL(request.url);
    const query = requestUrl.search;
    const method = request.method.toUpperCase();
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    let body: BodyInit | undefined;

    if (method !== "GET" && method !== "HEAD") {
      if (contentType?.toLowerCase().startsWith("multipart/form-data")) {
        const incoming = await request.formData();
        const outgoing = new FormData();
        for (const [field, value] of incoming.entries()) {
          if (typeof value === "string") outgoing.append(field, value);
          else outgoing.append(field, value, value.name);
        }
        body = outgoing;
      } else if (contentType?.toLowerCase().includes("application/json")) {
        headers.set("content-type", "application/json");
        body = JSON.stringify(await request.json());
      } else if (request.body) {
        if (contentType) headers.set("content-type", contentType);
        body = await request.arrayBuffer();
      }
    }

    const upstream = await backendAdminFetch(
      `${encodedPath}${query}`,
      accessToken,
      { method, headers, body },
    );
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of [
      "content-type",
      "content-disposition",
      "content-length",
    ]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      {
        error: "The admin service is temporarily unavailable.",
        code: "ADMIN_SERVICE_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}

export const GET = proxyAdminRequest;
export const POST = proxyAdminRequest;
export const PATCH = proxyAdminRequest;
export const DELETE = proxyAdminRequest;
