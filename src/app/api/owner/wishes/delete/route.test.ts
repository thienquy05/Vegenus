import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T3.2c: O7 Delete (privacy design §6, test 9). The owner removes a wish of any status at once; a wish that is not the
// page's is a 404.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const ID = "00000000-0000-0000-0000-0000000000e1";
const remove = (body: unknown, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/wishes/delete", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f1" } } });
  rpc.mockReset().mockResolvedValue({ data: { status: "deleted" }, error: null });
});

test("another origin is refused; a malformed id is a 400", async () => {
  expect((await remove({ id: ID }, "https://evil.example.test")).status).toBe(403);
  expect((await remove({ id: "nope" })).status).toBe(400);
  expect((await remove(null)).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});

test("delete: gone at once, never cached", async () => {
  const res = await remove({ id: ID });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ status: "deleted" });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("owner_wish_delete", { entry_id: ID });
});

test("not the page's wish, or already gone, is a 404", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  expect((await remove({ id: ID })).status).toBe(404);
});
