import { expect, test } from "@playwright/test";

test("login route renders chooser", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Choose sign-in path")).toBeVisible();
  await expect(page.getByText("Students, recruiters, and referrers use magic links.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /Student magic link/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Recruiter magic link/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Referrer magic link/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Org admin password/i })).toHaveCount(0);
});

test("student, recruiter, and staff login routes render", async ({ page }) => {
  await page.goto("/login/student");
  await expect(page.getByText("Sign in")).toBeVisible();

  await page.goto("/login/recruiter");
  await expect(page.getByText("Get magic link")).toBeVisible();
  await expect(page.getByText("Use your work email to request recruiter access.", { exact: false })).toBeVisible();

  await page.goto("/login/referrer");
  await expect(page.getByText("Get magic link")).toBeVisible();
  await expect(page.getByText("submit endorsements", { exact: false })).toBeVisible();

  await page.goto("/login/staff");
  await expect(page.getByText("Password login")).toBeVisible();
});

test("root forwards to login when unauthenticated", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("public share profile routes are accessible without auth", async ({ page }) => {
  await page.goto("/u/non-existent-share-slug");
  await expect(page).toHaveURL(/\/u\/non-existent-share-slug$/);
  await expect(page.getByRole("heading", { name: "Profile not found" })).toBeVisible();

  await page.goto("/profile/non-existent-share-slug");
  await expect(page).toHaveURL(/\/u\/non-existent-share-slug$/);
});

test("recruiter routes render with Storybook nav", async ({ page }) => {
  await page.goto("/recruiter/review-candidates");
  await expect(page).toHaveURL(/\/recruiter\/review-candidates$/);
  await expect(page.getByRole("heading", { name: "Review Candidates" })).toBeVisible();

  await page.goto("/recruiter/pipeline");
  await expect(page).toHaveURL(/\/recruiter\/review-candidates$/);

  await page.goto("/recruiter/candidates");
  await expect(page).toHaveURL(/\/recruiter\/review-candidates$/);

  await page.goto("/recruiter/off-platform-scoring");
  await expect(page).toHaveURL(/\/recruiter\/review-candidates$/);

  await page.goto("/recruiter/outcomes");
  await expect(page).toHaveURL(/\/recruiter\/review-candidates$/);

  await page.goto("/recruiter/capability-models");
  await expect(page).toHaveURL(/\/recruiter\/capability-models$/);
  await expect(page.getByRole("heading", { name: "Capability Model" })).toBeVisible();
  await expect(page.getByText("model authoring and interactive controls are disabled", { exact: false })).toBeVisible();
});

test("student routes render with Storybook nav", async ({ page }) => {
  await page.goto("/student/onboarding");
  await expect(page).toHaveURL(/\/student\/onboarding$/);
  await expect(page.getByText("Student onboarding")).toBeVisible();
  await expect(page.getByText("Student Navigation")).toHaveCount(0);

  await page.goto("/student/artifacts");
  await expect(page).toHaveURL(/\/student\/artifacts$/);
  await expect(page.getByText("stu.").first()).toBeVisible();

  await page.goto("/student/dashboard");
  await expect(page).toHaveURL(/\/student\/dashboard$/);

  await page.goto("/student/networking-coach");
  await expect(page).toHaveURL(/\/student\/networking-coach$/);
  await expect(page.getByText("Networking Coach (Design Preview)")).toBeVisible();
});

test("admin route renders with Storybook nav", async ({ page }) => {
  await page.goto("/admin/recruiter-assignments");
  await expect(page).toHaveURL(/\/admin\/recruiter-assignments$/);
  await expect(page.getByText("Recruiter Assignment Governance")).toBeVisible();
});

test("referrer routes render", async ({ page }) => {
  await page.goto("/referrer/onboarding");
  await expect(page).toHaveURL(/\/referrer\/onboarding$/);
  await expect(page.getByText("Set up your endorsement profile")).toBeVisible();

  await page.goto("/referrer/endorsements");
  await expect(page).toHaveURL(/\/referrer\/endorsements$/);
  await expect(page.getByText("Submit student endorsement")).toBeVisible();
});
