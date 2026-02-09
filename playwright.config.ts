import { defineConfig, devices } from "@playwright/test";

const WORKER_APP_URL = process.env.WORKER_APP_URL ?? "http://localhost:3000";
const ADMIN_APP_URL = process.env.ADMIN_APP_URL ?? "http://localhost:3001";
const rawApiUrl = process.env.API_URL ?? "http://localhost:8787";
const API_URL = rawApiUrl.endsWith("/") ? rawApiUrl : `${rawApiUrl}/`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "worker-app",
      testDir: "./e2e/worker-app",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: WORKER_APP_URL,
      },
    },
    {
      name: "admin-app",
      testDir: "./e2e/admin-app",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: ADMIN_APP_URL,
      },
    },
    {
      name: "api",
      testDir: "./e2e/api",
      use: {
        baseURL: API_URL,
      },
    },
  ],
});
