export function isSessionCheckEnabled(): boolean {
  const raw = process.env.ENABLE_SESSION_CHECK ?? process.env.NEXT_PUBLIC_ENABLE_SESSION_CHECK ?? "true";
  return raw.toLowerCase() !== "false";
}

export function isStudentGoogleOAuthEnabled(): boolean {
  const raw = process.env.ENABLE_STUDENT_GOOGLE_OAUTH ?? process.env.NEXT_PUBLIC_ENABLE_STUDENT_GOOGLE_OAUTH ?? "false";
  return raw.toLowerCase() !== "false";
}
