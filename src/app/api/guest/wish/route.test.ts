import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T3.2a: posting a wish (design 3 §3.9; guest UI §8; E11, E46, E47). The server names the page by the token or the
// Published page's name, keys the device by the vegenus_d cookie (24 h from its last use, Q103) and leaves every rule
// to the database: pending, idempotent per submission_id (Q73), limited per device, IP and page (Q75, Q78).
vi.mock("@/lib/server-db", () => ({ postWish: vi.fn() }));
const { postWish } = await import("@/lib/server-db");
const { POST } = await import("./route");

const TOKEN = "A".repeat(43);
const DEVICE = "D".repeat(43);
const SUB = "00000000-0000-0000-0000-000000000101";
const WISH = { submission_id: SUB, display_name: "[GUEST]", body: "[WISH_TEXT]", lang: "en", consent: 1 };
const ask = (body: unknown, { origin = "http://localhost:3000", guest = "1", cookie = `vegenus_g=${TOKEN}` } = {}) =>
  POST(
    new NextRequest("http://localhost:3000/api/guest/wish", {
      method: "POST",
      headers: { origin, "x-vegenus-guest": guest, cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const deviceCookie = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith("vegenus_d="));

beforeEach(() => {
  vi.mocked(postWish).mockReset().mockResolvedValue({ status: "sent" });
});

test("another origin or a missing guest header is refused, with no device cookie", async () => {
  for (const res of [await ask(WISH, { origin: "https://evil.example.test" }), await ask(WISH, { guest: "" })]) {
    expect(res.status).toBe(403);
    expect(deviceCookie(res)).toBeUndefined();
  }
  expect(postWish).not.toHaveBeenCalled();
});

test.each([
  [null],
  [{ ...WISH, submission_id: "nope" }],
  [{ ...WISH, display_name: 7 }],
  [{ ...WISH, body: null }],
  [{ ...WISH, lang: "fr" }],
  [{ ...WISH, display_name: "n".repeat(401) }],
  [{ ...WISH, body: "m".repeat(5001) }],
  [{ ...WISH, consent: undefined }], // T3.2c: a crafted post without consent stores nothing (privacy design §8 test 2)
  [{ ...WISH, consent: "1" }],
  [{ ...WISH, consent: 1.5 }],
  [{ ...WISH, consent: 0 }],
  [{ ...WISH, consent: 1e300 }], // beyond smallint: a 400, not a 503 that invites retries
])("a malformed wish %j is a 400 and reaches no database", async (body) => {
  expect((await ask(body)).status).toBe(400);
  expect(postWish).not.toHaveBeenCalled();
});

test("without a token or a page name: the generic not-available answer", async () => {
  expect((await ask(WISH, { cookie: "" })).status).toBe(404);
  expect(postWish).not.toHaveBeenCalled();
});

test("a sent wish: 200, never cached, and a new device cookie for 24 hours", async () => {
  const res = await ask(WISH);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ status: "sent" });
  const cookie = deviceCookie(res)!;
  expect(cookie).toMatch(/^vegenus_d=[A-Za-z0-9_-]{43};/);
  expect(cookie).toMatch(/Max-Age=86400/);
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=lax/i);
  const device = cookie.slice("vegenus_d=".length, cookie.indexOf(";"));
  expect(postWish).toHaveBeenCalledExactlyOnceWith(TOKEN, WISH, device, expect.any(Request));
});

test("an existing device cookie is reused and its 24 hours start again (Q103)", async () => {
  const res = await ask(WISH, { cookie: `vegenus_g=${TOKEN}; vegenus_d=${DEVICE}` });
  expect(deviceCookie(res)).toMatch(new RegExp(`^vegenus_d=${DEVICE};.*Max-Age=86400`));
  expect(vi.mocked(postWish).mock.calls[0][2]).toBe(DEVICE);
});

test("a malformed device cookie is replaced", async () => {
  await ask(WISH, { cookie: `vegenus_g=${TOKEN}; vegenus_d=short` });
  expect(vi.mocked(postWish).mock.calls[0][2]).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

test("a visitor on a Published page posts by the page's name, which wins over an old token cookie", async () => {
  await ask({ ...WISH, page: "our-page" });
  expect(vi.mocked(postWish).mock.calls[0][0]).toEqual({ page: "our-page" });
});

test("the daily limit: 429 with the wait in seconds and whether the network is shared", async () => {
  vi.mocked(postWish).mockResolvedValue({ status: "rate_limited", retry_after: 3600, shared: true });
  const res = await ask(WISH);
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({ error: "rate_limited", retry_after: 3600, shared: true });
  expect(deviceCookie(res)).toBeDefined();
});

test("a page the credential no longer opens is the not-available answer, with no device cookie", async () => {
  vi.mocked(postWish).mockResolvedValue(null);
  const res = await ask(WISH, { cookie: `vegenus_g=${TOKEN}` });
  expect(res.status).toBe(404);
  expect(deviceCookie(res)).toBeUndefined(); // set only by a post the page takes (privacy table)
});

test("the size cap counts code points: 40 ten-code-point emoji (600 UTF-16 units) and 500 of them reach the database", async () => {
  const emoji = "\u{1F469}\u{1F3FB}\u200D\u2764\uFE0F\u200D\u{1F48B}\u200D\u{1F468}\u{1F3FC}";
  expect([...emoji].length).toBe(10);
  expect((await ask({ ...WISH, display_name: emoji.repeat(40), body: emoji.repeat(500) })).status).toBe(200);
  expect(postWish).toHaveBeenCalledOnce();
});

test("a NUL character is refused here, never sent to the database (which fails on it, not 22023)", async () => {
  for (const body of [{ ...WISH, body: "a\u0000b" }, { ...WISH, display_name: "\u0000" }]) {
    expect((await ask(body)).status).toBe(400);
  }
  expect(postWish).not.toHaveBeenCalled();
});

test("text the database refuses is a 400; any other failure a retryable 503", async () => {
  vi.mocked(postWish).mockRejectedValue(Object.assign(new Error("refused"), { code: "22023" }));
  expect(await (await ask(WISH)).json()).toEqual({ error: "invalid" });
  vi.mocked(postWish).mockRejectedValue(new Error("db down"));
  expect((await ask(WISH)).status).toBe(503);
});

test("T3.2c: consent to an older notice is a 409 needs_consent, with no device cookie (nothing was charged)", async () => {
  vi.mocked(postWish).mockResolvedValue({ status: "needs_consent" });
  const res = await ask({ ...WISH, consent: 1 });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "needs_consent" });
  expect(deviceCookie(res)).toBeUndefined();
});
