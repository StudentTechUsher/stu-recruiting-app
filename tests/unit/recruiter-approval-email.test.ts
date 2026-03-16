import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRecruiterApprovalRequestEmail,
  sendRecruiterApprovalRequestEmail
} from "@/lib/mailer/recruiter-approval";

describe("recruiter approval email builder", () => {
  it("renders recruiter details and approval link", () => {
    const message = buildRecruiterApprovalRequestEmail({
      recruiterEmail: "recruiter@company.com",
      recruiterProfileId: "profile-123",
      approveUrl: "https://functions.example.com/recruiter-approve?token=abc",
      requestedAt: "2026-03-13T14:00:00.000Z"
    });

    expect(message.subject).toBe("Recruiter approval request: recruiter@company.com");
    expect(message.text).toContain("Recruiter email: recruiter@company.com");
    expect(message.text).toContain("Approve recruiter: https://functions.example.com/recruiter-approve?token=abc");
    expect(message.html).toContain("profile-123");
    expect(message.html).toContain("Approve recruiter");
  });
});

describe("recruiter approval email sender", () => {
  const originalEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    RESEND_REPLY_TO_EMAIL: process.env.RESEND_REPLY_TO_EMAIL,
    RECRUITER_APPROVAL_NOTIFICATION_TO: process.env.RECRUITER_APPROVAL_NOTIFICATION_TO
  };

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "Stu <hello@stuplanning.com>";
    process.env.RESEND_REPLY_TO_EMAIL = "vin@stuplanning.com";
    process.env.RECRUITER_APPROVAL_NOTIFICATION_TO = "vin@stuplanning.com";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.RESEND_API_KEY = originalEnv.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = originalEnv.RESEND_FROM_EMAIL;
    process.env.RESEND_REPLY_TO_EMAIL = originalEnv.RESEND_REPLY_TO_EMAIL;
    process.env.RECRUITER_APPROVAL_NOTIFICATION_TO = originalEnv.RECRUITER_APPROVAL_NOTIFICATION_TO;
  });

  it("sends a recruiter approval request through Resend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendRecruiterApprovalRequestEmail({
      recruiterEmail: "recruiter@company.com",
      recruiterProfileId: "profile-123",
      approveUrl: "https://functions.example.com/recruiter-approve?token=abc"
    });

    expect(result).toEqual({ id: "email_123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
          "Content-Type": "application/json",
          "Idempotency-Key": "recruiter-approval-profile-123"
        })
      })
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(parsedBody.to).toBe("vin@stuplanning.com");
    expect(parsedBody.subject).toBe("Recruiter approval request: recruiter@company.com");
    expect(parsedBody.reply_to).toBe("vin@stuplanning.com");
  });
});
