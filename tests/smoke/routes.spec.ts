import { expect, test } from "@playwright/test";

test("login route renders chooser", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Choose sign-in path")).toBeVisible();
  await expect(page.getByText("Students use magic links.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Magic link" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Password login" })).toBeVisible();
});

test("student and staff login routes render", async ({ page }) => {
  await page.goto("/login/student");
  await expect(page.getByText("Get magic link")).toBeVisible();

  await page.goto("/login/staff");
  await expect(page.getByText("Password login")).toBeVisible();
});

test("root forwards to login when unauthenticated", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("recruiter routes render with Storybook nav", async ({ page }) => {
  const recruiterRoutes = [
    "/recruiter/capability-models",
    "/recruiter/pipeline",
    "/recruiter/off-platform-scoring",
    "/recruiter/candidates",
    "/recruiter/outcomes"
  ];

  for (const route of recruiterRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByText("stu.").first()).toBeVisible();
  }

  await page.goto("/recruiter/off-platform-scoring");
  await expect(page.getByText("Import and score off-platform students", { exact: false })).toBeVisible();
});

test("student routes render with Storybook nav", async ({ page }) => {
  await page.goto("/student/onboarding");
  await expect(page).toHaveURL(/\/student\/onboarding$/);
  await expect(page.getByText("Student onboarding")).toBeVisible();
  await expect(page.getByText("stu.").first()).toHaveCount(0);

  await page.goto("/student/artifacts");
  await expect(page).toHaveURL(/\/student\/artifacts$/);
  await expect(page.getByText("stu.").first()).toBeVisible();

  await page.goto("/student/dashboard");
  await expect(page).toHaveURL(/\/student\/artifacts$/);
});

test("admin route renders with Storybook nav", async ({ page }) => {
  await page.goto("/admin/recruiter-assignments");
  await expect(page).toHaveURL(/\/admin\/recruiter-assignments$/);
  await expect(page.getByText("Recruiter Assignment Governance")).toBeVisible();
});
