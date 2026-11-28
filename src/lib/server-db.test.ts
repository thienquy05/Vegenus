import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

// Captures the keys passed to the limiter functions instead of reaching a database.
const calls = vi.hoisted(() => [] as unknown[][]);
vi.mock("postgres", () => ({
  default: () => (_strings: TemplateStringsArray, ...values: unknown[]) => (calls.push(values), [{ ok: true }]),
}));
process.env.VEGENUS_HMAC_SECRET = "test-secret";
const { loginAllowed, postWish } = await import("./server-db");

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
const ALLOWED = ["src/app/api/cron/storage/route.ts", "src/app/api/guest/session/route.ts", "src/app/api/guest/wish/route.ts", "src/app/api/health/route.ts", "src/app/api/owner/login/route.ts"];

test("only the listed routes import server-db", () => {
  const files = readdirSync("src", { recursive: true, encoding: "utf8" })
    .map((f) => join("src", f))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") && f !== join("src", "lib", "server-db.ts"));
  const importers = files.filter((f) => /from\s+["'][^"']*server-db["']|import\s+["'][^"']*server-db["']/.test(readFileSync(f, "utf8")));
  expect(importers.sort()).toEqual(ALLOWED);
});

// T3.2a (design 3 §3.9): a wish reaches the database with HMAC keys only, never the raw device id or IP; the device key
// follows the cookie, the IP key the client address.
test("a wish carries keyed device and IP values, not the raw ones", async () => {
  const wish = { submission_id: "00000000-0000-0000-0000-000000000101", display_name: "[GUEST]", body: "[WISH_TEXT]", lang: "en" as const, consent: 1 };
  const keys = async (device: string, ip: string) => {
    await postWish({ page: "our-page" }, wish, device, from(ip));
    const values = calls.at(-1)!;
    expect(values).toContain("our-page");
    expect(values.at(-1)).toBe(1); // T3.2c: the notice version the guest consented to
    expect(values.join("|")).not.toContain(device);
    expect(values.join("|")).not.toContain(ip);
    return values.filter((v) => Buffer.isBuffer(v)) as Buffer[];
  };
  const [d1, i1] = await keys("D".repeat(43), "192.0.2.1");
  const [d2, i2] = await keys("E".repeat(43), "192.0.2.1");
  const [d3, i3] = await keys("D".repeat(43), "192.0.2.9");
  expect(d1).toHaveLength(32);
  expect(d2).not.toEqual(d1);
  expect(i2).toEqual(i1);
  expect(d3).toEqual(d1);
  expect(i3).not.toEqual(i1);
});
