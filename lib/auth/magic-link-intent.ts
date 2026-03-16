import type { NextResponse } from "next/server";

export type MagicLinkIntentPersona = "student" | "recruiter";

export const magicLinkIntentCookieName = "stu-magic-link-intent";

const normalizeIntent = (value: string | null | undefined): MagicLinkIntentPersona | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "student") return "student";
  if (normalized === "recruiter") return "recruiter";
  return null;
};

const parseCookieHeader = (cookieHeader: string | null) => {
  if (!cookieHeader) return new Map<string, string>();

  const cookies = new Map<string, string>();
  cookieHeader.split(";").forEach((part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return;
    cookies.set(name, decodeURIComponent(rest.join("=")));
  });

  return cookies;
};

export const resolveMagicLinkIntentFromCookieHeader = (cookieHeader: string | null): MagicLinkIntentPersona | null => {
  const cookies = parseCookieHeader(cookieHeader);
  return normalizeIntent(cookies.get(magicLinkIntentCookieName));
};

export const getMagicLinkLoginPathForPersona = (persona: MagicLinkIntentPersona) => {
  if (persona === "recruiter") return "/login/recruiter";
  return "/login/student";
};

export const applyMagicLinkIntentCookie = (response: NextResponse, persona: MagicLinkIntentPersona) => {
  response.cookies.set(magicLinkIntentCookieName, persona, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 30
  });
};

export const clearMagicLinkIntentCookie = (response: NextResponse) => {
  response.cookies.set(magicLinkIntentCookieName, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
};
