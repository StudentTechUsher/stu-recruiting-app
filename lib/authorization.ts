import type { AuthContext, Persona } from "@/lib/route-policy";

type PersonaCheckOptions = {
  requireOnboarding?: boolean;
};

export function isOnboardingComplete(context: AuthContext): boolean {
  return Boolean(context.profile?.onboarding_completed_at);
}

export function hasPersona(context: AuthContext, allowed: Persona[], options: PersonaCheckOptions = {}): boolean {
  if (!context.authenticated) return false;
  if (!allowed.includes(context.persona)) return false;
  if (options.requireOnboarding === false) return true;
  return isOnboardingComplete(context);
}
