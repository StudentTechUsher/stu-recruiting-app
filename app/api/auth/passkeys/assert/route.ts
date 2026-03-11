import { NextResponse } from "next/server";
import { isPasskeysEnabled } from "@/lib/auth/passkeys";

export async function POST() {
  if (!isPasskeysEnabled()) {
    return NextResponse.json({ ok: false, error: "passkeys_disabled" }, { status: 503 });
  }

  return NextResponse.json({ ok: false, error: "passkeys_not_implemented" }, { status: 501 });
}
