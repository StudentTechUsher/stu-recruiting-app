import { expect, test } from "@playwright/test";

test("first-time artifact visit supports extraction-first modal and snackbar lifecycle", async ({ page }) => {
  let extractionCompleted = false;

  await page.route("**/api/student/artifacts", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          artifacts: extractionCompleted
            ? [
                {
                  artifact_id: "artifact-1",
                  artifact_type: "project",
                  artifact_data: {
                    title: "LinkedIn generated project",
                    source: "LinkedIn",
                    description: "Generated from extraction",
                    tags: ["Applied execution"]
                  },
                  file_refs: [],
                  created_at: "2026-03-19T12:00:00.000Z",
                  updated_at: "2026-03-19T12:00:00.000Z"
                }
              ]
            : [],
          source_extraction_log: extractionCompleted
            ? {
                linkedin: {
                  status: "succeeded",
                  artifact_count: 1,
                  last_extracted_at: "2026-03-19T12:00:30.000Z",
                  extracted_from: "https://www.linkedin.com/in/test-user"
                }
              }
            : {},
          profile_links: {
            linkedin: "https://www.linkedin.com/in/test-user"
          }
        }
      })
    });
  });

  await page.route("**/api/student/extract/linkedin", async (route) => {
    extractionCompleted = true;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          artifacts: [{ artifact_id: "artifact-1" }]
        }
      })
    });
  });

  await page.goto("/student/artifacts?openExtractSource=1&extractSource=linkedin");
  await expect(page.getByText("Extract Artifacts from Source")).toBeVisible();
  await expect(page.getByText("In progress")).toBeVisible();

  await page.getByLabel("Profile URL").fill("https://www.linkedin.com/in/test-user");
  await page.getByRole("button", { name: "Extract artifacts" }).click();

  await expect(page.getByText("LinkedIn extraction started.", { exact: false })).toBeVisible();
  await expect(page.getByText("LinkedIn extraction complete. Added 1 artifact.", { exact: false })).toBeVisible();
});

