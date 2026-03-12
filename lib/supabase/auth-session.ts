import type { NextResponse } from "next/server";

const REFRESH_TOKEN_NOT_FOUND_CODE = "refresh_token_not_found";
const refreshTokenMessagePattern = /invalid refresh token|refresh token not found/i;

const toErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "";
  const maybeMessage = (error as { message?: unknown }).message;
  return typeof maybeMessage === "string" ? maybeMessage : "";
};

const toErrorCode = (error: unknown) => {
  if (!error || typeof error !== "object") return "";
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "string" ? maybeCode : "";
};

export const isRefreshTokenNotFoundError = (error: unknown) => {
  const code = toErrorCode(error);
  if (code.toLowerCase() === REFRESH_TOKEN_NOT_FOUND_CODE) return true;
  return refreshTokenMessagePattern.test(toErrorMessage(error));
};

export const isSupabaseAuthCookie = (cookieName: string) => {
  return cookieName.startsWith("sb-") && (cookieName.includes("-auth-token") || cookieName.includes("-code-verifier"));
};

export const clearSupabaseAuthCookies = (cookies: Array<{ name: string }>, response: NextResponse) => {
  cookies.forEach(({ name }) => {
    if (!isSupabaseAuthCookie(name)) return;
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  });
};
