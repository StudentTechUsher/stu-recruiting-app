import { NextResponse } from "next/server";
import { z } from "zod";
import { applyDevIdentityCookie, isDevIdentitiesEnabled } from "@/lib/dev-auth";
import { getHomeRouteForPersona } from "@/lib/session-routing";
import type { Persona } from "@/lib/route-policy";

const devLoginQuerySchema = z.object({
  persona: z.enum(["student", "recruiter", "org_admin", "referrer"]).default("student")
});

const resolveSafeRedirectPath = (value: string | null, fallback: string) => {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
};

const parsePersona = (value: unknown): Persona => {
  const parsed = devLoginQuerySchema.safeParse({ persona: value });
  return parsed.success ? parsed.data.persona : "student";
};

export async function GET(req: Request) {
  if (!isDevIdentitiesEnabled()) {
    return NextResponse.json({ ok: false, error: "dev_identities_disabled" }, { status: 404 });
  }

  const url = new URL(req.url);
  const persona = parsePersona(url.searchParams.get("persona"));
  const redirectPath = resolveSafeRedirectPath(url.searchParams.get("redirect_to"), getHomeRouteForPersona(persona));
  const response = NextResponse.redirect(new URL(redirectPath, req.url), 303);
  applyDevIdentityCookie(response, persona);
  return response;
}

export async function POST(req: Request) {
  if (!isDevIdentitiesEnabled()) {
    return NextResponse.json({ ok: false, error: "dev_identities_disabled" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const persona = parsePersona((body as Record<string, unknown>).persona);
  const redirectPath = getHomeRouteForPersona(persona);
  const response = NextResponse.json({ ok: true, redirectPath, persona });
  applyDevIdentityCookie(response, persona);
  return response;
}
