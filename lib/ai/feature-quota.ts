const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const defaultAIFeatureMaxUses = parsePositiveInt(process.env.AI_FEATURE_MAX_USES, 5);
const inMemoryAIFeatureUsage = new Map<string, number>();

type QuotaRpcRow = {
  allowed?: unknown;
  used_count?: unknown;
  remaining?: unknown;
};

type SupabaseRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export type AIFeatureQuotaDecision = {
  allowed: boolean;
  used: number;
  remaining: number;
  maxUses: number;
  source: "supabase" | "memory";
};

const normalizeFeatureKey = (featureKey: string) => featureKey.trim().toLowerCase();

const toNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const consumeFromMemoryQuota = ({
  userId,
  featureKey,
  maxUses
}: {
  userId: string;
  featureKey: string;
  maxUses: number;
}): AIFeatureQuotaDecision => {
  const key = `${userId}:${featureKey}`;
  const currentCount = inMemoryAIFeatureUsage.get(key) ?? 0;
  if (currentCount >= maxUses) {
    return {
      allowed: false,
      used: currentCount,
      remaining: 0,
      maxUses,
      source: "memory"
    };
  }

  const nextCount = currentCount + 1;
  inMemoryAIFeatureUsage.set(key, nextCount);
  return {
    allowed: true,
    used: nextCount,
    remaining: Math.max(maxUses - nextCount, 0),
    maxUses,
    source: "memory"
  };
};

const consumeFromSupabaseQuota = async ({
  featureKey,
  maxUses,
  supabase
}: {
  featureKey: string;
  maxUses: number;
  supabase: SupabaseRpcClient;
}): Promise<AIFeatureQuotaDecision | null> => {
  try {
    const { data, error } = await supabase.rpc("consume_ai_feature_quota", {
      p_feature_key: featureKey,
      p_max_uses: maxUses
    });

    if (error || !Array.isArray(data) || data.length === 0) return null;
    const row = (data[0] ?? {}) as QuotaRpcRow;
    const used = Math.max(0, toNumber(row.used_count, 0));
    const remaining = Math.max(0, toNumber(row.remaining, Math.max(maxUses - used, 0)));

    return {
      allowed: row.allowed === true,
      used,
      remaining,
      maxUses,
      source: "supabase"
    };
  } catch {
    return null;
  }
};

export async function consumeAIFeatureQuota({
  userId,
  featureKey,
  maxUses = defaultAIFeatureMaxUses,
  supabase
}: {
  userId: string;
  featureKey: string;
  maxUses?: number;
  supabase?: unknown | null;
}): Promise<AIFeatureQuotaDecision> {
  const normalizedUserId = userId.trim();
  const normalizedFeatureKey = normalizeFeatureKey(featureKey);
  if (!normalizedUserId || !normalizedFeatureKey) {
    throw new Error("ai_feature_quota_invalid_input");
  }

  const safeMaxUses = Number.isFinite(maxUses) && maxUses > 0 ? Math.floor(maxUses) : defaultAIFeatureMaxUses;
  const supabaseClient = supabase as SupabaseRpcClient | null | undefined;
  if (supabaseClient && typeof supabaseClient.rpc === "function") {
    const decision = await consumeFromSupabaseQuota({
      featureKey: normalizedFeatureKey,
      maxUses: safeMaxUses,
      supabase: supabaseClient
    });
    if (decision) return decision;
  }

  return consumeFromMemoryQuota({
    userId: normalizedUserId,
    featureKey: normalizedFeatureKey,
    maxUses: safeMaxUses
  });
}

export const resetAIFeatureQuotaStateForTests = () => {
  inMemoryAIFeatureUsage.clear();
};
