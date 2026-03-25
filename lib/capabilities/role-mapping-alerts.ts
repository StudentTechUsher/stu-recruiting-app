import { sendEmailViaResend } from "@/lib/mailer/resend";

const defaultRoleMappingAlertRecipient = "vin@stuplanning.com";

const normalizeEnvValue = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

const normalizeRoleName = (value: string): string => value.trim().replace(/\s+/g, " ");
const normalizeRoleNameKey = (value: string): string => normalizeRoleName(value).toLowerCase();

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asPositiveInteger = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.floor(value);
  return 0;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getRoleMappingAlertRecipient = () =>
  normalizeEnvValue(process.env.ROLE_MAPPING_ALERT_TO) ?? defaultRoleMappingAlertRecipient;

const getRoleMappingAlertWebhookUrl = () => normalizeEnvValue(process.env.ROLE_MAPPING_ALERT_WEBHOOK_URL);

const sendRoleMappingAlertWebhook = async ({
  webhookUrl,
  roleName,
  roleNameNormalized,
  detectedByProfileId,
  sourceFlow,
  detectedAt,
}: {
  webhookUrl: string;
  roleName: string;
  roleNameNormalized: string;
  detectedByProfileId: string | null;
  sourceFlow: string;
  detectedAt: string;
}) => {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event: "unmapped_role_detected",
      role_name: roleName,
      role_name_normalized: roleNameNormalized,
      source_flow: sourceFlow,
      detected_by_profile_id: detectedByProfileId,
      detected_at: detectedAt,
    }),
  });

  if (!response.ok) {
    throw new Error(`role_mapping_alert_webhook_failed:${response.status}`);
  }
};

