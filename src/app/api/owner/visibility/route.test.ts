import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T1.5c: the owner's visibility switch (design 1 §6, §10.1; O9). Private and Published need an explicit
// confirm (screens O9); the database checks the owner and that the wording is published.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

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
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
});

test.each([
  [{ visibility: "token_only" }],
  [{ visibility: "private", confirm: true }],
  [{ visibility: "published", confirm: true }],
])("%j is set, with no-store", async (body) => {
  const res = await set(body);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ visibility: body.visibility });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_set_visibility", { visibility: body.visibility });
});

test("Private and Published without confirm are refused before the database (O9)", async () => {
  for (const body of [{ visibility: "private" }, { visibility: "published", confirm: "yes" }, { visibility: "private", confirm: false }]) {
    const res = await set(body);
    expect(res.status, JSON.stringify(body)).toBe(400);
    expect(await res.json()).toEqual({ error: "confirm_required" });
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("an unknown or missing visibility is refused", async () => {
  for (const body of [{}, { visibility: "public" }, { visibility: 1 }, null]) {
    expect((await set(body)).status, JSON.stringify(body)).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a foreign origin is refused before anything else", async () => {
  expect((await set({ visibility: "token_only" }, "https://other.site")).status).toBe(403);
  expect(getUser).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

test("no session is refused without calling the database", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  const res = await set({ visibility: "token_only" });
  expect(res.status).toBe(401);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).not.toHaveBeenCalled();
});

// Codex, T1.5c: an Auth outage answers user null with a retryable error; that is not "signed out".
test("an Auth outage is a retryable 503, not 401, and changes nothing", async () => {
  for (const status of [0, 503]) {
    getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError("Auth unreachable", status) });
    const res = await set({ visibility: "private", confirm: true });
    expect(res.status, String(status)).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a signed-in user who is not the owner is refused (E33)", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not the owner" } });
  expect((await set({ visibility: "token_only" })).status).toBe(403);
});

test("leaving Private before the wording is published is a conflict (design 3 §3.12)", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "wording not published" } });
  const res = await set({ visibility: "token_only" });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "wording_not_published" });
});

test("a database failure is a retryable 503", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "connection failure" } });
  const res = await set({ visibility: "token_only" });
  expect(res.status).toBe(503);
  expect(res.headers.get("cache-control")).toBe("no-store");
});
