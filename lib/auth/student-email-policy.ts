const normalizeDomain = (value: string): string => value.trim().toLowerCase();

export function parseStudentEmailExceptionDomains(raw: string | undefined): string[] {
  if (!raw) return [];

  return Array.from(
    new Set(
      raw
        .split(",")
        .map(normalizeDomain)
        .filter(Boolean)
    )
  );
}

export function getStudentEmailExceptionDomains(): string[] {
  return parseStudentEmailExceptionDomains(process.env.STUDENT_EMAIL_EXCEPTION_DOMAINS);
}

export function getEmailDomain(email: string): string {
  const [, domain = ""] = email.trim().toLowerCase().split("@");
  return domain;
}

export function isAllowedStudentEmail(email: string, exceptionDomains: string[] = getStudentEmailExceptionDomains()): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  if (domain.endsWith(".edu")) return true;
  return exceptionDomains.includes(domain);
}
