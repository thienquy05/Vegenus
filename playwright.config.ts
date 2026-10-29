import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

// Browsers live in node_modules, not the user cache (design 6 §7.1).
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0";

// Settings of the running local Supabase stack (`supabase start`), read once; workers inherit them.
// Without a stack (the a11y job) they stay unset and only the owner-auth spec needs them.
if (!process.env.SUPABASE_URL) {
  try {
    const s = JSON.parse(execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    const password = randomBytes(18).toString("base64url"); // local only, set on the role in e2e/global-setup.ts
    const db = new URL(s.DB_URL);
    db.username = "vegenus_server";
    db.password = password;
    Object.assign(process.env, {
      SUPABASE_URL: s.API_URL,
      SUPABASE_PUBLISHABLE_KEY: s.PUBLISHABLE_KEY,
      SUPABASE_SECRET_KEY: s.SECRET_KEY,
      SUPABASE_DB_URL: s.DB_URL,
      VEGENUS_SERVER_DB_PASSWORD: password,
      VEGENUS_SERVER_DB_URL: db.href,
      VEGENUS_HMAC_SECRET: randomBytes(32).toString("base64url"),
    });
  } catch {}
}

export default defineConfig({
  testDir: "e2e",
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  // Tests run against the production build (npm run build first).
  webServer: { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: !process.env.CI },
  projects: [
    { name: "chromium", use: { ...devices["Pixel 7"] }, testIgnore: /\.a11y\.ts$/ },
    { name: "webkit", use: { ...devices["iPhone 15"] }, testIgnore: /\.a11y\.ts$/ },
    { name: "a11y", use: { ...devices["Pixel 7"] }, testMatch: /\.a11y\.ts$/ },
  ],
});
