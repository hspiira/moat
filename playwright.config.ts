import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;

export default defineConfig({
  testDir: "e2e",
  // Playwright's default of 30s suits tests that only click. Several of these
  // set a PIN, which derives a key with Argon2id on purpose, and one drives two
  // browser contexts against a stubbed Drive. Those legitimately take twenty to
  // forty seconds, so the default turned deliberate work into a failure the
  // moment the machine was busy.
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: `node scripts/serve-static.mjs out ${PORT}`,
    url: `http://localhost:${PORT}/transactions`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
