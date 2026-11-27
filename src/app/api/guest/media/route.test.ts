import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T3.1a: guest media URLs (design 1 §5 guest_media_url; Q29). The token comes only from the HttpOnly cookie; the
// database decides which ids qualify, so a foreign or missing id is simply absent from the answer (E56).
vi.mock("@/lib/guest", async (original) => ({ ...(await original<typeof import("@/lib/guest")>()), guestMedia: vi.fn(), stillOpen: vi.fn() }));
const { guestMedia, stillOpen } = await import("@/lib/guest");
const { POST } = await import("./route");

const ID = "00000000-0000-0000-0000-0000000000c1";
const TOKEN = "A".repeat(43);
const ask = (body: unknown, { origin = "http://localhost:3000", guest = "1", cookie = `vegenus_g=${TOKEN}` } = {}) =>
  POST(
    new NextRequest("http://localhost:3000/api/guest/media", {
      method: "POST",
      headers: { origin, "x-vegenus-guest": guest, cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.mocked(guestMedia).mockReset().mockResolvedValue({ [ID]: "https://storage.example.test/signed" });
  vi.mocked(stillOpen).mockReset().mockResolvedValue(true);
});

test("another origin or a missing guest header is refused", async () => {
  expect((await ask({ ids: [ID], variant: "thumb" }, { origin: "https://evil.example.test" })).status).toBe(403);
  expect((await ask({ ids: [ID], variant: "thumb" }, { guest: "" })).status).toBe(403);
  expect(guestMedia).not.toHaveBeenCalled();
});

test.each([
  [{ ids: ["not-a-uuid"], variant: "thumb" }],
  [{ ids: ID, variant: "thumb" }],
  [{ ids: [ID], variant: "full" }],
  [{ ids: [ID], variant: "nope" }],
  [{ ids: Array.from({ length: 101 }, () => ID), variant: "thumb" }],
  [null],
])("a malformed request %j is a 400", async (body) => {
  expect((await ask(body)).status).toBe(400);
  expect(guestMedia).not.toHaveBeenCalled();
});

test("without a well-formed token cookie: the generic not-available answer", async () => {
  expect((await ask({ ids: [ID], variant: "thumb" }, { cookie: "" })).status).toBe(404);
  expect((await ask({ ids: [ID], variant: "thumb" }, { cookie: "vegenus_g=short" })).status).toBe(404);
  expect(guestMedia).not.toHaveBeenCalled();
});

// Design 1 §4, E30: with cookies blocked the visit runs from memory and the token comes in the body (reviewer, T3.1a).
test("cookies blocked: the token in the body is used; a malformed one is the generic answer", async () => {
  const other = "B".repeat(43);
  expect((await ask({ ids: [ID], variant: "thumb", token: other }, { cookie: "" })).status).toBe(200);
  expect(guestMedia).toHaveBeenLastCalledWith(other, [ID], "thumb");
  expect((await ask({ ids: [ID], variant: "thumb", token: "short" }, { cookie: "" })).status).toBe(404);
  // The body token wins: only a visit run from memory sends one, and its browser may hold an old cookie it cannot
  // replace (reviewer, T3.1b).
  await ask({ ids: [ID], variant: "thumb", token: other });
  expect(guestMedia).toHaveBeenLastCalledWith(other, [ID], "thumb");
});

test("signed URLs for the ids the database admits, never cached", async () => {
  const res = await ask({ ids: [ID], variant: "display" });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ urls: { [ID]: "https://storage.example.test/signed" } });
  expect(guestMedia).toHaveBeenCalledWith(TOKEN, [ID], "display");
});

test("a database or storage failure is a retryable 503", async () => {
  vi.mocked(guestMedia).mockRejectedValue(new Error("guest_media failed"));
  expect((await ask({ ids: [ID], variant: "thumb" })).status).toBe(503);
});

test("no URLs for a dead token is a 404; for a live page an empty 200", async () => {
  vi.mocked(guestMedia).mockResolvedValue({});
  expect((await ask({ ids: [ID], variant: "thumb" })).status).toBe(200);
  vi.mocked(stillOpen).mockResolvedValue(false);
  expect((await ask({ ids: [ID], variant: "thumb" })).status).toBe(404);
});
