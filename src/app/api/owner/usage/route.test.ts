import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T2.5a (PRD Q145 13; owner UI "O10 Usage"): the one usage snapshot O2 and O10 read. POST, because ownerAuth needs an
// Origin header and browsers leave it off a same-origin GET.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const read = (origin = "http://localhost:3000") =>
  POST(new NextRequest("http://localhost:3000/api/owner/usage", { method: "POST", headers: { origin } }));

const USAGE = {
  total_bytes: 350, budget_bytes: 943718400, uploading_bytes: 300, deleting_bytes: 40, read_at: "2026-11-21T10:00:00+00:00",
  page_created_at: "2026-11-01T00:00:00+00:00", timezone: "UTC", last_attempt_at: null, last_attempt_result: null,
  last_success_at: null, last_success_corrections: 0, has_run: false,
};

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f8" } } });
  rpc.mockReset().mockResolvedValue({ data: USAGE, error: null });
});

test("the snapshot comes back with no-store", async () => {
  const res = await read();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ usage: USAGE });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledExactlyOnceWith("owner_usage");
});

test("no page (or not the owner) is an answer, never zeros", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  expect(await (await read()).json()).toEqual({ usage: null });
});

test("a database error is a retryable 503, never an empty snapshot", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "down" } });
  const res = await read();
  expect(res.status).toBe(503);
  expect(await res.text()).toBe("");
});

test("another origin is refused before the session is read; signed out is 401; an Auth outage is 503", async () => {
  expect((await read("https://evil.example")).status).toBe(403);
  expect(getUser).not.toHaveBeenCalled();
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await read()).status).toBe(401);
  getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError("Auth unreachable", 503) });
  expect((await read()).status).toBe(503);
  expect(rpc).not.toHaveBeenCalled();
});
