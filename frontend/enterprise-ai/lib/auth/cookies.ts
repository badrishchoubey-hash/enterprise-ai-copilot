import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
const isProduction = process.env.NODE_ENV === "production";
export const accessCookie = "nexa_access";
export const refreshCookie = "nexa_refresh";
export const roleCookie = "nexa_role";
const baseCookie = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
};

function expirationSeconds(expiresIn: string | number): number {
  if (typeof expiresIn === "number") return Math.max(0, Math.floor(expiresIn));
  const match = expiresIn.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 24 * 60 * 60;
  const amount = Number(match[1]);
  const multiplier = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60 }[
    match[2] as "s" | "m" | "h" | "d"
  ];
  return amount * multiplier;
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  expiresIn: string | number,
  role?: string,
) {
  const maxAge = expirationSeconds(expiresIn);
  response.cookies.set(accessCookie, accessToken, { ...baseCookie, maxAge });
  response.cookies.set(refreshCookie, refreshToken, {
    ...baseCookie,
    maxAge: 7 * 24 * 60 * 60,
  });
  if (role) {
    response.cookies.set(roleCookie, role, { ...baseCookie, maxAge });
  }
}
export async function getRefreshToken() {
  return (await cookies()).get(refreshCookie)?.value;
}
export async function getAccessToken() {
  return (await cookies()).get(accessCookie)?.value;
}
export async function getRoleCookie() {
  return (await cookies()).get(roleCookie)?.value;
}
export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(accessCookie, "", { ...baseCookie, maxAge: 0 });
  response.cookies.set(refreshCookie, "", { ...baseCookie, maxAge: 0 });
  response.cookies.set(roleCookie, "", { ...baseCookie, maxAge: 0 });
}