const sendRoleMappingAlertEmail = async ({
  to,
  roleName,
  roleNameNormalized,
  detectedByProfileId,
  sourceFlow,
  detectedAt,
}: {
  to: string;
  roleName: string;
  roleNameNormalized: string;
  detectedByProfileId: string | null;
  sourceFlow: string;
  detectedAt: string;
}) => {
  const subject = `[Stu Recruiting] New unmapped role detected: ${roleName}`;
  const safeRoleName = escapeHtml(roleName);
  const safeRoleNameNormalized = escapeHtml(roleNameNormalized);
  const safeSourceFlow = escapeHtml(sourceFlow);
  const safeDetectedByProfileId = escapeHtml(detectedByProfileId ?? "unknown");
  const safeDetectedAt = escapeHtml(detectedAt);

  const text = [
    "A new role was entered without an explicit role-capability mapping.",
    "",
    `Role: ${roleName}`,
    `Role (normalized): ${roleNameNormalized}`,
    `Source flow: ${sourceFlow}`,
    `Detected by profile_id: ${detectedByProfileId ?? "unknown"}`,
    `Detected at (UTC): ${detectedAt}`,
    "",
    "Action required: add capability_ids mapping for this role in job_roles.role_data.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0a1f1a; line-height: 1.5;">
      <p style="margin: 0 0 12px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #476a5d;">
        Stu role mapping alert
      </p>
      <h1 style="margin: 0 0 14px; font-size: 22px;">New unmapped role detected</h1>
      <div style="margin: 0 0 16px; padding: 14px; border: 1px solid #d2dfd9; border-radius: 12px; background: #f8fcfa;">
        <p style="margin: 0 0 6px;"><strong>Role:</strong> ${safeRoleName}</p>
        <p style="margin: 0 0 6px;"><strong>Role (normalized):</strong> ${safeRoleNameNormalized}</p>
        <p style="margin: 0 0 6px;"><strong>Source flow:</strong> ${safeSourceFlow}</p>
        <p style="margin: 0 0 6px;"><strong>Detected by profile_id:</strong> ${safeDetectedByProfileId}</p>
        <p style="margin: 0;"><strong>Detected at (UTC):</strong> ${safeDetectedAt}</p>
      </div>
      <p style="margin: 0;">
        Action required: add capability_ids mapping for this role in <code>job_roles.role_data</code>.
      </p>
    </div>
  `.trim();

  await sendEmailViaResend({
    to,
    subject,
    text,
    html,
    idempotencyKey: `role-mapping-alert-${roleNameNormalized}`,
    tags: [
      { name: "workflow", value: "role-mapping-alert" },
      { name: "role_name_normalized", value: roleNameNormalized.slice(0, 64) },
    ],
  });
};

export async function notifyOnNewRoleForMapping({
  supabase,
  roleName,
  detectedByProfileId,
  sourceFlow,
}: {
  supabase: unknown;
  roleName: string;
  detectedByProfileId?: string | null;
  sourceFlow: "student_profile_update" | "student_onboarding";
}) {
  const normalizedRoleName = normalizeRoleName(roleName);
  if (normalizedRoleName.length === 0) return;

  const normalizedRoleNameKey = normalizeRoleNameKey(normalizedRoleName);
  const profileId = asTrimmedString(detectedByProfileId ?? null);
  const nowIso = new Date().toISOString();
  const client = supabase as {
    from?: (table: string) => {
      select?: (columns: string) => {
        eq?: (column: string, value: string) => {
          limit?: (count: number) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
      update?: (payload: Record<string, unknown>) => {
        eq?: (column: string, value: string) => Promise<{ error: unknown }>;
      };
    };
  };
  const from = client.from;
  if (typeof from !== "function") return;
  const jobRolesQuery = from("job_roles");
  if (!jobRolesQuery || typeof jobRolesQuery.select !== "function") return;
  const selected = jobRolesQuery.select("role_id, role_name, role_data");
  if (!selected || typeof selected.eq !== "function") return;
  const selectedByRole = selected.eq("role_name_normalized", normalizedRoleNameKey);
  if (!selectedByRole || typeof selectedByRole.limit !== "function") return;

  const existingRoleResult = await selectedByRole.limit(1);
  if (existingRoleResult.error) return;
  const existingRole = toRecord(existingRoleResult.data?.[0] ?? null);
  const roleId = asTrimmedString(existingRole.role_id);
  if (!roleId) return;

  const roleData = toRecord(existingRole.role_data);
  const capabilityIdsRaw = roleData.capability_ids;
  const capabilityIds = Array.isArray(capabilityIdsRaw)
    ? capabilityIdsRaw
        .filter((value) => typeof value === "string")
        .map((value) => (value as string).trim())
        .filter((value) => value.length > 0)
    : [];
  if (capabilityIds.length > 0) return;

  const mappingAlert = toRecord(roleData.mapping_alert);
  const existingSentAt = asTrimmedString(mappingAlert.last_sent_at);
  if (existingSentAt) return;

  const recipient = getRoleMappingAlertRecipient();
  const webhookUrl = getRoleMappingAlertWebhookUrl();
  const notificationErrors: string[] = [];
  let notified = false;

  if (webhookUrl) {
    try {
      await sendRoleMappingAlertWebhook({
        webhookUrl,
        roleName: normalizedRoleName,
        roleNameNormalized: normalizedRoleNameKey,
        detectedByProfileId: profileId,
        sourceFlow,
        detectedAt: nowIso,
      });
      notified = true;
    } catch (error) {
      notificationErrors.push(error instanceof Error ? error.message : "role_mapping_alert_webhook_failed");
    }
  }

  try {
    await sendRoleMappingAlertEmail({
      to: recipient,
      roleName: normalizedRoleName,
      roleNameNormalized: normalizedRoleNameKey,
      detectedByProfileId: profileId,
      sourceFlow,
      detectedAt: nowIso,
    });
    notified = true;
  } catch (error) {
    notificationErrors.push(error instanceof Error ? error.message : "role_mapping_alert_email_failed");
  }

  const nextRoleData = {
    ...roleData,
    mapping_alert: {
      ...mappingAlert,
      last_sent_at: notified ? nowIso : null,
      last_seen_at: nowIso,
      seen_count: asPositiveInteger(mappingAlert.seen_count) + 1,
      notification_target: recipient,
      source_flow: sourceFlow,
      last_seen_by_profile_id: profileId,
      status: notified && notificationErrors.length === 0 ? "sent" : "failed",
      last_error: notificationErrors.length > 0 ? notificationErrors.join(" | ").slice(0, 1000) : null,
    },
  };

  try {
    const updater = jobRolesQuery.update;
    if (typeof updater === "function") {
      const updateQuery = updater({ role_data: nextRoleData });
      if (updateQuery && typeof updateQuery.eq === "function") {
        await updateQuery.eq("role_id", roleId);
      }
    }
  } catch {
    // Best-effort metadata update only; notification path already completed.
  }
}

export async function notifyOnNewRolesForMapping({
  supabase,
  roleNames,
  detectedByProfileId,
  sourceFlow,
}: {
  supabase: unknown;
  roleNames: string[];
  detectedByProfileId?: string | null;
  sourceFlow: "student_profile_update" | "student_onboarding";
}) {
  const seen = new Set<string>();
  for (const roleName of roleNames) {
    const normalizedRoleName = normalizeRoleName(roleName);
    const key = normalizeRoleNameKey(normalizedRoleName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    await notifyOnNewRoleForMapping({
      supabase,
      roleName: normalizedRoleName,
      detectedByProfileId,
      sourceFlow,
    });
  }
}
