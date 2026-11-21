import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T2.4: the owner's Home routes (owner UI O17 and the O2 Home card; PRD Q144; E15, E33, E56, E12). The database
// checks the owner, the version, the picks and the note cap; the routes check the shape, normalise text to NFC, map
// the database's answers to statuses and sign the photo previews with the owner's session. Publish and Unpublish
// use the item status route.
const getUser = vi.fn();
const rpc = vi.fn();
const createSignedUrls = vi.fn();
const from = vi.fn(() => ({ createSignedUrls }));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc, storage: { from } })),
}));
const save = (await import("./route")).POST;
const get = (await import("./get/route")).POST;
const photos = (await import("./picker/route")).POST;

const ID = "00000000-0000-0000-0000-0000000000d1";
const C1 = "00000000-0000-0000-0000-0000000000c1";
const C2 = "00000000-0000-0000-0000-0000000000c2";
const call = (handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown, origin = "http://localhost:3000") =>
  handler(
    new NextRequest(`http://localhost:3000/api/owner/${path}`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const NEW = {
  id: ID,
  expected_version: null,
  lang: "en",
  body: "Welcome",
  lang_alt: null,
  body_alt: null,
  start_date: "2020-02-29",
  picks: [C2, C1],
};
const ARGS = {
  item_id: ID,
  expected_version: null,
  lang: "en",
  body: "Welcome",
  lang_alt: null,
  body_alt: null,
  start_date: "2020-02-29",
  picks: [C2, C1],
};
const signedAs = async (paths: string[]) => ({
  data: paths.map((p) => ({ path: p, signedUrl: `https://storage.test/${p}?token=t`, error: null })),
  error: null,
});

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000e1" } } });
  rpc.mockReset().mockResolvedValue({ data: { id: ID, version: 1 }, error: null });
  from.mockClear();
  createSignedUrls.mockReset().mockImplementation(signedAs);
});

test("a save returns Home's id and version, with no-store", async () => {
  const res = await call(save, "home", NEW);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ id: ID, version: 1 });
  expect(rpc).toHaveBeenCalledWith("owner_home_save", ARGS);
});

test("the note is normalised to NFC; a blank note is not set (E12)", async () => {
  await call(save, "home", { ...NEW, body: "Chào mừng".normalize("NFD"), lang_alt: "vi", body_alt: "" });
  expect(rpc).toHaveBeenCalledWith("owner_home_save", {
    ...ARGS,
    body: "Chào mừng".normalize("NFC"),
    lang_alt: "vi",
    body_alt: null,
  });
});

test("a stale save, a second Home and another page's id are the same conflict (E15, Q144 default 10)", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  const res = await call(save, "home", { ...NEW, expected_version: 3 });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "changed_elsewhere" });
});

test("the database's refusals map to statuses: not an owner 403, bad input 400, outage 503", async () => {
  for (const [code, status] of [["42501", 403], ["23514", 400], ["22023", 400], ["57014", 503]] as const) {
    rpc.mockResolvedValue({ data: null, error: { code } });
    expect((await call(save, "home", NEW)).status).toBe(status);
  }
});

test("a malformed save never reaches the database", async () => {
  const bad = [
    { ...NEW, id: "not-a-uuid" },
    { ...NEW, expected_version: 0 },
    { ...NEW, lang: "fr" },
    { ...NEW, lang_alt: "fr" },
    { ...NEW, body: 5 },
    { ...NEW, start_date: "29/02/2020" },
    { ...NEW, picks: null },
    { ...NEW, picks: ["not-a-uuid"] },
    { ...NEW, picks: [C1, C1.toUpperCase()] },
    { ...NEW, picks: Array.from({ length: 8 }, (_, i) => `00000000-0000-0000-0000-00000000000${i}`) },
  ];
  for (const body of bad) expect((await call(save, "home", body)).status, JSON.stringify(body)).toBe(400);
  expect((await call(save, "home", "{")).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});

test("every route refuses another origin and a signed-out caller before the database", async () => {
  for (const [handler, path] of [[save, "home"], [get, "home/get"], [photos, "home/picker"]] as const) {
    expect((await call(handler, path, NEW, "https://evil.test")).status).toBe(403);
  }
  getUser.mockResolvedValue({ data: { user: null } });
  for (const [handler, path] of [[save, "home"], [get, "home/get"], [photos, "home/picker"]] as const) {
    expect((await call(handler, path, NEW)).status).toBe(401);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("before a Home exists the read answers none, not a 404 (O2: Set up Home)", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  const res = await call(get, "home/get", {});
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ home: null });
  expect(rpc).toHaveBeenCalledWith("owner_home_get");
});

test("the Home read signs each pick's preview and hides the storage path", async () => {
  rpc.mockResolvedValue({
    data: {
      id: ID,
      version: 2,
      picks: [
        { media_id: C2, hidden: true, preview: { bucket: "media-thumb", path: "p/c2/thumb" } },
        { media_id: C1, hidden: false, preview: null },
      ],
    },
    error: null,
  });
  const res = await call(get, "home/get", {});
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    home: {
      id: ID,
      version: 2,
      picks: [
        { media_id: C2, hidden: true, preview_url: "https://storage.test/p/c2/thumb?token=t" },
        { media_id: C1, hidden: false, preview_url: null },
      ],
    },
  });
  expect(from).toHaveBeenCalledWith("media-thumb");
});

test("the picker lists memories with their photos' previews signed in one call", async () => {
  rpc.mockResolvedValue({
    data: [
      { item_id: "b4", title: "Newer", photos: [{ media_id: C2, preview: { bucket: "media-thumb", path: "p/c2/thumb" } }] },
      { item_id: "b1", title: "Beach", photos: [{ media_id: C1, preview: { bucket: "media-thumb", path: "p/c1/thumb" } }] },
    ],
    error: null,
  });
  const res = await call(photos, "home/picker", {});
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    memories: [
      { item_id: "b4", title: "Newer", photos: [{ media_id: C2, preview_url: "https://storage.test/p/c2/thumb?token=t" }] },
      { item_id: "b1", title: "Beach", photos: [{ media_id: C1, preview_url: "https://storage.test/p/c1/thumb?token=t" }] },
    ],
  });
  expect(rpc).toHaveBeenCalledWith("owner_home_photos");
  expect(createSignedUrls).toHaveBeenCalledTimes(1);
  expect(createSignedUrls).toHaveBeenCalledWith(["p/c2/thumb", "p/c1/thumb"], 3600);
});

test("a signing outage is a 503 on both reads, never photos without previews", async () => {
  createSignedUrls.mockResolvedValue({ data: null, error: { message: "down" } });
  const pick = { media_id: C1, preview: { bucket: "media-thumb", path: "p/c1/thumb" } };
  rpc.mockResolvedValue({ data: { id: ID, picks: [pick] }, error: null });
  expect((await call(get, "home/get", {})).status).toBe(503);
  rpc.mockResolvedValue({ data: [{ item_id: "b1", photos: [pick] }], error: null });
  expect((await call(photos, "home/picker", {})).status).toBe(503);
});

test("a database outage on either read is a 503", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "57014" } });
  expect((await call(get, "home/get", {})).status).toBe(503);
  expect((await call(photos, "home/picker", {})).status).toBe(503);
});
