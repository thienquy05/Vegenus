import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Browsers live in node_modules, not the user cache (design 6 §7.1), as in playwright.config.ts.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0";

export default defineConfig({
  // Same "@/..." imports as tsconfig.json, so route handlers can be tested directly.
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    projects: [
      { extends: true, test: { name: "node", include: ["src/**/*.test.ts"], exclude: ["src/**/*.browser.test.ts"] } },
      // Media processing needs a real canvas and WebCodecs (T2.3b), so these run in Playwright's Chromium.
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts"],
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" }] },
        },
      },
    ],
  },
});
