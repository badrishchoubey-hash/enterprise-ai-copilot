import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
type UserRole = "employee" | "support_agent" | "admin";
function isUserRole(value: string | undefined): value is UserRole {
  return value === "admin" || value === "employee" || value === "support_agent";
}
async function readRole(token: string): Promise<UserRole | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    );
    return payload.role === "admin" ||
      payload.role === "employee" ||
      payload.role === "support_agent"
      ? payload.role
      : null;
  } catch {
    return null;
  }
}
export async function middleware(request: NextRequest) {
  const token = request.cookies.get("nexa_access")?.value;
  const storedRole = request.cookies.get("nexa_role")?.value;
  const pathname = request.nextUrl.pathname;
  if (!token) return NextResponse.redirect(new URL("/signin", request.url));
  const role = process.env.JWT_SECRET
    ? await readRole(token)
    : isUserRole(storedRole)
      ? storedRole
      : null;
  if (!role) {
    const response = NextResponse.redirect(new URL("/signin", request.url));
    response.cookies.delete("nexa_access");
    response.cookies.delete("nexa_refresh");
    response.cookies.delete("nexa_role");
    return response;
  }
  if (pathname.startsWith("/dashboard") && role !== "admin")
    return NextResponse.redirect(new URL("/workspace", request.url));
  if (pathname.startsWith("/workspace") && role === "admin")
    return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/dashboard/:path*", "/workspace/:path*"] };
