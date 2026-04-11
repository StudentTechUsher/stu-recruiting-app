type SearchParamValue = string | string[] | undefined;

type LoginErrorOptions = {
  intendedPersona?: "student" | "recruiter" | "referrer";
};

const firstValue = (value: SearchParamValue): string | null => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return null;
};

const normalize = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const wrongAccountTypeMessageByPersona: Record<NonNullable<LoginErrorOptions["intendedPersona"]>, string> = {
  student: "This email is already assigned to a different account type. Student magic links only work for student profiles.",
  recruiter:
    "This email is already assigned to a different account type. Recruiter magic links only work for recruiter profiles.",
  referrer:
    "This email is already assigned to a different account type. Referrer magic links only work for referrer profiles.",
};

export function resolveAuthLoginErrorMessage(
  searchParams: Record<string, SearchParamValue> | null | undefined,
  options: LoginErrorOptions = {}
): string | null {
  if (!searchParams) return null;

  const error = normalize(firstValue(searchParams.error));
  const errorCode = normalize(firstValue(searchParams.error_code));
  const errorDescription = normalize(firstValue(searchParams.error_description));
  const normalizedError = error?.toLowerCase() ?? null;
  const normalizedErrorCode = errorCode?.toLowerCase() ?? null;
  const normalizedDescription = errorDescription?.toLowerCase() ?? "";

  if (normalizedError === "wrong_account_type" && options.intendedPersona) {
    return wrongAccountTypeMessageByPersona[options.intendedPersona];
  }

  if (
    normalizedErrorCode === "otp_expired" ||
    normalizedError === "otp_expired" ||
    normalizedError === "invalid_magic_link" ||
    (normalizedError === "access_denied" && /invalid|expired/.test(normalizedDescription))
  ) {
    return "This sign-in link is invalid or expired. Request a new magic link and use the latest email.";
  }

  if (normalizedError === "role_unassigned") {
    return "Your account does not have an assigned Stu role. Contact an org admin.";
  }

  if (normalizedError === "supabase_not_configured") {
    return "Authentication is not configured for this environment.";
  }

  return null;
}
