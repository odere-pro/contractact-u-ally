import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  // When BASE_URL is set we are running against a deployed URL (e.g. Vercel
  // preview), so do not start a local dev server.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: true,
      },
});
