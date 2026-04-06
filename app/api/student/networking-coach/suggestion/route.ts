import { createHash } from "node:crypto";
import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { consumeAIFeatureQuota } from "@/lib/ai/feature-quota";
import { hasPersona } from "@/lib/authorization";
import {
  attachRequestIdHeader,
  createApiObsContext,
  toActorSurrogate,
  type ObsOutcome,
} from "@/lib/observability/api";
import {
  buildFallbackPayload,
  enforceGeneratedPayload,
  projectArtifactsForNetworking,
  rankArtifactsForTargets,
  rankConnectionsForTargets,
  toAbsoluteShareUrl,
  toCanonicalSharePath,
} from "@/lib/networking/coach";
import { getConnectionsBaseline } from "@/lib/networking/connections";
import { OpenAINetworkingError, callOpenAINetworkingSuggestion } from "@/lib/networking/openai";
import type { ActiveTarget } from "@/lib/networking/types";
import { parseActiveCapabilityProfiles } from "@/lib/student/capability-targeting";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type StudentRow = { student_data: unknown };
type ShareLinkRow = { share_slug: string | null };
type ArtifactRow = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: unknown;
  updated_at: string | null;
  is_active: boolean | null;
};

const ROUTE_TEMPLATE = "/api/student/networking-coach/suggestion";
const OPENAI_MODEL_DEFAULT = "gpt-5-mini";

export const maxDuration = 60;

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const buildShareSlugFallback = (profileId: string): string => {
  const suffix = createHash("sha256").update(profileId).digest("hex").slice(0, 8);
  return `student-${suffix}`;
};

const resolveShareSlug = async ({
  currentSlug,
  profileId,
  supabase,
}: {
  currentSlug: string;
  profileId: string;
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
}): Promise<string> => {
  if (currentSlug) return currentSlug;
  if (!supabase) return buildShareSlugFallback(profileId);

  const fallback = buildShareSlugFallback(profileId);
  await supabase
    .from("student_share_links")
    .upsert({ profile_id: profileId, share_slug: fallback }, { onConflict: "profile_id" });

  const { data } = (await supabase
    .from("student_share_links")
    .select("share_slug")
    .eq("profile_id", profileId)
    .limit(1)) as { data: ShareLinkRow[] | null };
  return toTrimmedString(data?.[0]?.share_slug) || fallback;
};

const normalizePayload = (value: unknown): { refresh: boolean } => {
  const payload = toRecord(value);
  return {
    refresh: payload.refresh === true,
  };
};

