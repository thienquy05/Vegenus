import { defineConfig } from "vitest/config";

export default defineConfig({
  // Same "@/..." imports as tsconfig.json, so route handlers can be tested directly.
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { include: ["src/**/*.test.ts"] },
});
