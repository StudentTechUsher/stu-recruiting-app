import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/student/dashboard/route";

const {
  getAuthContextMock,
  hasPersonaMock,
  getSupabaseServerClientMock,
  buildStudentIdentitySnapshotMock,
} = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
  hasPersonaMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
  buildStudentIdentitySnapshotMock: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/authorization", () => ({
  hasPersona: hasPersonaMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

vi.mock("@/lib/student/identity", () => ({
  buildStudentIdentitySnapshot: buildStudentIdentitySnapshotMock,
}));

describe("student dashboard route identity payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasPersonaMock.mockReturnValue(true);
    getAuthContextMock.mockResolvedValue({
      authenticated: true,
      user_id: "student-1",
      org_id: "org-1",
      persona: "student",
      profile: { personal_info: { first_name: "Jarom" } },
      session_user: { email: "jarom@school.edu" },
    });
    buildStudentIdentitySnapshotMock.mockResolvedValue({
      display_name: "Jarom M",
      first_name: "Jarom",
      initials_fallback: "JM",
      avatar_url: null,
      cache_scope: "student-1:org-1",
    });
  });

  it("includes canonical identity in fallback dashboard response", async () => {
    getSupabaseServerClientMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.data.dashboard.identity).toEqual({
      display_name: "Jarom M",
      first_name: "Jarom",
      initials_fallback: "JM",
      avatar_url: null,
      cache_scope: "student-1:org-1",
    });
    expect(buildStudentIdentitySnapshotMock).toHaveBeenCalledTimes(1);
  });
});
