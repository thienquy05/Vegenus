import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T3.1c: one published memory for G3 (design 1 §5 guest_item). The database checks the token, the page, the section
// and publication. A missing item is "not_found" while the token still opens Memories; otherwise "not_available".
vi.mock("@/lib/guest", async (original) => ({ ...(await original<typeof import("@/lib/guest")>()), guestItem: vi.fn(), stillOpen: vi.fn() }));
const { guestItem, stillOpen } = await import("@/lib/guest");
const { POST } = await import("./route");

const ID = "00000000-0000-0000-0000-0000000000b1";
const TOKEN = "A".repeat(43);
const ask = (body: unknown, { origin = "http://localhost:3000", guest = "1", cookie = `vegenus_g=${TOKEN}` } = {}) =>
  POST(
    new NextRequest("http://localhost:3000/api/guest/item", {
      method: "POST",
      headers: { origin, "x-vegenus-guest": guest, cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.mocked(guestItem).mockReset().mockResolvedValue({ id: ID, title: "[TITLE]" });
  vi.mocked(stillOpen).mockReset().mockResolvedValue(true);
});

test("another origin or a missing guest header is refused", async () => {
  expect((await ask({ id: ID }, { origin: "https://evil.example.test" })).status).toBe(403);
  expect((await ask({ id: ID }, { guest: "" })).status).toBe(403);
  expect(guestItem).not.toHaveBeenCalled();
});

test.each([[{}], [{ id: "nope" }], [{ id: 1 }], [null]])("a malformed request %j is a 400", async (body) => {
  expect((await ask(body)).status).toBe(400);
  expect(guestItem).not.toHaveBeenCalled();
});

test("the item, no-store; the token from the cookie, or from the body when cookies are blocked", async () => {
  const res = await ask({ id: ID });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toContain("no-store");
  expect(await res.json()).toEqual({ item: { id: ID, title: "[TITLE]" } });
  expect(guestItem).toHaveBeenLastCalledWith(TOKEN, ID);
  const other = "B".repeat(43);
  await ask({ id: ID, token: other }, { cookie: "" });
  expect(guestItem).toHaveBeenLastCalledWith(other, ID);
});

test("no token is not available; a missing item is not_found while Memories still opens, else not_available", async () => {
  expect((await ask({ id: ID }, { cookie: "" })).status).toBe(404);
  vi.mocked(guestItem).mockResolvedValue(null);
  const missing = await ask({ id: ID });
  expect([missing.status, await missing.json()]).toEqual([404, { error: "not_found" }]);
  expect(stillOpen).toHaveBeenLastCalledWith(TOKEN, "memories");
  vi.mocked(stillOpen).mockResolvedValue(false);
  const gone = await ask({ id: ID });
  expect([gone.status, await gone.json()]).toEqual([404, { error: "not_available" }]);
});

test("a database failure is a 503 without the token", async () => {
  vi.mocked(guestItem).mockRejectedValue(new Error("guest_item failed"));
  const res = await ask({ id: ID });
  expect(res.status).toBe(503);
  expect(await res.text()).not.toContain(TOKEN);
});
