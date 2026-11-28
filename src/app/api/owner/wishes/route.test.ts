import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T3.2a: O7 reads the page's wishes by status (owner UI O7; design 3 §3.5). The queue is oldest first, the history
// newest first, 50 at a time with a {created_at, id} cursor; the database checks the owner.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const ID = "00000000-0000-0000-0000-0000000000e1";
const AT = "2026-11-20T10:00:00.000Z";
const list = (body: unknown, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/wishes", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f1" } } });
  rpc.mockReset().mockResolvedValue({ data: [{ id: ID, display_name: "[GUEST]" }], error: null });
});

test("another origin is refused; a signed-out owner is a 401", async () => {
  expect((await list({ status: "pending" }, "https://evil.example.test")).status).toBe(403);
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await list({ status: "pending" })).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});

test.each([[{}], [{ status: "deleted" }], [{ status: "pending", after: { created_at: "yesterday", id: ID } }], [{ status: "pending", after: { created_at: AT } }]])(
  "a malformed request %j is a 400",
  async (body) => {
    expect((await list(body)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  },
);

test("the queue, then the page after a cursor, never cached", async () => {
  const res = await list({ status: "pending" });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ entries: [{ id: ID, display_name: "[GUEST]" }] });
  expect(rpc).toHaveBeenLastCalledWith("owner_wishes", { which: "pending", after_created_at: null, after_id: null });
  await list({ status: "rejected", after: { created_at: AT, id: ID } });
  expect(rpc).toHaveBeenLastCalledWith("owner_wishes", { which: "rejected", after_created_at: AT, after_id: ID });
});

test("not the page's owner is a 403; an outage a 503", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  expect((await list({ status: "pending" })).status).toBe(403);
  rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
  expect((await list({ status: "pending" })).status).toBe(503);
});
