import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T2.3b: the owner's upload routes (owner UI O6; design 3 §3.4; E9, E10, E56). Begin admits the files in the database
// and mints one signed upload URL per admitted path with the owner's session (upsert false: a finished file cannot be
// overwritten, security review of T2.3a); the browser then uploads with the token. Complete, Cancel and Delete map the
// database's answers to statuses.
const getUser = vi.fn();
const rpc = vi.fn();
const createSignedUploadUrl = vi.fn();
const createSignedUrl = vi.fn();
const from = vi.fn(() => ({ createSignedUploadUrl, createSignedUrl }));
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
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
  createSignedUploadUrl
    .mockReset()
    .mockImplementation(async (path: string) => ({ data: { path, token: `token-${path}`, signedUrl: `https://storage.example/${path}?token=token-${path}` }, error: null }));
  createSignedUrl.mockReset().mockImplementation(async (path: string) => ({ data: { signedUrl: `https://storage.example/read/${path}` }, error: null }));
  fetchMock.mockReset().mockImplementation(async () => new Response(WEBP));
});

// Complete reads every stored file before the database marks the media ready (security gate, Phase 2): a minimal
// browser-made WebP passes the content check; zero bytes declared as WebP do not.
const WEBP = new Uint8Array([82, 73, 70, 70, 22, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32, 10, 0, 0, 0, 0x50, 0x01, 0x00, 0x9d, 0x01, 0x2a, 4, 0, 3, 0]); // a 4x3 lossy key frame header
const FILES = [
  { bucket: "media-thumb", path: `pages/p/media/${MEDIA}/thumb`, mime: "image/webp", present: true },
  { bucket: "media-video", path: `pages/p/media/${MEDIA}/video`, mime: "video/mp4", present: true },
];
const MP4 = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, ...new Array(52).fill(0)]);
const answers = (files: unknown, state: string | null = "ready") =>
  rpc.mockImplementation(async (fn: string) => ({
    data: fn === "owner_upload_files" ? files : fn === "owner_upload_complete" ? state : true,
    error: null,
  }));
const completeCall = () => call(complete, "upload/complete", { media_id: MEDIA, width: 1600, height: 1200, duration_ms: null });
const called = (fn: string) => rpc.mock.calls.some(([name]) => name === fn);

test("begin admits the files and returns one upload token and URL per file, minted with upsert off", async () => {
  const res = await call(begin, "upload/begin", { item_id: ITEM, kind: "photo", variants: ["thumb", "display"] });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_upload_begin", { item_id: ITEM, kind: "photo", variants: ["thumb", "display"] });
  expect(from).toHaveBeenCalledWith("media-thumb");
  expect(createSignedUploadUrl).toHaveBeenCalledWith(ADMITTED.files[0].path, { upsert: false });
  expect(await res.json()).toEqual({
    media_id: MEDIA,
    write_until: ADMITTED.write_until,
    // The URL lets the browser upload with XMLHttpRequest, which reports progress (O6), without knowing the Supabase address.
    files: ADMITTED.files.map((f) => ({ ...f, token: `token-${f.path}`, url: `https://storage.example/${f.path}?token=token-${f.path}` })),
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
  const done = (state: string | null) => (answers(FILES.slice(0, 1), state), completeCall());
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
  const wrongType = await done("invalid_file"); // a recorded type the bucket does not allow (Q141)
  expect(wrongType.status).toBe(409);
  expect(await wrongType.json()).toEqual({ error: "invalid_file" });
  expect((await done(null)).status).toBe(404);
});

test("complete reads each stored file, a photo whole and video only its first bytes, before marking it ready", async () => {
  answers(FILES);
  fetchMock.mockImplementation(async (url: string) => new Response(url.endsWith("/video") ? MP4 : WEBP));
  expect((await completeCall()).status).toBe(200);
  expect(createSignedUrl.mock.calls.map(([path]) => path)).toEqual(FILES.map((f) => f.path));
  const range = (n: number) => new Headers(fetchMock.mock.calls[n][1]?.headers).get("range");
  expect([range(0), range(1)]).toEqual([null, "bytes=0-63"]);
  expect(fetchMock.mock.calls.every(([, init]) => init?.signal instanceof AbortSignal)).toBe(true); // a read cannot hang
  expect(called("owner_upload_complete")).toBe(true);
});

test("a file whose bytes fail the check cancels the upload and answers 409 invalid_file", async () => {
  answers(FILES.slice(0, 1));
  fetchMock.mockImplementation(async () => new Response(new Uint8Array(5000)));
  const res = await completeCall();
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "invalid_file" });
  expect(rpc).toHaveBeenCalledWith("owner_upload_cancel", { media_id: MEDIA });
  expect(called("owner_upload_complete")).toBe(false);
});

test("a file not written yet answers incomplete before any read, so nothing can land after the check", async () => {
  answers([FILES[0], { ...FILES[1], mime: null, present: false }]);
  const res = await completeCall();
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "incomplete" });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(called("owner_upload_complete")).toBe(false);
});

test("no reservation answers 404, and a failed storage read answers 503 without completing or cancelling", async () => {
  answers(null);
  expect((await completeCall()).status).toBe(404);
  expect(called("owner_upload_complete")).toBe(false);
  const broken = () => fetchMock.mockResolvedValue({ ok: true, arrayBuffer: () => Promise.reject(new Error("reset")) });
  for (const fail of [() => fetchMock.mockResolvedValue(new Response(null, { status: 500 })), broken, () => createSignedUrl.mockResolvedValue({ data: null, error: { message: "not found" } })]) {
    rpc.mockReset();
    answers(FILES.slice(0, 1));
    fail();
    expect((await completeCall()).status).toBe(503);
    expect(called("owner_upload_complete") || called("owner_upload_cancel")).toBe(false);
  }
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