export async function POST(req: Request) {
  const obs = createApiObsContext({
    request: req,
    routeTemplate: ROUTE_TEMPLATE,
    component: "student_networking_coach",
    operation: "generate_suggestion",
  });
  obs.recordStart({
    eventName: "student.networking_coach.generate.started",
    persona: "student",
  });

  const finalize = ({
    response,
    outcome,
    errorCode,
    persona,
    orgId,
    actorIdSurrogate,
    details,
    sentryEventId,
  }: {
    response: Response;
    outcome: ObsOutcome;
    errorCode?: string;
    persona?: string;
    orgId?: string;
    actorIdSurrogate?: string;
    details?: Record<string, unknown>;
    sentryEventId?: string;
  }) => {
    attachRequestIdHeader(response, obs.requestId);
    obs.recordResult({
      statusCode: response.status,
      eventName: "student.networking_coach.generate.result",
      outcome,
      errorCode,
      persona,
      orgId,
      actorIdSurrogate,
      details,
      sentryEventId,
    });
    return response;
  };

  const context = await getAuthContext();
  const actorSurrogate = context.authenticated ? toActorSurrogate(context.user_id) : undefined;
  if (!hasPersona(context, ["student"])) {
    return finalize({
      response: forbidden(),
      outcome: "handled_failure",
      errorCode: "forbidden",
      persona: context.persona ?? undefined,
      orgId: context.org_id ?? undefined,
      actorIdSurrogate: actorSurrogate,
    });
  }

  const payload = normalizePayload(await req.json().catch(() => null));
  const supabase = await getSupabaseServerClient();

  try {
    const quota = await consumeAIFeatureQuota({
      userId: context.user_id,
      featureKey: "networking_suggestion",
      supabase,
    });
    if (!quota.allowed) {
      const response = Response.json(
        {
          ok: false,
          error: "ai_feature_quota_exceeded",
          feature: "networking_suggestion",
          remaining: quota.remaining,
          max_uses: quota.maxUses,
        },
        { status: 429 }
      );
      return finalize({
        response,
        outcome: "handled_failure",
        errorCode: "ai_feature_quota_exceeded",
        persona: "student",
        orgId: context.org_id ?? undefined,
        actorIdSurrogate: actorSurrogate,
      });
    }

    const [studentQuery, artifactQuery, shareQuery] = (await Promise.all([
      supabase?.from("students").select("student_data").eq("profile_id", context.user_id).limit(1),
      supabase
        ?.from("artifacts")
        .select("artifact_id, artifact_type, artifact_data, updated_at, is_active")
        .eq("profile_id", context.user_id)
        .order("updated_at", { ascending: false }),
      supabase?.from("student_share_links").select("share_slug").eq("profile_id", context.user_id).limit(1),
    ])) as [
      { data: StudentRow[] | null } | null,
      { data: ArtifactRow[] | null } | null,
      { data: ShareLinkRow[] | null } | null,
    ];

    const studentData = toRecord(studentQuery?.data?.[0]?.student_data);
    const activeTargets = parseActiveCapabilityProfiles(studentData.active_capability_profiles) as ActiveTarget[];
    if (activeTargets.length === 0) {
      return finalize({
        response: badRequest("no_active_targets"),
        outcome: "handled_failure",
        errorCode: "no_active_targets",
        persona: "student",
        orgId: context.org_id ?? undefined,
        actorIdSurrogate: actorSurrogate,
      });
    }

    const connections = await getConnectionsBaseline();
    if (!connections || connections.length === 0) {
      const response = Response.json({ ok: false, error: "connections_baseline_unavailable" }, { status: 503 });
      return finalize({
        response,
        outcome: "failure",
        errorCode: "connections_baseline_unavailable",
        persona: "student",
        orgId: context.org_id ?? undefined,
        actorIdSurrogate: actorSurrogate,
      });
    }

    const projectedArtifacts = projectArtifactsForNetworking(artifactQuery?.data ?? []);
    const topArtifacts = rankArtifactsForTargets({
      artifacts: projectedArtifacts,
      targets: activeTargets,
      limit: 5,
    });
    const rankedConnections = rankConnectionsForTargets({
      connections,
      targets: activeTargets,
      topArtifacts,
      limit: 40,
    });
    const selectedFallbackConnection = rankedConnections[0];

    if (!selectedFallbackConnection) {
      const response = Response.json({ ok: false, error: "connections_baseline_unavailable" }, { status: 503 });
      return finalize({
        response,
        outcome: "failure",
        errorCode: "connections_baseline_unavailable",
        persona: "student",
        orgId: context.org_id ?? undefined,
        actorIdSurrogate: actorSurrogate,
      });
    }

    const rawShareSlug = toTrimmedString(shareQuery?.data?.[0]?.share_slug);
    const shareSlug = await resolveShareSlug({
      currentSlug: rawShareSlug,
      profileId: context.user_id,
      supabase,
    });
    const publicProfilePath = toCanonicalSharePath(shareSlug);
    const publicProfileUrl = toAbsoluteShareUrl({
      sharePath: publicProfilePath,
      appUrl: process.env.APP_URL,
      requestOrigin: new URL(req.url).origin,
    });

    const fallbackPayload = enforceGeneratedPayload({
      payload: buildFallbackPayload({
        selectedConnection: selectedFallbackConnection,
        primaryTarget: activeTargets[0],
        artifacts: topArtifacts,
        profileUrl: publicProfileUrl,
      }),
      profileUrl: publicProfileUrl,
    });

    let source: "openai" | "fallback" = "fallback";
    let fallbackReason: string | undefined = payload.refresh ? "refresh_requested" : undefined;
    let selectedPayload = fallbackPayload;
    let selectedContactUrl = selectedFallbackConnection.url;
    let model = process.env.OPENAI_NETWORKING_MODEL?.trim() || OPENAI_MODEL_DEFAULT;
    let observabilityOutcome: ObsOutcome = "success";

    try {
      const openAIResult = await callOpenAINetworkingSuggestion({
        candidatePool: rankedConnections.map((connection) => ({
          name: connection.name,
          headline: connection.headline,
          url: connection.url,
        })),
        topArtifacts,
        primaryTarget: {
          role_label: activeTargets[0].role_label,
          company_label: activeTargets[0].company_label,
        },
        publicProfileUrl,
      });
      model = openAIResult.model;
      const normalized = enforceGeneratedPayload({
        payload: openAIResult.payload,
        profileUrl: publicProfileUrl,
      });
      const allowedUrls = new Set(rankedConnections.map((connection) => connection.url));
      if (!allowedUrls.has(normalized.selected_url)) {
        throw new OpenAINetworkingError("openai_selected_url_not_in_pool", "Selected URL was not in candidate pool.");
      }
      selectedPayload = normalized;
      selectedContactUrl = normalized.selected_url;
      source = "openai";
      fallbackReason = undefined;
      observabilityOutcome = "success";
    } catch (error) {
      source = "fallback";
      const fallbackCode = error instanceof OpenAINetworkingError ? error.code : "openai_unknown_failure";
      fallbackReason = fallbackCode;
      observabilityOutcome = fallbackCode === "openai_timeout" ? "timeout" : "handled_failure";
    }

    const selectedContact =
      rankedConnections.find((connection) => connection.url === selectedContactUrl) ?? selectedFallbackConnection;
    const response = ok({
      suggestion: {
        name: selectedContact.name,
        headline: selectedContact.headline,
        url: selectedContact.url,
        rationale: selectedPayload.rationale,
        target_role: activeTargets[0].role_label,
        target_company: activeTargets[0].company_label,
      },
      messages: {
        invite_message: selectedPayload.invite_message,
        follow_up_message: selectedPayload.follow_up_message,
        public_profile_path: publicProfilePath,
        public_profile_url: publicProfileUrl,
      },
      context_used: {
        active_targets: activeTargets.map((target, index) => ({
          capability_profile_id: target.capability_profile_id,
          role_label: target.role_label,
          company_label: target.company_label,
          priority_label: index === 0 ? "primary" : "secondary",
        })),
        artifacts: topArtifacts.map((artifact) => ({
          artifact_id: artifact.artifact_id,
          title: artifact.title,
        })),
      },
      generation: {
        source,
        model,
        elapsed_ms: Date.now() - obs.startedAtMs,
        ...(fallbackReason ? { fallback_reason: fallbackReason } : {}),
      },
    });

    return finalize({
      response,
      outcome: observabilityOutcome,
      persona: "student",
      orgId: context.org_id ?? undefined,
      actorIdSurrogate: actorSurrogate,
      details: {
        candidate_pool_size: rankedConnections.length,
        artifact_count: topArtifacts.length,
        selected_contact_url: selectedContact.url,
        fallback_used: source === "fallback",
        fallback_reason: fallbackReason ?? null,
        model,
        elapsed_ms: Date.now() - obs.startedAtMs,
      },
    });
  } catch (error) {
    const sentryEventId = obs.recordUnexpected({
      eventName: "student.networking_coach.generate.failed",
      error,
      persona: "student",
      orgId: context.org_id ?? undefined,
      actorIdSurrogate: actorSurrogate,
      errorCode: "networking_coach_unexpected_failure",
    });
    return finalize({
      response: Response.json({ ok: false, error: "networking_coach_unexpected_failure" }, { status: 500 }),
      outcome: "unexpected_failure",
      errorCode: "networking_coach_unexpected_failure",
      persona: "student",
      orgId: context.org_id ?? undefined,
      actorIdSurrogate: actorSurrogate,
      sentryEventId,
    });
  }
}

