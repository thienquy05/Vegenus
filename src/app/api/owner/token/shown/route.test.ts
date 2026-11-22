import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T2.6: O8 acknowledges a revealed link version once (Q146 12). The database sets shown_at only while that version
// is active; false means it was replaced and O8 reads the metadata again.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const ack = (body: unknown, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/token/shown", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f1" } } });
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
});

test.each([true, false])("answers shown: %s, with no-store", async (shown) => {
  rpc.mockResolvedValue({ data: shown, error: null });
  const res = await ack({ version: 3 });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ shown });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_token_shown", { version: 3 });
});

test("a missing or malformed version is refused before the database", async () => {
  for (const body of [{}, { version: 0 }, { version: "3" }, { version: 1.5 }, { version: null }, null]) {
    expect((await ack(body)).status, JSON.stringify(body)).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a foreign origin or no session is refused without calling the database", async () => {
  expect((await ack({ version: 1 }, "https://other.site")).status).toBe(403);
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await ack({ version: 1 })).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});

test("not the owner is 403, a database failure 503", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  expect((await ack({ version: 1 })).status).toBe(403);
  rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
  expect((await ack({ version: 1 })).status).toBe(503);
});
