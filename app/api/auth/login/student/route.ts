import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { getSupabaseConfig, getAuthAppUrl } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";
import { isAllowedStudentEmail } from "@/lib/auth/student-email-policy";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

const magicLinkSchema = z.object({
  email: z.string().email()
});

const getCallbackUrl = (req: Request) => {
  const explicit = getAuthAppUrl();
  const origin = explicit ?? new URL(req.url).origin;
  return new URL("/auth/callback", origin).toString();
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = magicLinkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  if (!isAllowedStudentEmail(parsed.data.email)) {
    return NextResponse.json({ ok: false, error: "invalid_student_email_domain" }, { status: 400 });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 });
  }

  const cookieAccumulator = buildCookieAccumulator();

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return parseRequestCookies(req.headers.get("cookie"));
      },
      setAll(cookiesToSet: SupabaseCookie[]) {
        cookieAccumulator.push(cookiesToSet);
      }
    }
  });

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: getCallbackUrl(req),
      shouldCreateUser: true,
      data: {
        role: "student",
        stu_persona: "student"
      }
    }
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "magic_link_send_failed" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  cookieAccumulator.apply(response);
  response.headers.set("x-stu-login-email", parsed.data.email);
  response.headers.set("x-stu-persona", "student");
  return response;
}
