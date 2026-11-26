import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T3.1b: approved wishes for G5, newest first, 50 at a time (design 1 §5 guest_guestbook_list; Q34d: never pending).
vi.mock("@/lib/guest", async (original) => ({ ...(await original<typeof import("@/lib/guest")>()), guestWishes: vi.fn(), stillOpen: vi.fn() }));
const { guestWishes, stillOpen } = await import("@/lib/guest");
const { POST } = await import("./route");

const ID = "00000000-0000-0000-0000-0000000000e1";
const AT = "2026-11-20T10:00:00.000Z";
const TOKEN = "A".repeat(43);
const ask = (body: unknown, { origin = "http://localhost:3000", guest = "1", cookie = `vegenus_g=${TOKEN}` } = {}) =>
  POST(
    new NextRequest("http://localhost:3000/api/guest/wishes", {
      method: "POST",
      headers: { origin, "x-vegenus-guest": guest, cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.mocked(guestWishes).mockReset().mockResolvedValue([{ id: ID, body: "[WISH_TEXT]" }]);
  vi.mocked(stillOpen).mockReset().mockResolvedValue(true);
});

test("another origin or a missing guest header is refused", async () => {
  expect((await ask({}, { origin: "https://evil.example.test" })).status).toBe(403);
  expect((await ask({}, { guest: "" })).status).toBe(403);
  expect(guestWishes).not.toHaveBeenCalled();
});

test.each([[{ after: { created_at: "yesterday", id: ID } }], [{ after: { created_at: "1", id: ID } }], [{ after: { created_at: AT, id: "nope" } }], [{ after: { id: ID } }], [null]])(
  "a malformed request %j is a 400",
  async (body) => {
    expect((await ask(body)).status).toBe(400);
    expect(guestWishes).not.toHaveBeenCalled();
  },
);

test("without a token: the generic not-available answer", async () => {
  expect((await ask({}, { cookie: "" })).status).toBe(404);
  expect(guestWishes).not.toHaveBeenCalled();
});

test("the newest wishes, then the ones before a cursor, never cached", async () => {
  const res = await ask({});
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ entries: [{ id: ID, body: "[WISH_TEXT]" }] });
  expect(guestWishes).toHaveBeenLastCalledWith(TOKEN, null);
  await ask({ after: { created_at: AT, id: ID } });
  expect(guestWishes).toHaveBeenLastCalledWith(TOKEN, { created_at: AT, id: ID });
});

test("a database failure is a retryable 503", async () => {
  vi.mocked(guestWishes).mockRejectedValue(new Error("guest_guestbook_list failed"));
  expect((await ask({})).status).toBe(503);
});

test("no wishes from a dead token is a 404; from a live page an empty 200", async () => {
  vi.mocked(guestWishes).mockResolvedValue([]);
  expect((await ask({})).status).toBe(200);
  vi.mocked(stillOpen).mockResolvedValue(false);
  expect((await ask({})).status).toBe(404);
});

test("the empty-answer check asks about this section", async () => {
  vi.mocked(guestWishes).mockResolvedValue([]);
  await ask({});
  expect(stillOpen).toHaveBeenLastCalledWith(TOKEN, "guestbook");
});
