import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok } from "@/lib/api-response";
import { consumeAIFeatureQuota } from "@/lib/ai/feature-quota";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();
  return ok({ resource: "interview_sessions", context });
}

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();
  const supabase = await getSupabaseServerClient();
  const quota = await consumeAIFeatureQuota({
    userId: context.user_id,
    featureKey: "interview_prep_session",
    supabase
  });
  if (!quota.allowed) {
    return Response.json(
      {
        ok: false,
        error: "ai_feature_quota_exceeded",
        feature: "interview_prep_session",
        remaining: quota.remaining,
        max_uses: quota.maxUses
      },
      { status: 429 }
    );
  }
  const payload = await req.json().catch(() => null);
  return ok({ resource: "interview_sessions", context, payload, status: "created" });
}
