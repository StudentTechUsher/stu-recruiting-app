import { NextResponse } from "next/server";
import { getAuthCapabilities } from "@/lib/auth/passkeys";

export async function GET() {
  return NextResponse.json({ ok: true, capabilities: getAuthCapabilities() });
}
