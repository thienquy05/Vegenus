import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T1.5c: the owner's visibility switch (design 1 §6, §10.1; O9). Private and Published need an explicit
// confirm (screens O9); the database checks the owner and that the wording is published.
// T2.6 (Q146 20, 35): each save names a request id (a retry of a committed save applies nothing) and answers the
// owner_page() snapshot.
// T3.1p (Q151, Q155-Q157; owner UI "O9 Published address"): Published is a normal choice with a required page address;
// every save carries the draft's base {visibility, vanity_name, has_link}; a changed base is 409 conflict, an address
// another page holds or held is 409 name_taken, an address outside the rule is 400 invalid_name with its reason.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const SNAPSHOT = { visibility: "token_only", vanity_name: null, sections: ["home"], link: null };
const BASE = { visibility: "token_only", vanity_name: null, has_link: true };
const set = (body: unknown, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/visibility", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const save = (extra: object) => set({ base: BASE, request_id: REQUEST_ID, ...extra });

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f1" } } });
  rpc.mockReset().mockResolvedValue({ data: SNAPSHOT, error: null });
});

test.each([
  [{ visibility: "token_only" }],
  [{ visibility: "private", confirm: true }],
  [{ visibility: "token_only", vanity_name: "ignored-name" }],
])("%j is set with no address and answers the snapshot, with no-store", async (extra) => {
  const res = await save(extra);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ page: SNAPSHOT });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_set_visibility", {
    visibility: extra.visibility, vanity_name: null, base: BASE, request_id: REQUEST_ID,
  });
});

test("Published saves the normalized address", async () => {
  const res = await save({ visibility: "published", vanity_name: "  Our-Page\n", confirm: true });
  expect(res.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("owner_set_visibility", {
    visibility: "published", vanity_name: "our-page", base: BASE, request_id: REQUEST_ID,
  });
});

test.each([
  ["", "empty"],
  ["https://[HOST]/p/abc", "format"],
  ["đab", "characters"],
  ["a--b", "hyphens"],
  ["ab", "length"],
])("Published at %j is invalid_name %s, before the database", async (vanity_name, reason) => {
  const res = await save({ visibility: "published", vanity_name, confirm: true });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "invalid_name", reason });
  expect(rpc).not.toHaveBeenCalled();
});

test("Published without an address string is invalid_name empty", async () => {
  for (const vanity_name of [undefined, null, 7]) {
    const res = await save({ visibility: "published", vanity_name, confirm: true });
    expect(res.status, String(vanity_name)).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_name", reason: "empty" });
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a changed base is a conflict (the database answers null)", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  const res = await save({ visibility: "token_only" });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "conflict" });
});

test("an address another page holds or held is name_taken", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "the page address is taken" } });
  const res = await save({ visibility: "published", vanity_name: "taken-page", confirm: true });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "name_taken" });
});

test("a database name-rule refusal is invalid_name without a reason", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "check violation" } });
  const res = await save({ visibility: "published", vanity_name: "our-page", confirm: true });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "invalid_name" });
});

test("a missing or malformed base is refused before the database", async () => {
  for (const base of [undefined, null, {}, { ...BASE, visibility: "public" }, { ...BASE, has_link: "yes" },
    { ...BASE, vanity_name: 3 }, { visibility: "token_only", vanity_name: null }]) {
    expect((await save({ visibility: "token_only", base })).status, JSON.stringify(base)).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a missing or malformed request id is refused", async () => {
  for (const request_id of [undefined, "x", 1]) {
    expect((await save({ visibility: "token_only", request_id })).status, String(request_id)).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("Private and Published without confirm are refused before the database (O9)", async () => {
  for (const extra of [
    { visibility: "private" },
    { visibility: "published", vanity_name: "our-page", confirm: "yes" },
    { visibility: "private", confirm: false },
  ]) {
    const res = await save(extra);
    expect(res.status, JSON.stringify(extra)).toBe(400);
    expect(await res.json()).toEqual({ error: "confirm_required" });
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("an unknown or missing visibility is refused", async () => {
  for (const body of [{ base: BASE, request_id: REQUEST_ID }, { visibility: "public", base: BASE, request_id: REQUEST_ID },
    { visibility: 1, base: BASE, request_id: REQUEST_ID }, null]) {
    expect((await set(body)).status, JSON.stringify(body)).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a foreign origin is refused before anything else", async () => {
  expect((await set({ visibility: "token_only", base: BASE, request_id: REQUEST_ID }, "https://other.site")).status).toBe(403);
  expect(getUser).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

test("no session is refused without calling the database", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  const res = await save({ visibility: "token_only" });
  expect(res.status).toBe(401);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).not.toHaveBeenCalled();
});

// Codex, T1.5c: an Auth outage answers user null with a retryable error; that is not "signed out".
test("an Auth outage is a retryable 503, not 401, and changes nothing", async () => {
  // 429 (Codex, audit-fix round 2): Auth's rate limit comes back as an AuthApiError.
  for (const error of [
    new AuthRetryableFetchError("Auth unreachable", 0),
    new AuthRetryableFetchError("Auth unreachable", 503),
    new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit"),
  ]) {
    getUser.mockResolvedValue({ data: { user: null }, error });
    const res = await save({ visibility: "private", confirm: true });
    expect(res.status, String(error.status)).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a signed-in user who is not the owner is refused (E33)", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not the owner" } });
  expect((await save({ visibility: "token_only" })).status).toBe(403);
});

test("leaving Private before the wording is published is a conflict (design 3 §3.12)", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "wording not published" } });
  const res = await save({ visibility: "token_only" });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "wording_not_published" });
});

test("a database failure is a retryable 503", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "connection failure" } });
  const res = await save({ visibility: "token_only" });
  expect(res.status).toBe(503);
  expect(res.headers.get("cache-control")).toBe("no-store");
});
