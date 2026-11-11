import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T2.3b: the owner's upload routes (owner UI O6; design 3 §3.4; E9, E10, E56). Begin admits the files in the database
// and mints one signed upload URL per admitted path with the owner's session (upsert false: a finished file cannot be
// overwritten, security review of T2.3a); the browser then uploads with the token. Complete, Cancel and Delete map the
// database's answers to statuses.
const getUser = vi.fn();
const rpc = vi.fn();
const createSignedUploadUrl = vi.fn();
const from = vi.fn(() => ({ createSignedUploadUrl }));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc, storage: { from } })),
}));
const begin = (await import("./begin/route")).POST;
const complete = (await import("./complete/route")).POST;
const cancel = (await import("./cancel/route")).POST;
const remove = (await import("./delete/route")).POST;

const ITEM = "00000000-0000-0000-0000-0000000000b1";
const MEDIA = "00000000-0000-0000-0000-0000000000c1";
const call = (handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown, origin = "http://localhost:3000") =>
  handler(
    new NextRequest(`http://localhost:3000/api/owner/${path}`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const ADMITTED = {
  media_id: MEDIA,
  write_until: "2026-11-11T12:05:00Z",
  files: [
    { variant: "thumb", bucket: "media-thumb", path: `pages/p/media/${MEDIA}/thumb`, max_bytes: 307200 },
    { variant: "display", bucket: "media-display", path: `pages/p/media/${MEDIA}/display`, max_bytes: 2097152 },
  ],
};

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000e1" } } });
  rpc.mockReset().mockResolvedValue({ data: ADMITTED, error: null });
  from.mockClear();
  createSignedUploadUrl.mockReset().mockImplementation(async (path: string) => ({ data: { path, token: `token-${path}` }, error: null }));
});

test("begin admits the files and returns one upload token per file, minted with upsert off", async () => {
  const res = await call(begin, "upload/begin", { item_id: ITEM, kind: "photo", variants: ["thumb", "display"] });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_upload_begin", { item_id: ITEM, kind: "photo", variants: ["thumb", "display"] });
  expect(from).toHaveBeenCalledWith("media-thumb");
  expect(createSignedUploadUrl).toHaveBeenCalledWith(ADMITTED.files[0].path, { upsert: false });
  expect(await res.json()).toEqual({
    media_id: MEDIA,
    write_until: ADMITTED.write_until,
    files: ADMITTED.files.map((f) => ({ ...f, token: `token-${f.path}` })),
  });
});

test("begin refuses malformed input before the database", async () => {
  for (const bad of [
    { item_id: "x", kind: "photo", variants: ["thumb", "display"] },
    { item_id: ITEM, kind: "gif", variants: ["thumb"] },
    { item_id: ITEM, kind: "photo", variants: "thumb" },
    { item_id: ITEM, kind: "photo", variants: ["thumb", "poster-x"] },
    { item_id: ITEM, kind: "photo", variants: [] },
  ]) {
    expect((await call(begin, "upload/begin", bad)).status).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("begin maps the database: storage full 409, not the caller's item 404, bad files 400, not an owner 403", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "53400" } });
  const full = await call(begin, "upload/begin", { item_id: ITEM, kind: "photo", variants: ["thumb", "display"] });
  expect(full.status).toBe(409);
  expect(await full.json()).toEqual({ error: "storage_full" });
  rpc.mockResolvedValue({ data: null, error: null });
  expect((await call(begin, "upload/begin", { item_id: ITEM, kind: "photo", variants: ["thumb", "display"] })).status).toBe(404);
  rpc.mockResolvedValue({ data: null, error: { code: "22023" } });
  expect((await call(begin, "upload/begin", { item_id: ITEM, kind: "photo", variants: ["thumb"] })).status).toBe(400);
  rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  expect((await call(begin, "upload/begin", { item_id: ITEM, kind: "photo", variants: ["thumb", "display"] })).status).toBe(403);
  expect(createSignedUploadUrl).not.toHaveBeenCalled();
});

test("if a token cannot be minted, begin cancels the upload so its reservation is released, and answers 503", async () => {
  createSignedUploadUrl.mockResolvedValueOnce({ data: null, error: { message: "new row violates row-level security policy" } });
  rpc.mockImplementation(async (fn: string) => (fn === "owner_upload_begin" ? { data: ADMITTED, error: null } : { data: true, error: null }));
  const res = await call(begin, "upload/begin", { item_id: ITEM, kind: "photo", variants: ["thumb", "display"] });
  expect(res.status).toBe(503);
  expect(rpc).toHaveBeenCalledWith("owner_upload_cancel", { media_id: MEDIA });
});

test("complete maps ready 200, too_large 422, incomplete 409, and an unknown or late upload 404", async () => {
  const done = (state: string | null) => (rpc.mockResolvedValue({ data: state, error: null }), call(complete, "upload/complete", { media_id: MEDIA, width: 1600, height: 1200, duration_ms: null }));
  const ready = await done("ready");
  expect(ready.status).toBe(200);
  expect(await ready.json()).toEqual({ state: "ready" });
  expect(rpc).toHaveBeenCalledWith("owner_upload_complete", { media_id: MEDIA, width: 1600, height: 1200, duration_ms: null });
  const big = await done("too_large");
  expect(big.status).toBe(422);
  expect(await big.json()).toEqual({ error: "too_large" });
  const part = await done("incomplete");
  expect(part.status).toBe(409);
  expect(await part.json()).toEqual({ error: "incomplete" });
  expect((await done(null)).status).toBe(404);
});

test("complete refuses malformed dimensions before the database", async () => {
  for (const bad of [
    { media_id: "x", width: 1, height: 1, duration_ms: null },
    { media_id: MEDIA, width: 0, height: 1, duration_ms: null },
    { media_id: MEDIA, width: 1.5, height: 1, duration_ms: null },
    { media_id: MEDIA, width: 1, height: 1, duration_ms: -1 },
  ]) {
    expect((await call(complete, "upload/complete", bad)).status).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("cancel and delete answer 200, or the same 404 for an unknown or foreign id (E56)", async () => {
  for (const [handler, path, fn] of [[cancel, "upload/cancel", "owner_upload_cancel"], [remove, "upload/delete", "owner_media_delete"]] as const) {
    rpc.mockResolvedValue({ data: true, error: null });
    expect((await call(handler, path, { media_id: MEDIA })).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(fn, { media_id: MEDIA });
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await call(handler, path, { media_id: MEDIA })).status).toBe(404);
    expect((await call(handler, path, { media_id: "x" })).status).toBe(400);
  }
});

test("every route refuses another origin and a signed-out caller before the database", async () => {
  for (const [handler, path] of [[begin, "upload/begin"], [complete, "upload/complete"], [cancel, "upload/cancel"], [remove, "upload/delete"]] as const) {
    expect((await call(handler, path, {}, "https://evil.example")).status).toBe(403);
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await call(handler, path, {})).status).toBe(401);
  }
  expect(rpc).not.toHaveBeenCalled();
});
