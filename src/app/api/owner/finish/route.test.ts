import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T2.1b: Finish in the setup wizard (owner UI O3 step 6; Q114). One call accepts the drafted wording and
// opens the page as Token-only; the database refuses a second Finish and a page with a name missing.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const finish = (body: unknown = {}, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/finish", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f7" } } });
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
});

test("Finish opens the page as Token-only, with no-store", async () => {
  const res = await finish();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ visibility: "token_only" });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledExactlyOnceWith("owner_copy_accept_defaults", { visibility: "token_only" });
});

test("setup always finishes as Token-only, whatever the body asks (Q114)", async () => {
  await finish({ visibility: "published" });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("owner_copy_accept_defaults", { visibility: "token_only" });
});

test("database answers map to the owner contract", async () => {
  for (const [code, status, body] of [
    ["42501", 403, null], // not an owner, or no page yet
    ["55000", 409, { error: "setup_finished" }], // Finish already ran
    ["22023", 409, { error: "changed_elsewhere" }], // another session cleared a name or a wording field (Q125)
    ["PGRST202", 503, { error: "not_published" }], // refused before it ran: nothing was published
    ["57014", 503, { error: "not_published" }], // cancelled: the transaction rolled back
    ["", 502, { error: "outcome_unknown" }], // PostgREST never answered (status 0): the commit is unknown (Q126)
    ["08006", 502, { error: "outcome_unknown" }], // the connection broke: it may have broken after the commit
    ["PGRST000", 502, { error: "outcome_unknown" }],
    ["PGRST001", 502, { error: "outcome_unknown" }],
  ] as const) {
    rpc.mockResolvedValue({ data: null, error: { code, message: code } });
    const res = await finish();
    expect(res.status, code).toBe(status);
    expect(res.headers.get("cache-control"), code).toBe("no-store");
    expect(body ? await res.json() : await res.text(), code).toEqual(body ?? "");
  }
});

test("a foreign origin is refused before anything else", async () => {
  expect((await finish({}, "https://other.site")).status).toBe(403);
  expect(getUser).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

test("no session is refused without calling the database", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await finish()).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});

test("an Auth outage is a retryable 503, not 401, and publishes nothing", async () => {
  for (const error of [
    new AuthRetryableFetchError("Auth unreachable", 0),
    new AuthRetryableFetchError("Auth unreachable", 503),
    new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit"),
  ]) {
    getUser.mockResolvedValue({ data: { user: null }, error });
    expect((await finish()).status, error.message).toBe(503);
  }
  expect(rpc).not.toHaveBeenCalled();
});
