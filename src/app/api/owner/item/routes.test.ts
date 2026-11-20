import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { beforeEach, expect, test, vi } from "vitest";

// T2.2: the owner's item routes (owner UI O4, O5; design 3 §1.6, §3.3; E15, E6, E33, E56, E12). The database
// checks the owner, the version, the kind rules and the text limits; the routes check the shape, normalise
// text to NFC, and map the database's answers to statuses.
const getUser = vi.fn();
const rpc = vi.fn();
const createSignedUrls = vi.fn();
const from = vi.fn(() => ({ createSignedUrls }));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc, storage: { from } })),
}));
const save = (await import("./route")).POST;
const status = (await import("./status/route")).POST;
const remove = (await import("./delete/route")).POST;
const get = (await import("./get/route")).POST;
const list = (await import("../items/route")).POST;

const ID = "00000000-0000-0000-0000-0000000000b1";
const call = (handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown, origin = "http://localhost:3000") =>
  handler(
    new NextRequest(`http://localhost:3000/api/owner/${path}`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

// A create carries the id the screen chose, so a retry after a lost answer cannot duplicate the item.
const NEW = {
  id: ID,
  expected_version: null,
  kind: "memory",
  lang: "en",
  title: "First trip",
  body: null,
  lang_alt: null,
  title_alt: null,
  body_alt: null,
  event_date: "2024-05-01",
  date_precision: "day",
  recurs_yearly: false,
  remind_owner: false,
};
const ARGS = {
  item_id: ID,
  expected_version: null,
  kind: "memory",
  lang: "en",
  title: "First trip",
  body: null,
  lang_alt: null,
  title_alt: null,
  body_alt: null,
  event_date: "2024-05-01",
  date_precision: "day",
  recurs_yearly: false,
  remind_owner: false,
  alts: null,
};

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000e1" } } });
  rpc.mockReset().mockResolvedValue({ data: { id: ID, version: 1 }, error: null });
  from.mockClear();
  createSignedUrls.mockReset();
});

test("a save returns the item's id and version, with no-store", async () => {
  const res = await call(save, "item", NEW);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ id: ID, version: 1 });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_item_save", ARGS);
});

test("text is normalised to NFC and a title is trimmed (E12)", async () => {
  await call(save, "item", { ...NEW, title: "  Café ", body: "Café" });
  expect(rpc).toHaveBeenCalledWith("owner_item_save", { ...ARGS, title: "Café", body: "Café" });
});

test("a save naming a stale version changes nothing and says so (E15)", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  const res = await call(save, "item", { ...NEW, id: ID, expected_version: 2 });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "changed_elsewhere" });
});

test("the database's refusals map to statuses: not an owner 403, bad input 400, outage 503", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  expect((await call(save, "item", NEW)).status).toBe(403);
  for (const code of ["22023", "23514", "22P02", "22P05", "22007", "22008"]) {
    rpc.mockResolvedValue({ data: null, error: { code } });
    expect((await call(save, "item", NEW)).status).toBe(400);
  }
  rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
  expect((await call(save, "item", NEW)).status).toBe(503);
});

