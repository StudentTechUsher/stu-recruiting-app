export function isPasskeysEnabled(): boolean {
  const raw = process.env.ENABLE_PASSKEYS ?? process.env.NEXT_PUBLIC_ENABLE_PASSKEYS ?? "false";
  return raw.toLowerCase() === "true";
}

export function getAuthCapabilities() {
  const passkeysEnabled = isPasskeysEnabled();

  return {
    student_magic_links: true,
    staff_password: true,
    passkeys: {
      enabled: passkeysEnabled,
      enroll_endpoint: "/api/auth/passkeys/enroll",
      assert_endpoint: "/api/auth/passkeys/assert"
    }
  };
}
