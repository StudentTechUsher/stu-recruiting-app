import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

export async function POST(req: Request) {
  const response = NextResponse.redirect(new URL("/", req.url), 303);
  const config = getSupabaseConfig();

  if (!config) {
    return response;
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

  await supabase.auth.signOut();
  cookieAccumulator.apply(response);
  return response;
}
