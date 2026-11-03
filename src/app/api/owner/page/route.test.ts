import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T2.1b: the dashboard and wizard re-read the saved setup (owner UI O2, O3: "Reload saved choices",
// Try again). POST, because ownerAuth needs an Origin header and browsers leave it off a same-origin GET.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const read = (origin = "http://localhost:3000") =>
  POST(new NextRequest("http://localhost:3000/api/owner/page", { method: "POST", headers: { origin } }));

const PAGE = { version: 2, theme: "c_cozy", default_lang: "en", label_a: "Partner A", label_b: null, setup_completed: false };
const DRAFTS = { "wishes.button": { en: "Write to us", vi: "Viết cho tụi mình" } };
const answers = (page: unknown, drafts: unknown = DRAFTS) => (name: string) =>
  Promise.resolve({ data: name === "owner_page" ? page : drafts, error: null });

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f8" } } });
  rpc.mockReset().mockImplementation(answers(PAGE));
});

test("the saved page and its drafted wording come back, with no-store (Q124)", async () => {
  const res = await read();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ page: PAGE, drafts: DRAFTS });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc.mock.calls).toEqual([["owner_page"], ["owner_copy_drafts"]]);
});

test("no page yet is an answer, not an error", async () => {
  rpc.mockImplementation(answers(null, null));
  expect(await (await read()).json()).toEqual({ page: null, drafts: null });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("owner_page");
});

test("a database error on either read is a retryable 503, never 'no page'", async () => {
  for (const failing of ["owner_page", "owner_copy_drafts"]) {
    rpc.mockImplementation((name: string) =>
      Promise.resolve(name === failing ? { data: null, error: { code: "08006", message: "down" } } : { data: PAGE, error: null }));
    const res = await read();
    expect(res.status, failing).toBe(503);
    expect(res.headers.get("cache-control"), failing).toBe("no-store");
  }
});

test("origin, session and Auth outage are checked first", async () => {
  expect((await read("https://other.site")).status).toBe(403);
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await read()).status).toBe(401);
  getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError("Auth unreachable", 503) });
  expect((await read()).status).toBe(503);
  expect(rpc).not.toHaveBeenCalled();
});
