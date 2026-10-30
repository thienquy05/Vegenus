import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T1.5b: the owner's create-or-rotate call (design 1 §3.1, §3.2). The link leaves only in this one
// answer (Q34a), so every answer is no-store; a retry with the same request id never shows it again.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const TOKEN = "A".repeat(43);
const rotate = (body: unknown = { request_id: REQUEST_ID }, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/token", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f1" } } });
  rpc.mockReset().mockResolvedValue({ data: TOKEN, error: null });
});

test("the new link is returned once, with no-store", async () => {
  const res = await rotate();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ link: `http://localhost:3000/g#${TOKEN}` });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_rotate_token", { request_id: REQUEST_ID });
});

test("a repeated request id is 'already rotated' and carries no link", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  const res = await rotate();
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "already_rotated" });
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
  for (const status of [0, 503]) {
    getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError("Auth unreachable", status) });
    const res = await rotate();
    expect(res.status, String(status)).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a missing or malformed request id is refused", async () => {
  for (const body of [{}, { request_id: "not-a-uuid" }, { request_id: 1 }, null]) {
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
