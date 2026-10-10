import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001";
const port = new URL(baseURL).port || "3001";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
