import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T3.2a: O7 Approve and Reject (owner UI O7). The request names the status the screen showed; a decision made
// elsewhere first is a 409, a wish that is not the page's a 404; nothing goes back to pending.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const ID = "00000000-0000-0000-0000-0000000000e1";
const moderate = (body: unknown, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/wishes/moderate", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f1" } } });
  rpc.mockReset().mockResolvedValue({ data: { status: "approved" }, error: null });
});

test("another origin is refused", async () => {
  expect((await moderate({ id: ID, status: "approved", expected: "pending" }, "https://evil.example.test")).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});

test.each([
  [{ status: "approved", expected: "pending" }],
  [{ id: "nope", status: "approved", expected: "pending" }],
  [{ id: ID, status: "pending", expected: "approved" }],
  [{ id: ID, status: "approved", expected: "gone" }],
  [{ id: ID, status: "rejected", expected: "rejected" }], // a no-op would restart the 30-day purge clock
])("a malformed decision %j is a 400", async (body) => {
  expect((await moderate(body)).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});

test("approve: the new status, never cached", async () => {
  const res = await moderate({ id: ID, status: "approved", expected: "pending" });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ status: "approved" });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("owner_wish_moderate", { entry_id: ID, status: "approved", expected: "pending" });
});

test("decided elsewhere first is a 409; not the page's wish a 404", async () => {
  rpc.mockResolvedValue({ data: { error: "changed" }, error: null });
  expect((await moderate({ id: ID, status: "rejected", expected: "pending" })).status).toBe(409);
  rpc.mockResolvedValue({ data: null, error: null });
  expect((await moderate({ id: ID, status: "rejected", expected: "pending" })).status).toBe(404);
});
