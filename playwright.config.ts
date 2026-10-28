import { defineConfig, devices } from "@playwright/test";

// Browsers live in node_modules, not the user cache (design 6 §7.1).
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  // Tests run against the production build (npm run build first).
  webServer: { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: !process.env.CI },
  projects: [
    { name: "chromium", use: { ...devices["Pixel 7"] }, testIgnore: /\.a11y\.ts$/ },
    { name: "webkit", use: { ...devices["iPhone 15"] }, testIgnore: /\.a11y\.ts$/ },
    { name: "a11y", use: { ...devices["Pixel 7"] }, testMatch: /\.a11y\.ts$/ },
  ],
});
