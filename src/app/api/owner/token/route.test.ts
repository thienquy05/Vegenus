import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T1.5b: the owner's create-or-rotate call (design 1 §3.1, §3.2). The link leaves only in this one
// answer (Q34a), so every answer is no-store; a retry with the same request id never shows it again.
// T2.6 (Q146 10, 21): Create sends expected_version null, Rotate the active version; the answer names the new version.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const TOKEN = "A".repeat(43);
const rotate = (body: unknown = { request_id: REQUEST_ID, expected_version: 1 }, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/token", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f1" } } });
  rpc.mockReset().mockResolvedValue({ data: { token: TOKEN, version: 2 }, error: null });
});

test("the new link and its version are returned once, with no-store", async () => {
  const res = await rotate();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ link: `http://localhost:3000/g#${TOKEN}`, version: 2 });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_rotate_token", { request_id: REQUEST_ID, expected_version: 1 });
});

test("Create sends expected_version null (no active link expected)", async () => {
  rpc.mockResolvedValue({ data: { token: TOKEN, version: 1 }, error: null });
  expect((await rotate({ request_id: REQUEST_ID, expected_version: null })).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("owner_rotate_token", { request_id: REQUEST_ID, expected_version: null });
});

test.each(["already_rotated", "changed"])("'%s' is a 409 that carries no link", async (error) => {
  rpc.mockResolvedValue({ data: { error }, error: null });
  const res = await rotate();
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error });
  expect(res.headers.get("cache-control")).toBe("no-store");
});

test("a foreign origin is refused before anything else", async () => {
  expect((await rotate(undefined, "https://other.site")).status).toBe(403);
  expect(getUser).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

test("no session is refused without calling the database", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  const res = await rotate();
  expect(res.status).toBe(401);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).not.toHaveBeenCalled();
});

// Codex, T1.5c review: an Auth outage answers user null with a retryable error; that is not "signed out".
test("an Auth outage is a retryable 503, not 401, and rotates nothing", async () => {
  // 429 (Codex, audit-fix round 2): Auth's rate limit comes back as an AuthApiError.
  for (const error of [
    new AuthRetryableFetchError("Auth unreachable", 0),
    new AuthRetryableFetchError("Auth unreachable", 503),
    new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit"),
  ]) {
    getUser.mockResolvedValue({ data: { user: null }, error });
    const res = await rotate();
    expect(res.status, String(error.status)).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a missing or malformed request id or expected version is refused", async () => {
  for (const body of [
    {},
    { request_id: "not-a-uuid", expected_version: 1 },
    { request_id: 1, expected_version: 1 },
    null,
    // The precondition is required: a missing one would rotate whatever link is active (Q146 10).
    { request_id: REQUEST_ID },
    { request_id: REQUEST_ID, expected_version: 0 },
    { request_id: REQUEST_ID, expected_version: "1" },
    { request_id: REQUEST_ID, expected_version: 1.5 },
  ]) {
    expect((await rotate(body)).status, JSON.stringify(body)).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a signed-in user who is not the owner is refused (E33)", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not the owner" } });
  expect((await rotate()).status).toBe(403);
});

test("a database failure is a retryable 503", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "connection failure" } });
  const res = await rotate();
  expect(res.status).toBe(503);
  expect(res.headers.get("cache-control")).toBe("no-store");
});
