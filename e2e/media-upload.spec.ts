import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

// T2.3b against the real local Storage service (design 3 §3.4; gate items of T2.3a's reviews): upload URLs are minted
// only for admitted paths, the browser uploads with the token alone, a finished file cannot be overwritten through its
// URL (upsert false), the bucket limits refuse an oversize file and a wrong type, and deleting the media queues its
// files behind the fence. API-level; it runs in each browser project as that project's owner (the lint forbids
// skipping a project), on a fresh item. Placeholder data only.
const PAGES = { chromium: "00000000-0000-0000-0000-0000000000e4", webkit: "00000000-0000-0000-0000-0000000000e5" }; // e2e/global-setup.ts

test("upload URLs obey the reservation, write once, and respect the bucket limits", async ({ request, baseURL }) => {
  const project = test.info().project.name as keyof typeof PAGES;
  const PAGE = PAGES[project];
  const OWNER = { email: `owner-${project}@example.test`, password: "placeholder-password-1" };
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_DB_URL } = process.env;
  const sql = postgres(SUPABASE_DB_URL!, { max: 1 });
  const item = randomUUID();
  const origin = new URL(baseURL!).origin;
  const post = (path: string, data: object) => request.post(path, { data, headers: { origin } });
  // The browser side: no session, only the upload token.
  const browser = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!).storage;
  // A structurally valid WebP of the given total size (RIFF header and one VP8 chunk): Complete checks the bytes.
  const webpBytes = (bytes: number) => {
    const b = Buffer.alloc(bytes);
    b.write("RIFF", 0, "latin1");
    b.writeUInt32LE(bytes - 8, 4);
    b.write("WEBPVP8 ", 8, "latin1");
    b.writeUInt32LE(bytes - 20, 16);
    return b;
  };
  const webp = (bytes: number) => new Blob([webpBytes(bytes)], { type: "image/webp" });
  const written: { bucket: string; path: string }[] = [];
  try {
    await sql`insert into public.items (id, page_id, kind, lang, title, event_date, date_precision)
      values (${item}, ${PAGE}, 'memory', 'en', 'Upload test', '2024-05-01', 'day')`;
    const login = await request.post("/api/owner/login", { form: { ...OWNER, next: "/app" }, headers: { origin }, maxRedirects: 0 });
    expect(login.status()).toBe(303);
    expect(new URL(login.headers().location).pathname).toBe("/app");

    // Begin admits two files and returns their tokens.
    const begun = await post("/api/owner/upload/begin", { item_id: item, kind: "photo", variants: ["thumb", "display"] });
    expect(begun.status()).toBe(200);
    const upload = await begun.json();
    expect(upload.files).toHaveLength(2);
    written.push(...upload.files);

    // A signed-in owner still cannot mint a URL for a path no reservation admits (the storage insert policy).
    const owner = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    expect((await owner.auth.signInWithPassword(OWNER)).error).toBeNull();
    const stray = await owner.storage.from("media-thumb").createSignedUploadUrl(`pages/${PAGE}/media/${randomUUID()}/thumb`, { upsert: false });
    expect(stray.error).not.toBeNull();

    // The browser uploads with the tokens; a wrong type is refused by the bucket.
    const [thumb, display] = upload.files;
    const wrongType = await browser.from(display.bucket).uploadToSignedUrl(display.path, display.token, new Blob(["x"], { type: "text/plain" }), { contentType: "text/plain" });
    expect(wrongType.error).not.toBeNull();
    expect((await browser.from(thumb.bucket).uploadToSignedUrl(thumb.path, thumb.token, webp(1000), { contentType: "image/webp" })).error).toBeNull();
    expect((await post("/api/owner/upload/complete", { media_id: upload.media_id, width: 400, height: 300, duration_ms: null })).status()).toBe(409);
    // As the O6 screen sends it: a plain PUT of the file to the URL Begin returned, with no Supabase client or key.
    const put = await request.put(display.url, { data: webpBytes(5000), headers: { "content-type": "image/webp", "x-upsert": "false" } });
    expect(put.status()).toBe(200);
    const done = await post("/api/owner/upload/complete", { media_id: upload.media_id, width: 1600, height: 1200, duration_ms: null });
    expect(done.status()).toBe(200);

    // The finished file cannot be overwritten through its still-valid URL.
    const again = await browser.from(thumb.bucket).uploadToSignedUrl(thumb.path, thumb.token, webp(200000), { contentType: "image/webp" });
    expect(again.error).not.toBeNull();
    const [{ size }] = await sql`select (metadata ->> 'size')::int as size from storage.objects where bucket_id = ${thumb.bucket} and name = ${thumb.path}`;
    expect(size).toBe(1000);

    // O5 reads the finished photo with a preview URL signed under the owner's session (the storage read policy of
    // 20261120120000_owner_content.sql) in place of its {bucket, path}; the URL serves the thumbnail. Another owner
    // cannot sign it.
    const read = await (await post("/api/owner/item/get", { id: item })).json();
    expect(read.item.media).toHaveLength(1);
    expect(read.item.media[0]).not.toHaveProperty("preview");
    const preview = await request.get(read.item.media[0].preview_url);
    expect(preview.status()).toBe(200);
    expect((await preview.body()).length).toBe(1000);
    const otherProject = project === "chromium" ? "webkit" : "chromium";
    const other = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    expect((await other.auth.signInWithPassword({ ...OWNER, email: `owner-${otherProject}@example.test` })).error).toBeNull();
    expect((await other.storage.from(thumb.bucket).createSignedUrl(thumb.path, 60)).error).not.toBeNull();
    expect((await owner.storage.from(thumb.bucket).createSignedUrl(thumb.path, 60)).error).toBeNull();

    // An oversize file is refused by its class bucket; cancelling releases nothing early.
    const second = await (await post("/api/owner/upload/begin", { item_id: item, kind: "photo", variants: ["thumb", "display"] })).json();
    written.push(...second.files);
    const big = await browser.from(second.files[0].bucket).uploadToSignedUrl(second.files[0].path, second.files[0].token, webp(307201), { contentType: "image/webp" });
    expect(big.error).not.toBeNull();
    expect((await post("/api/owner/upload/cancel", { media_id: second.media_id })).status()).toBe(200);

    // A token minted before the cancel still works for its 2 hours, but the file it writes stays charged: its deletion
    // is fenced until after every token of the upload has expired (Codex T2.3b).
    const late = second.files[1];
    expect((await browser.from(late.bucket).uploadToSignedUrl(late.path, late.token, webp(800), { contentType: "image/webp" })).error).toBeNull();
    const [held] = await sql`select not_before > now() + interval '2 hours' as fenced, done_at from public.storage_deletions where path = ${late.path}`;
    expect(held).toEqual({ fenced: true, done_at: null });

    // Minting closes 5 minutes after Begin, so every token expires before write_until (Codex T2.3b).
    const third = await (await post("/api/owner/upload/begin", { item_id: item, kind: "photo", variants: ["thumb", "display"] })).json();
    written.push(...third.files);
    await sql`update public.upload_reservations set created_at = now() - interval '6 minutes' where media_id = ${third.media_id}`;
    const lateMint = await owner.storage.from(third.files[0].bucket).createSignedUploadUrl(third.files[0].path, { upsert: false });
    expect(lateMint.error).not.toBeNull();

    // Bytes that are not the declared type are refused at Complete: the upload fails and its file is queued for
    // deletion (security gate, Phase 2).
    const fakeBegun = await post("/api/owner/upload/begin", { item_id: item, kind: "photo", variants: ["thumb", "display"] });
    expect(fakeBegun.status()).toBe(200);
    const fake = await fakeBegun.json();
    written.push(...fake.files);
    for (const [f, data] of [[fake.files[0], Buffer.alloc(900)], [fake.files[1], webpBytes(900)]]) {
      expect((await request.put(f.url, { data, headers: { "content-type": "image/webp", "x-upsert": "false" } })).status()).toBe(200);
    }
    const refused = await post("/api/owner/upload/complete", { media_id: fake.media_id, width: 400, height: 300, duration_ms: null });
    expect([refused.status(), await refused.json()]).toEqual([409, { error: "invalid_file" }]);
    expect((await sql`select state from public.media where id = ${fake.media_id}`)[0].state).toBe("failed");
    expect(await sql`select 1 from public.storage_deletions where path = any(${fake.files.map((f: { path: string }) => f.path)})`).toHaveLength(2);

    // Deleting the finished media queues its files behind the fence (its URLs could still write until then).
    expect((await post("/api/owner/upload/delete", { media_id: upload.media_id })).status()).toBe(200);
    const queued = await sql`select bytes, not_before > now() + interval '2 hours' as fenced from public.storage_deletions
      where path in (${thumb.path}, ${display.path}) order by bytes`;
    expect(queued.map((q) => [Number(q.bytes), q.fenced])).toEqual([[1000, true], [5000, true]]);
  } finally {
    await createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!).storage.from("media-thumb").remove(written.filter((w) => w.bucket === "media-thumb").map((w) => w.path));
    await createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!).storage.from("media-display").remove(written.filter((w) => w.bucket === "media-display").map((w) => w.path));
    await sql`delete from public.items where id = ${item}`;
    await sql`delete from public.storage_deletions where path = any(${written.map((w) => w.path)})`;
    await sql.end();
  }
});
