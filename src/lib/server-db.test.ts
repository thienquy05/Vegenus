import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

// Captures the keys passed to the limiter functions instead of reaching a database.
const calls = vi.hoisted(() => [] as unknown[][]);
vi.mock("postgres", () => ({
  default: () => (_strings: TemplateStringsArray, ...values: unknown[]) => (calls.push(values), [{ ok: true }]),
}));
process.env.VEGENUS_HMAC_SECRET = "test-secret";
const { loginAllowed } = await import("./server-db");

const from = (ip: string) => new Request("http://localhost/api/owner/login", { headers: { "x-forwarded-for": ip } });
const addressKey = async (ip: string, email: string) => {
  await loginAllowed(from(ip), email);
  return calls.at(-1)![1] as Buffer;
};

// Codex Phase 1 security review: failed attempts from one client must not spend another client's address budget.
test("the address budget is kept per client IP", async () => {
  const owner = await addressKey("192.0.2.1", "owner@vegenus.example");
  expect(await addressKey("192.0.2.2", "owner@vegenus.example")).not.toEqual(owner);
  expect(await addressKey("192.0.2.1", "owner@vegenus.example")).toEqual(owner);
});

// Design 3 §3.9: the vegenus_server connection is used only by the server routes listed here.
const ALLOWED = ["src/app/api/guest/session/route.ts", "src/app/api/owner/login/route.ts"];

test("only the listed routes import server-db", () => {
  const files = readdirSync("src", { recursive: true, encoding: "utf8" })
    .map((f) => join("src", f))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") && f !== join("src", "lib", "server-db.ts"));
  const importers = files.filter((f) => /from\s+["'][^"']*server-db["']|import\s+["'][^"']*server-db["']/.test(readFileSync(f, "utf8")));
  expect(importers.sort()).toEqual(ALLOWED);
});