test("profile LinkedIn and GitHub links persist after extraction flows", async ({ page }) => {
  const state = {
    linkedin: "https://www.linkedin.com/in/jarom-student",
    github: "https://github.com/jaromstudent",
    kaggle: "",
    artifacts: [] as Array<{
      artifact_id: string;
      artifact_type: string;
      artifact_data: Record<string, unknown>;
      file_refs: unknown[];
      created_at: string;
      updated_at: string;
    }>,
    sourceExtractionLog: {} as Record<string, unknown>
  };

  const artifactResponse = () => ({
    ok: true,
    data: {
      artifacts: state.artifacts,
      source_extraction_log: state.sourceExtractionLog,
      profile_links: {
        linkedin: state.linkedin,
        github: state.github,
        kaggle: state.kaggle
      }
    }
  });

  const profileResponse = () => ({
    ok: true,
    data: {
      profile: {
        personal_info: {
          first_name: "Jarom",
          last_name: "M",
          email: "jarom@school.edu"
        }
      },
      student_data: {
        target_roles: ["Software Engineer"],
        target_companies: ["Atlassian"],
        artifact_profile_links: {
          linkedin: state.linkedin,
          github: state.github,
          kaggle: state.kaggle,
          handshake: "",
          other_repo: "",
          portfolio_url: ""
        },
        profile_links: {
          linkedin: state.linkedin,
          github: state.github,
          kaggle: state.kaggle
        },
        video_links: {}
      },
      role_options: ["Software Engineer"],
      company_options: ["Atlassian"],
      referral_profile: {
        share_slug: "jaromprofile",
        share_path: "/profile/jaromprofile"
      },
      endorsements: []
    }
  });

  await page.route("**/api/student/profile", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profileResponse())
      });
      return;
    }

    const body = route.request().postDataJSON() as Record<string, unknown>;
    const studentData = (body.student_data ?? {}) as Record<string, unknown>;
    const artifactProfileLinks = (studentData.artifact_profile_links ?? {}) as Record<string, unknown>;
    const profileLinks = (studentData.profile_links ?? {}) as Record<string, unknown>;
    if (typeof artifactProfileLinks.linkedin === "string") state.linkedin = artifactProfileLinks.linkedin;
    if (typeof artifactProfileLinks.github === "string") state.github = artifactProfileLinks.github;
    if (typeof artifactProfileLinks.kaggle === "string") state.kaggle = artifactProfileLinks.kaggle;
    if (typeof profileLinks.linkedin === "string") state.linkedin = profileLinks.linkedin;
    if (typeof profileLinks.github === "string") state.github = profileLinks.github;
    if (typeof profileLinks.kaggle === "string") state.kaggle = profileLinks.kaggle;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          profile: profileResponse().data.profile,
          student_data: profileResponse().data.student_data
        }
      })
    });
  });

  await page.route("**/api/student/artifacts", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(artifactResponse())
    });
  });

  await page.route("**/api/student/extract/linkedin", async (route) => {
    const body = route.request().postDataJSON() as { profile_url?: string };
    if (typeof body.profile_url === "string") state.linkedin = body.profile_url.trim();
    state.sourceExtractionLog.linkedin = {
      status: "succeeded",
      artifact_count: 1,
      last_extracted_at: "2026-03-19T13:00:00.000Z",
      extracted_from: state.linkedin
    };
    state.artifacts.push({
      artifact_id: `linkedin-${state.artifacts.length + 1}`,
      artifact_type: "project",
      artifact_data: {
        title: "LinkedIn extracted artifact",
        source: "LinkedIn",
        description: "LinkedIn extraction output",
        tags: ["Applied execution"]
      },
      file_refs: [],
      created_at: "2026-03-19T13:00:00.000Z",
      updated_at: "2026-03-19T13:00:00.000Z"
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          artifacts: [{ artifact_id: "linkedin-1" }]
        }
      })
    });
  });

  await page.route("**/api/student/extract/github", async (route) => {
    const body = route.request().postDataJSON() as { github_username?: string };
    if (typeof body.github_username === "string") state.github = `https://github.com/${body.github_username.trim()}`;
    state.sourceExtractionLog.github = {
      status: "succeeded",
      artifact_count: 1,
      last_extracted_at: "2026-03-19T13:05:00.000Z",
      extracted_from: state.github
    };
    state.artifacts.push({
      artifact_id: `github-${state.artifacts.length + 1}`,
      artifact_type: "project",
      artifact_data: {
        title: "GitHub extracted artifact",
        source: "GitHub",
        description: "GitHub extraction output",
        tags: ["Technical depth"]
      },
      file_refs: [],
      created_at: "2026-03-19T13:05:00.000Z",
      updated_at: "2026-03-19T13:05:00.000Z"
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          artifacts: [{ artifact_id: "github-1" }]
        }
      })
    });
  });

  await page.goto("/student/profile");
  await page.getByLabel("LinkedIn URL").fill("https://www.linkedin.com/in/jarom-student");
  await page.getByLabel("GitHub URL").fill("https://github.com/jaromstudent");
  await page.getByRole("button", { name: "Save portfolio and intro video" }).click();
  await expect(page.getByText("Saved", { exact: false })).toBeVisible();

  await page.goto("/student/artifacts?openExtractSource=1&extractSource=linkedin");
  await page.getByRole("button", { name: "Extract artifacts" }).click();
  await expect(page.getByText("LinkedIn extraction complete.", { exact: false })).toBeVisible();

  await page.goto("/student/artifacts?openExtractSource=1&extractSource=github");
  await page.getByRole("button", { name: "Extract artifacts" }).click();
  await expect(page.getByText("GitHub extraction complete.", { exact: false })).toBeVisible();

  await page.goto("/student/profile");
  await expect(page.getByLabel("LinkedIn URL")).toHaveValue("https://www.linkedin.com/in/jarom-student");
  await expect(page.getByLabel("GitHub URL")).toHaveValue("https://github.com/jaromstudent");
});
