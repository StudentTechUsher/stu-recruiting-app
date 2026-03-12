import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { getProfileByUserId } from "@/lib/auth/profile";
import { resolvePersonaFromProfileOrUser } from "@/lib/auth/role";
import { getHomeRouteForPersona } from "@/lib/session-routing";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";
import { isRefreshTokenNotFoundError } from "@/lib/supabase/auth-session";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const safeSignOut = async (supabase: { auth: { signOut: () => Promise<{ error: unknown }> } }) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error && !isRefreshTokenNotFoundError(error)) {
      throw error;
    }
  } catch (error) {
    if (!isRefreshTokenNotFoundError(error)) {
      throw error;
    }
  }
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 400 });
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

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  const profile = await getProfileByUserId(supabase, data.user.id);
  const persona = resolvePersonaFromProfileOrUser(profile?.role, data.user);
  if (!persona) {
    await safeSignOut(supabase);
    return NextResponse.json({ ok: false, error: "role_unassigned" }, { status: 403 });
  }
  if (persona === "student") {
    await safeSignOut(supabase);
    return NextResponse.json({ ok: false, error: "use_student_magic_link" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, redirectPath: getHomeRouteForPersona(persona) });
  cookieAccumulator.apply(response);
  response.headers.set("x-stu-login-email", parsed.data.email);
  response.headers.set("x-stu-persona", persona);
  return response;
}
