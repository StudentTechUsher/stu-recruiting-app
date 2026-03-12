const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const EMAIL_COOLDOWN_MS = parsePositiveInt(process.env.STUDENT_MAGIC_LINK_EMAIL_COOLDOWN_SECONDS, 60) * 1000;
const IP_WINDOW_MS = 60_000;
const IP_MAX_ATTEMPTS_PER_WINDOW = parsePositiveInt(process.env.STUDENT_MAGIC_LINK_IP_MAX_ATTEMPTS_PER_MINUTE, 12);
const MAX_EMAIL_ENTRIES = 20_000;
const MAX_IP_ENTRIES = 20_000;

const emailCooldownUntilByAddress = new Map<string, number>();
const ipWindowByAddress = new Map<string, { windowStartMs: number; count: number }>();

const toRetryAfterSeconds = (remainingMs: number) => Math.max(1, Math.ceil(remainingMs / 1000));

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const parseClientIp = (request: Request): string | null => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const connectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (connectingIp) return connectingIp;

  return null;
};

const trimOldEntries = () => {
  const nowMs = Date.now();

  emailCooldownUntilByAddress.forEach((cooldownUntilMs, key) => {
    if (cooldownUntilMs <= nowMs) {
      emailCooldownUntilByAddress.delete(key);
    }
  });

  ipWindowByAddress.forEach((window, key) => {
    if (nowMs - window.windowStartMs >= IP_WINDOW_MS) {
      ipWindowByAddress.delete(key);
    }
  });

  while (emailCooldownUntilByAddress.size > MAX_EMAIL_ENTRIES) {
    const oldestKey = emailCooldownUntilByAddress.keys().next().value;
    if (!oldestKey) break;
    emailCooldownUntilByAddress.delete(oldestKey);
  }

  while (ipWindowByAddress.size > MAX_IP_ENTRIES) {
    const oldestKey = ipWindowByAddress.keys().next().value;
    if (!oldestKey) break;
    ipWindowByAddress.delete(oldestKey);
  }
};

export const consumeMagicLinkThrottle = ({ email, request }: { email: string; request: Request }) => {
  trimOldEntries();
  const nowMs = Date.now();

  const emailKey = normalizeEmail(email);
  const emailCooldownUntilMs = emailCooldownUntilByAddress.get(emailKey);
  if (typeof emailCooldownUntilMs === "number" && emailCooldownUntilMs > nowMs) {
    return {
      throttled: true,
      retryAfterSeconds: toRetryAfterSeconds(emailCooldownUntilMs - nowMs)
    };
  }

  const clientIp = parseClientIp(request);
  if (clientIp) {
    const existingIpWindow = ipWindowByAddress.get(clientIp);

    if (existingIpWindow && nowMs - existingIpWindow.windowStartMs < IP_WINDOW_MS) {
      if (existingIpWindow.count >= IP_MAX_ATTEMPTS_PER_WINDOW) {
        const remainingWindowMs = IP_WINDOW_MS - (nowMs - existingIpWindow.windowStartMs);
        return {
          throttled: true,
          retryAfterSeconds: toRetryAfterSeconds(remainingWindowMs)
        };
      }
    }
  }

  emailCooldownUntilByAddress.set(emailKey, nowMs + EMAIL_COOLDOWN_MS);

  if (clientIp) {
    const existingIpWindow = ipWindowByAddress.get(clientIp);

    if (!existingIpWindow || nowMs - existingIpWindow.windowStartMs >= IP_WINDOW_MS) {
      ipWindowByAddress.set(clientIp, { windowStartMs: nowMs, count: 1 });
    } else {
      ipWindowByAddress.set(clientIp, {
        windowStartMs: existingIpWindow.windowStartMs,
        count: existingIpWindow.count + 1
      });
    }
  }

  return { throttled: false, retryAfterSeconds: 0 };
};

export const resetMagicLinkThrottleStateForTests = () => {
  emailCooldownUntilByAddress.clear();
  ipWindowByAddress.clear();
};
