import type { NextResponse } from "next/server";

type CookieRecord = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export function parseRequestCookies(cookieHeader: string | null): Array<{ name: string; value: string }> {
  if (!cookieHeader) return [];

  return cookieHeader
    .split(";")
    .map((part) => {
      const [name, ...rest] = part.trim().split("=");
      return { name, value: rest.join("=") };
    })
    .filter((cookie) => cookie.name.length > 0);
}

export function buildCookieAccumulator() {
  const pending: CookieRecord[] = [];

  return {
    push(cookies: CookieRecord[]) {
      pending.push(...cookies);
    },
    apply(response: NextResponse) {
      pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options as never));
    }
  };
}
