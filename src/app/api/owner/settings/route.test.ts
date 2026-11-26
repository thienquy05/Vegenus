import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T2.8: O19's per-panel settings save for a finished page (owner UI O19; Q115). Each panel sends only its touched
// fields with the saved values they were edited against ("conflict" when a saved value moved); a request id makes a
// retry of a committed save apply nothing; every success answers the owner_page() snapshot. Names follow the shared
// O3 rule and a refusal names the fields (`invalid_name`); the database refuses an unknown zone and a default language
// whose published wording is incomplete.
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const NAMES = {
  panel: "names",
  base: { label_a: "Partner A", default_lang: "en" },
  fields: { label_a: "Partner E", default_lang: "vi" },
  request_id: REQUEST_ID,
};
const SNAPSHOT = { version: 3, label_a: "Partner E", default_lang: "vi", setup_completed: true };
const save = (body: unknown, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/settings", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f1" } } });
  rpc.mockReset().mockResolvedValue({ data: SNAPSHOT, error: null });
});

test("a save answers the snapshot, with no-store", async () => {
  const res = await save(NAMES);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ page: SNAPSHOT });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_save_settings", NAMES);
});

test("names are sent trimmed and in NFC", async () => {
  await save({ ...NAMES, fields: { label_b: `  Pa${String.fromCodePoint(0x301)}rtner B ` }, base: { label_b: "Partner B" } });
  expect(rpc).toHaveBeenCalledWith("owner_save_settings", expect.objectContaining({ fields: { label_b: "Pártner B" } }));
});

test("invalid names are refused before the database, naming each field", async () => {
  const res = await save({
    ...NAMES,
    base: { label_a: "Partner A", label_b: "Partner B" },
    fields: { label_a: "   ", label_b: `Partner${String.fromCodePoint(0)}B` },
  });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "invalid_name", fields: { label_a: "required", label_b: "characters" } });
  for (const [label_a, reason] of [["x".repeat(41), "length"], ["", "required"]]) {
    const refused = await save({ ...NAMES, base: { label_a: "A" }, fields: { label_a } });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({ error: "invalid_name", fields: { label_a: reason } });
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("each panel saves its own fields; No suggestion is null", async () => {
  const zone = { panel: "timezone", base: { timezone: "UTC" }, fields: { timezone: "Europe/Paris" }, request_id: REQUEST_ID };
  const theme = { panel: "theme", base: { theme: "a_dreamy" }, fields: { theme: null }, request_id: REQUEST_ID };
  for (const body of [zone, theme, { ...theme, base: { theme: null }, fields: { theme: "c_cozy" } }]) {
    expect((await save(body)).status, JSON.stringify(body)).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith("owner_save_settings", body);
  }
});

test("a saved value that differs from its base is a conflict", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  const res = await save(NAMES);
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "conflict" });
});

test("before Finish the wizard owns these choices", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "55000" } });
  const res = await save(NAMES);
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "setup_not_finished" });
});

test("the database's refusals of the zone and the default language", async () => {
  for (const error of ["invalid_timezone", "wording_incomplete"]) {
    rpc.mockResolvedValue({ data: { error }, error: null });
    const res = await save(NAMES);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  }
});

test("not the owner is 403; an outage is 503", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  expect((await save(NAMES)).status).toBe(403);
  rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
  expect((await save(NAMES)).status).toBe(503);
});

test("malformed bodies are refused before the database", async () => {
  for (const body of [
    null,
    {},
    { ...NAMES, request_id: "x" },
    { ...NAMES, panel: "colour" },
    { ...NAMES, fields: {} },
    { ...NAMES, fields: "vi" },
    { ...NAMES, fields: { timezone: "UTC" }, base: { timezone: "UTC" } },
    { ...NAMES, base: { label_a: "Partner A" } },
    { ...NAMES, base: { ...NAMES.base, label_b: "Partner B" } },
    { ...NAMES, fields: { ...NAMES.fields, default_lang: "fr" } },
    { ...NAMES, base: { ...NAMES.base, default_lang: null } },
    { ...NAMES, fields: { ...NAMES.fields, label_a: null } },
    { ...NAMES, base: { ...NAMES.base, label_a: 1 } },
    { panel: "timezone", base: { timezone: "UTC" }, fields: { timezone: 1 }, request_id: REQUEST_ID },
    { panel: "timezone", base: { timezone: "UTC" }, fields: { timezone: "" }, request_id: REQUEST_ID },
    { panel: "theme", base: { theme: "a_dreamy" }, fields: { theme: "zodiac" }, request_id: REQUEST_ID },
  ]) {
    expect((await save(body)).status, JSON.stringify(body)).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("a foreign origin or no session is refused without calling the database", async () => {
  expect((await save(NAMES, "https://other.site")).status).toBe(403);
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await save(NAMES)).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