test("a malformed save never reaches the database", async () => {
  for (const bad of [
    { ...NEW, id: "not-a-uuid", expected_version: 1 },
    { ...NEW, id: null }, // a create needs the id the screen chose
    { ...NEW, kind: "home" },
    { ...NEW, lang: "fr" },
    { ...NEW, title: 5 },
    { ...NEW, title: undefined },
    { ...NEW, event_date: "yesterday" },
    { ...NEW, date_precision: "week" },
    { ...NEW, recurs_yearly: "yes" },
  ]) {
    expect((await call(save, "item", bad)).status).toBe(400);
  }
  expect((await call(save, "item", null)).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});

test("every route refuses another origin and a signed-out caller before the database", async () => {
  for (const [handler, path] of [[save, "item"], [status, "item/status"], [remove, "item/delete"], [get, "item/get"], [list, "items"]] as const) {
    expect((await call(handler, path, {}, "https://evil.example")).status).toBe(403);
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await call(handler, path, {})).status).toBe(401);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("publish and unpublish return the next version; a stale one is a conflict", async () => {
  rpc.mockResolvedValue({ data: 3, error: null });
  const res = await call(status, "item/status", { id: ID, expected_version: 2, status: "published" });
  expect(await res.json()).toEqual({ version: 3 });
  expect(rpc).toHaveBeenCalledWith("owner_item_set_status", { item_id: ID, expected_version: 2, status: "published" });
  rpc.mockResolvedValue({ data: null, error: null });
  expect((await call(status, "item/status", { id: ID, expected_version: 1, status: "draft" })).status).toBe(409);
  expect((await call(status, "item/status", { id: ID, expected_version: 1, status: "gone" })).status).toBe(400);
});

test("delete answers 200, or 409 when the version is stale or the item is not the caller's", async () => {
  rpc.mockResolvedValue({ data: true, error: null });
  expect((await call(remove, "item/delete", { id: ID, expected_version: 1 })).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("owner_item_delete", { item_id: ID, expected_version: 1 });
  rpc.mockResolvedValue({ data: false, error: null });
  expect((await call(remove, "item/delete", { id: ID, expected_version: 1 })).status).toBe(409);
  expect((await call(remove, "item/delete", { id: "x", expected_version: 1 })).status).toBe(400);
});

test("one item is read by id; an unknown or foreign id is the same 404 (E56)", async () => {
  rpc.mockResolvedValue({ data: { id: ID, title: "T" }, error: null });
  expect(await (await call(get, "item/get", { id: ID })).json()).toEqual({ item: { id: ID, title: "T" } });
  rpc.mockResolvedValue({ data: null, error: null });
  expect((await call(get, "item/get", { id: ID })).status).toBe(404);
  expect((await call(get, "item/get", { id: "x" })).status).toBe(400);
});

test("a section's items are listed; an unknown section is refused", async () => {
  rpc.mockResolvedValue({ data: [{ id: ID }], error: null });
  expect(await (await call(list, "items", { section: "memories" })).json()).toEqual({ items: [{ id: ID }] });
  expect(rpc).toHaveBeenCalledWith("owner_items_list", { section: "memories" });
  expect((await call(list, "items", { section: "nope" })).status).toBe(400);
});

// O5 (owner UI "O4 Content list and O5 Item editor"): alt text per photo per language is saved with the item.
const C1 = "00000000-0000-0000-0000-0000000000c1";
const C2 = "00000000-0000-0000-0000-0000000000c2";

test("alt text is passed with the save, normalised to NFC; an empty one stays empty", async () => {
  await call(save, "item", { ...NEW, expected_version: 2, alts: [{ id: C1, alt: "Cafe\u0301", alt_alt: "" }, { id: C2, alt: null, alt_alt: null }] });
  expect(rpc).toHaveBeenCalledWith("owner_item_save", {
    ...ARGS,
    expected_version: 2,
    alts: [{ id: C1, alt: "Café", alt_alt: "" }, { id: C2, alt: null, alt_alt: null }],
  });
});

test("malformed alt text never reaches the database", async () => {
  for (const alts of [
    {},
    "x",
    [{ id: "not-a-uuid", alt: "a", alt_alt: null }],
    [{ alt: "a", alt_alt: null }],
    [{ id: C1, alt: 5, alt_alt: null }],
    [{ id: C1, alt: "a", alt_alt: ["b"] }],
    [null],
    [{ id: C1, alt: "a", alt_alt: null }, { id: C1, alt: "b", alt_alt: null }], // one media twice: which wins is undefined
    [{ id: C1.replace("c1", "C1"), alt: "a", alt_alt: null }, { id: C1, alt: "b", alt_alt: null }], // uuids ignore case
    Array.from({ length: 101 }, () => ({ id: randomUUID(), alt: "a", alt_alt: null })),
  ]) {
    expect((await call(save, "item", { ...NEW, expected_version: 2, alts })).status).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("the item read signs a preview URL for each media with the owner's session and hides the storage path", async () => {
  rpc.mockResolvedValue({
    data: {
      id: ID,
      media: [
        { id: C1, kind: "photo", preview: { bucket: "media-thumb", path: "p/c1/thumb" } },
        { id: C2, kind: "video", preview: { bucket: "media-display", path: "p/c2/poster" } },
        { id: ID, kind: "video", preview: null },
      ],
    },
    error: null,
  });
  createSignedUrls.mockImplementation(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `https://storage.test/${path}?token=t`, error: null })),
    error: null,
  }));
  const res = await call(get, "item/get", { id: ID });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    item: {
      id: ID,
      media: [
        { id: C1, kind: "photo", preview_url: "https://storage.test/p/c1/thumb?token=t" },
        { id: C2, kind: "video", preview_url: "https://storage.test/p/c2/poster?token=t" },
        { id: ID, kind: "video", preview_url: null },
      ],
    },
  });
  expect(from.mock.calls.map((c) => (c as unknown[])[0]).sort()).toEqual(["media-display", "media-thumb"]);
  expect(createSignedUrls).toHaveBeenCalledWith(["p/c1/thumb"], 3600);
});

test("up to 100 alt entries are accepted (the server does not count media per item; the screen sends changed ones)", async () => {
  const alts = Array.from({ length: 100 }, () => ({ id: randomUUID(), alt: "a", alt_alt: null }));
  expect((await call(save, "item", { ...NEW, expected_version: 2, alts })).status).toBe(200);
});

test("a file Storage cannot sign gets no preview URL; the rest of the item still loads", async () => {
  rpc.mockResolvedValue({
    data: { id: ID, media: [{ id: C1, preview: { bucket: "media-thumb", path: "p/c1/thumb" } }, { id: C2, preview: { bucket: "media-thumb", path: "p/gone" } }] },
    error: null,
  });
  createSignedUrls.mockResolvedValue({
    data: [
      { path: "p/c1/thumb", signedUrl: "https://storage.test/p/c1/thumb?token=t", error: null },
      { path: "p/gone", signedUrl: null, error: "Either the object does not exist or you do not have access to it" },
    ],
    error: null,
  });
  const res = await call(get, "item/get", { id: ID });
  expect(res.status).toBe(200);
  expect((await res.json()).item.media.map((m: { preview_url: string | null }) => m.preview_url)).toEqual([
    "https://storage.test/p/c1/thumb?token=t",
    null,
  ]);
});

test("an item without media signs nothing; a signing outage is a 503, not an item without previews", async () => {
  rpc.mockResolvedValue({ data: { id: ID, media: [] }, error: null });
  expect(await (await call(get, "item/get", { id: ID })).json()).toEqual({ item: { id: ID, media: [] } });
  expect(from).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ data: { id: ID, media: [{ id: C1, preview: { bucket: "media-thumb", path: "p/c1/thumb" } }] }, error: null });
  createSignedUrls.mockResolvedValue({ data: null, error: { message: "down" } });
  expect((await call(get, "item/get", { id: ID })).status).toBe(503);
});
