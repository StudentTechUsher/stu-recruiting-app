import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 30_000,
  use: {
    baseURL
  },
  webServer: {
    command: "ENABLE_SESSION_CHECK=false NEXT_PUBLIC_ENABLE_SESSION_CHECK=false npm run dev -- --port 3000",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000
  }
});
