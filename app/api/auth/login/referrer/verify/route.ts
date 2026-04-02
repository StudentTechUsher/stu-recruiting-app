import { verifyMagicLinkCode } from "@/lib/auth/magic-link-code-verify";

export async function POST(request: Request) {
  return verifyMagicLinkCode({ request, persona: "referrer" });
}
