import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // html as well as line on CI, because the workflow uploads the report on
  // failure and the line reporter writes no report to upload.
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      // The phone the mobile faults reproduce on. The viewport goes after the
      // device spread, which carries its own 1280px one and would otherwise
      // win, leaving every width assertion vacuously true.
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    // Serves the export `pnpm build` already produced, so this runs against the
    // same files that deploy rather than a dev server.
    command: `node scripts/serve-static.mjs out ${PORT}`,
    url: `http://localhost:${PORT}/transactions`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
