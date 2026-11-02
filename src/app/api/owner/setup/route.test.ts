import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T2.1a: the setup wizard's step saves (owner UI O3; design 3 §3.1, §1.6; E55, E15, E12). The database
// creates the page on the first save and checks the owner, the version, the time zone and the names.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const FIRST = {
  expected_version: null,
  theme: "b_cosmic",
  default_lang: "vi",
  label_a: null,
  label_b: null,
  timezone: "Asia/Ho_Chi_Minh",
  sections: ["memories"],
};

const save = (body: unknown, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/setup", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f6" } } });
  rpc.mockReset().mockResolvedValue({ data: 1, error: null });
});

test("a save returns the page's new version, with no-store", async () => {
  const res = await save(FIRST);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ version: 1 });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_save_page", FIRST);
});

test("names are trimmed and stored in NFC; a blank name is not set (E12)", async () => {
  await save({ ...FIRST, expected_version: 3, label_a: "  Pártner A ", label_b: "   " });
  expect(rpc).toHaveBeenCalledWith("owner_save_page", { ...FIRST, expected_version: 3, label_a: "Pártner A", label_b: null });
});

test("a save from a stale screen changes nothing and says so (E15)", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  const res = await save({ ...FIRST, expected_version: 2 });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "changed_elsewhere" });
});

test("a page whose setup is finished is not changed through setup (Q114, Q115)", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "55000", message: "setup is finished" } });
  const res = await save({ ...FIRST, expected_version: 4 });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "setup_finished" });
});

test("a malformed body is refused before the database", async () => {
  for (const body of [
    null,
    {},
    { ...FIRST, theme: "e_unknown" },
    { ...FIRST, default_lang: "fr" },
    { ...FIRST, timezone: 7 },
    { ...FIRST, sections: "memories" },
    { ...FIRST, sections: ["memories", "places"] },
    { ...FIRST, expected_version: "1" },
    { ...FIRST, expected_version: 1.5 },
    { ...FIRST, label_a: 5 },
    { ...FIRST, label_b: undefined },
    { ...FIRST, expected_version: 2 ** 31 },
    { ...FIRST, expected_version: 0 },
    [],
  ]) {
    expect((await save(body)).status, JSON.stringify(body)).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a foreign origin is refused before anything else", async () => {
  expect((await save(FIRST, "https://other.site")).status).toBe(403);
  expect(getUser).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});

test("no session is refused without calling the database", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await save(FIRST)).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});

test("an Auth outage is a retryable 503, not 401, and saves nothing", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError("Auth unreachable", 503) });
  expect((await save(FIRST)).status).toBe(503);
  expect(rpc).not.toHaveBeenCalled();
});

test("database answers map to the owner contract", async () => {
  for (const [code, status] of [
    ["42501", 403], // not an owner (a co-editor, E33)
    ["22023", 400], // unknown time zone, a control character or space in a name
    ["23514", 400], // a name of 0 or over 40 characters, or not in NFC
    ["22P02", 400], // a value the enum types refuse
    ["22P05", 400], // a NUL character, which text cannot hold
    ["08006", 503], // the database is unreachable: retryable
  ] as const) {
    rpc.mockResolvedValue({ data: null, error: { code, message: code } });
    const res = await save(FIRST);
    expect(res.status, code).toBe(status);
    expect(res.headers.get("cache-control"), code).toBe("no-store");
  }
});
