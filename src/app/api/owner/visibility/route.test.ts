import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T1.5c: the owner's visibility switch (design 1 §6, §10.1; O9). Private and Published need an explicit
// confirm (screens O9); the database checks the owner and that the wording is published.
// T2.6 (Q146 20, 35): each save names a request id (a retry of a committed save applies nothing) and answers the
// owner_page() snapshot.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const SNAPSHOT = { visibility: "token_only", sections: ["home"], link: null };
const set = (body: unknown, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/visibility", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f1" } } });
  rpc.mockReset().mockResolvedValue({ data: SNAPSHOT, error: null });
});

test.each([
  [{ visibility: "token_only", request_id: REQUEST_ID }],
  [{ visibility: "private", confirm: true, request_id: REQUEST_ID }],
])("%j is set and answers the snapshot, with no-store", async (body) => {
  const res = await set(body);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ page: SNAPSHOT });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_set_visibility", { visibility: body.visibility, request_id: REQUEST_ID });
});

// Q146: Published is listed in O9 but cannot be chosen until the Phase 3 public guest route; the server refuses it too,
// so no client can store a choice that would make the page public the day that route ships (owner, 2026-11-22).
test("Published is refused until the public route exists, before the database", async () => {
  const res = await set({ visibility: "published", confirm: true, request_id: REQUEST_ID });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "not_available" });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).not.toHaveBeenCalled();
});

test("a missing or malformed request id is refused", async () => {
  for (const body of [{ visibility: "token_only" }, { visibility: "token_only", request_id: "x" }, { visibility: "token_only", request_id: 1 }]) {
    expect((await set(body)).status, JSON.stringify(body)).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("Private and Published without confirm are refused before the database (O9)", async () => {
  for (const body of [
    { visibility: "private", request_id: REQUEST_ID },
    { visibility: "published", confirm: "yes", request_id: REQUEST_ID },
    { visibility: "private", confirm: false, request_id: REQUEST_ID },
  ]) {
    const res = await set(body);
    expect(res.status, JSON.stringify(body)).toBe(400);
    expect(await res.json()).toEqual({ error: "confirm_required" });
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("an unknown or missing visibility is refused", async () => {
  for (const body of [{ request_id: REQUEST_ID }, { visibility: "public", request_id: REQUEST_ID }, { visibility: 1, request_id: REQUEST_ID }, null]) {
    expect((await set(body)).status, JSON.stringify(body)).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a foreign origin is refused before anything else", async () => {
  expect((await set({ visibility: "token_only", request_id: REQUEST_ID }, "https://other.site")).status).toBe(403);
  expect(getUser).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

test("no session is refused without calling the database", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  const res = await set({ visibility: "token_only", request_id: REQUEST_ID });
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
    const res = await set({ visibility: "private", confirm: true, request_id: REQUEST_ID });
    expect(res.status, String(error.status)).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a signed-in user who is not the owner is refused (E33)", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not the owner" } });
  expect((await set({ visibility: "token_only", request_id: REQUEST_ID })).status).toBe(403);
});

test("leaving Private before the wording is published is a conflict (design 3 §3.12)", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "wording not published" } });
  const res = await set({ visibility: "token_only", request_id: REQUEST_ID });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "wording_not_published" });
});

test("a database failure is a retryable 503", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "connection failure" } });
  const res = await set({ visibility: "token_only", request_id: REQUEST_ID });
  expect(res.status).toBe(503);
  expect(res.headers.get("cache-control")).toBe("no-store");
});
