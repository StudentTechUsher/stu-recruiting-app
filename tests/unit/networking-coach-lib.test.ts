import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFallbackPayload,
  enforceGeneratedPayload,
  projectArtifactsForNetworking,
  rankArtifactsForTargets,
  rankConnectionsForTargets,
  toAbsoluteShareUrl,
  toCanonicalSharePath,
} from "@/lib/networking/coach";
import type { ActiveTarget } from "@/lib/networking/types";

const target: ActiveTarget = {
  capability_profile_id: "cp-1",
  company_id: "company-1",
  company_label: "Adobe",
  role_id: "role-1",
  role_label: "Software Engineer",
  selected_at: "2026-04-01T00:00:00.000Z",
  selection_source: "manual",
  status: "active",
};

describe("networking coach helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("scores and sorts artifacts deterministically with tie-breakers", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-06T00:00:00.000Z").getTime());

    const projected = projectArtifactsForNetworking([
      {
        artifact_id: "a-2",
        artifact_type: "project",
        artifact_data: {
          title: "Adobe product engineering build",
          source: "Internship",
          description: "Software engineer delivery",
          verification_status: "pending",
        },
        updated_at: "2026-03-20T00:00:00.000Z",
        is_active: true,
      },
      {
        artifact_id: "a-1",
        artifact_type: "project",
        artifact_data: {
          title: "Adobe product engineering build",
          source: "Internship",
          description: "Software engineer delivery",
          verification_status: "pending",
        },
        updated_at: "2026-03-20T00:00:00.000Z",
        is_active: true,
      },
      {
        artifact_id: "a-3",
        artifact_type: "coursework",
        artifact_data: {
          title: "Data class",
          source: "BYU",
          description: "Not role aligned",
          verification_status: "unverified",
        },
        updated_at: "2025-10-01T00:00:00.000Z",
        is_active: true,
      },
    ]);

    const ranked = rankArtifactsForTargets({
      artifacts: projected,
      targets: [target],
      limit: 5,
    });

    expect(ranked[0]?.artifact_id).toBe("a-1");
    expect(ranked[1]?.artifact_id).toBe("a-2");
    expect(ranked[0]?.score).toBeGreaterThan(ranked[2]?.score ?? 0);
  });

  it("ranks connections with overlap and exact phrase boosts", () => {
    const topArtifacts = rankArtifactsForTargets({
      artifacts: projectArtifactsForNetworking([
        {
          artifact_id: "a-1",
          artifact_type: "project",
          artifact_data: {
            title: "Adobe analytics pipeline",
            source: "GitHub",
            description: "Software engineer feature work",
            verification_status: "verified",
          },
          updated_at: "2026-03-10T00:00:00.000Z",
          is_active: true,
        },
      ]),
      targets: [target],
    });

    const ranked = rankConnectionsForTargets({
      connections: [
        {
          name: "Zed Contact",
          headline: "Software Engineer at Adobe building analytics systems",
          url: "https://www.linkedin.com/in/zed",
        },
        {
          name: "Amy Contact",
          headline: "Sales manager at Contoso",
          url: "https://www.linkedin.com/in/amy",
        },
      ],
      targets: [target],
      topArtifacts,
      limit: 40,
    });

    expect(ranked[0]?.url).toBe("https://www.linkedin.com/in/zed");
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it("enforces canonical share URL behavior", () => {
    const sharePath = toCanonicalSharePath("jane-doe");
    const absoluteFromAppUrl = toAbsoluteShareUrl({
      sharePath,
      appUrl: "https://stu.example.com",
      requestOrigin: "http://localhost:3000",
    });
    const absoluteFromOrigin = toAbsoluteShareUrl({
      sharePath,
      appUrl: "",
      requestOrigin: "http://localhost:3000",
    });

    expect(sharePath).toBe("/u/jane-doe");
    expect(absoluteFromAppUrl).toBe("https://stu.example.com/u/jane-doe");
    expect(absoluteFromOrigin).toBe("http://localhost:3000/u/jane-doe");
  });

  it("adds profile URL to follow-up and enforces character limits", () => {
    const normalized = enforceGeneratedPayload({
      payload: {
        selected_url: "https://www.linkedin.com/in/zed",
        rationale: "  Match  ",
        invite_message: "x".repeat(400),
        follow_up_message: "Thanks for connecting.",
      },
      profileUrl: "https://stu.example.com/u/jane-doe",
    });

    expect(normalized.rationale).toBe("Match");
    expect(normalized.invite_message.length).toBeLessThanOrEqual(300);
    expect(normalized.follow_up_message.length).toBeLessThanOrEqual(700);
    expect(normalized.follow_up_message).toContain("https://stu.example.com/u/jane-doe");
  });

  it("builds deterministic fallback payload with profile URL", () => {
    const fallback = buildFallbackPayload({
      selectedConnection: {
        name: "Jane Mentor",
        headline: "Software Engineer at Adobe",
        url: "https://www.linkedin.com/in/jane-mentor",
        score: 20,
      },
      primaryTarget: target,
      artifacts: [
        {
          artifact_id: "a-1",
          artifact_type: "project",
          title: "Distributed systems project",
          source: "GitHub",
          description: "desc",
          verification_status: "verified",
          updated_at: "2026-04-01T00:00:00.000Z",
          capability_label: "Systems Thinking",
          score: 12,
        },
      ],
      profileUrl: "https://stu.example.com/u/jane-doe",
    });

    expect(fallback.selected_url).toBe("https://www.linkedin.com/in/jane-mentor");
    expect(fallback.invite_message.length).toBeLessThanOrEqual(300);
    expect(fallback.follow_up_message).toContain("https://stu.example.com/u/jane-doe");
  });
});

