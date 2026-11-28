import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T3.1b: a section's published items for G2 (and G4 in T3.1c), 50 at a time (design 1 §5 guest_list). The database
// checks the token, the page and the section (E5, E6); a dead token or a disabled section reads as an empty list.
vi.mock("@/lib/guest", async (original) => ({ ...(await original<typeof import("@/lib/guest")>()), guestList: vi.fn(), stillOpen: vi.fn() }));
const { guestList, stillOpen } = await import("@/lib/guest");
const { POST } = await import("./route");

const ID = "00000000-0000-0000-0000-0000000000b1";
const TOKEN = "A".repeat(43);
const ask = (body: unknown, { origin = "http://localhost:3000", guest = "1", cookie = `vegenus_g=${TOKEN}` } = {}) =>
  POST(
    new NextRequest("http://localhost:3000/api/guest/list", {
      method: "POST",
      headers: { origin, "x-vegenus-guest": guest, cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.mocked(guestList).mockReset().mockResolvedValue([{ id: ID, title: "[TITLE]" }]);
  vi.mocked(stillOpen).mockReset().mockResolvedValue(true);
});

test("another origin or a missing guest header is refused", async () => {
  expect((await ask({ section: "memories" }, { origin: "https://evil.example.test" })).status).toBe(403);
  expect((await ask({ section: "memories" }, { guest: "" })).status).toBe(403);
  expect(guestList).not.toHaveBeenCalled();
});

test.each([
  [{ section: "guestbook" }],
  [{ section: "home" }],
  [{ section: "memories", after: { sort: "1", id: ID } }],
  [{ section: "memories", after: { sort: 1, id: "nope" } }],
  [{ section: "memories", after: { sort: 1 } }],
  [null],
])("a malformed request %j is a 400", async (body) => {
  expect((await ask(body)).status).toBe(400);
  expect(guestList).not.toHaveBeenCalled();
});

test("without a token in the cookie or the body: the generic not-available answer", async () => {
  expect((await ask({ section: "memories" }, { cookie: "" })).status).toBe(404);
  expect(guestList).not.toHaveBeenCalled();
});

test("the first page, then the page after a cursor; cookies blocked sends the token in the body", async () => {
  const res = await ask({ section: "memories" });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ items: [{ id: ID, title: "[TITLE]" }] });
  expect(guestList).toHaveBeenLastCalledWith(TOKEN, "memories", null);
  const other = "B".repeat(43);
  await ask({ section: "together", after: { sort: 2.5, id: ID }, token: other }, { cookie: "" });
  expect(guestList).toHaveBeenLastCalledWith(other, "together", { sort: 2.5, id: ID });
});

// T3.1pc: a visitor at /p/<name> sends the page's name instead of a token; it wins over any old cookie, and a name that is
// not a normalized valid one is the not-available answer, never the cookie's page.
test("a visitor names the Published page; an invalid name is not available", async () => {
  expect((await ask({ section: "memories", page: "our-page" })).status).toBe(200);
  expect(guestList).toHaveBeenLastCalledWith({ page: "our-page" }, "memories", null);
  vi.mocked(guestList).mockClear();
  for (const page of ["Our-Page", "a b", 7]) expect((await ask({ section: "memories", page })).status).toBe(404);
  expect(guestList).not.toHaveBeenCalled();
});

// Review T3.1pc: a body that names a page at all decides the reader; a bad or empty name never falls back to the
// body token or the cookie's page.
test.each([[{ page: null, token: TOKEN }], [{ page: "Bad", token: TOKEN }], [{ page: "" }]])("%j reads nothing", async (extra) => {
  expect((await ask({ section: "memories", ...extra })).status).toBe(404);
  expect(guestList).not.toHaveBeenCalled();
});

test("a database failure is a retryable 503", async () => {
  vi.mocked(guestList).mockRejectedValue(new Error("guest_list failed"));
  expect((await ask({ section: "memories" })).status).toBe(503);
});

// Reviewer, T3.1b: an empty answer from a dead token is the not-available answer, so an open visit learns access is gone.
test("an empty list is checked: a dead token or a page no longer live is a 404; a live one is an empty 200", async () => {
  vi.mocked(guestList).mockResolvedValue([]);
  expect((await ask({ section: "memories" })).status).toBe(200);
  vi.mocked(stillOpen).mockResolvedValue(false);
  expect((await ask({ section: "memories" })).status).toBe(404);
});

test("a cursor sort that is not a finite number is a 400", async () => {
  const res = await POST(new NextRequest("http://localhost:3000/api/guest/list", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "x-vegenus-guest": "1", cookie: `vegenus_g=${TOKEN}`, "content-type": "application/json" },
    body: `{"section":"memories","after":{"sort":1e400,"id":"${ID}"}}`,
  }));
  expect(res.status).toBe(400);
});

test("the empty-answer check asks about this section", async () => {
  vi.mocked(guestList).mockResolvedValue([]);
  await ask({ section: "memories" });
  expect(stillOpen).toHaveBeenLastCalledWith(TOKEN, "memories");
});
