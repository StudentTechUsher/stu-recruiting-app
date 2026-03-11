import type { AuthContext } from "@/lib/route-policy";

export function assertOrgScope(context: AuthContext, orgId: string): boolean {
  return context.org_id === orgId;
}

export function assertRecruiterAssignment(context: AuthContext, assignmentId?: string): boolean {
  if (context.persona === "org_admin") return true;
  if (context.persona !== "recruiter") return false;
  if (!assignmentId) return true;
  return context.assignment_ids.includes(assignmentId);
}
