import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// Codex, T1.5a review: a failing dependency (limiter or guest_open) is a retryable 503 with no cookie,
// never a framework error and never the "not available" answer a wrong token gets.
vi.mock("@/lib/server-db", () => ({ exchangeAllowed: vi.fn() }));
vi.mock("@/lib/guest", async (original) => ({ ...(await original<typeof import("@/lib/guest")>()), guestOpen: vi.fn() }));
const { exchangeAllowed } = await import("@/lib/server-db");
const { guestOpen } = await import("@/lib/guest");
const { POST } = await import("./route");

const exchange = () =>
  POST(
    new NextRequest("http://localhost:3000/api/guest/session", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-vegenus-guest": "1", "content-type": "application/json" },
      body: JSON.stringify({ token: "A".repeat(43) }),
    }),
  );

beforeEach(() => {
  vi.mocked(exchangeAllowed).mockReset().mockResolvedValue(true);
  vi.mocked(guestOpen).mockReset().mockResolvedValue(null);
});

test("a wrong token gets the generic not-available answer", async () => {
  expect((await exchange()).status).toBe(404);
});

test("a limiter failure is a 503 with no cookie", async () => {
  vi.mocked(exchangeAllowed).mockRejectedValue(new Error("db down"));
  const res = await exchange();
  expect(res.status).toBe(503);
  expect(res.headers.get("set-cookie")).toBeNull();
});

test("a guest_open failure is a 503 with no cookie", async () => {
  vi.mocked(guestOpen).mockRejectedValue(new Error("guest_open failed"));
  const res = await exchange();
  expect(res.status).toBe(503);
  expect(res.headers.get("set-cookie")).toBeNull();
});
