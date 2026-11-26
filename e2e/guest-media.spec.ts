import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

// T3.1a against the real local Storage service (design 1 §5; owner, 2026-11-26; Q29): a guest with the token cookie
// gets a working 5-minute URL for a published memory's photo and nothing for a draft's photo (E56); without the cookie
// the route answers the generic not-available. The token page is e2e/global-setup.ts's E2E_PAGE (Memories enabled).
// Each browser project uses fresh ids. Placeholder data only.
const PAGE = "00000000-0000-0000-0000-0000000000e2";

test("guest media URLs are signed only for media the guest may see", async ({ request, baseURL }) => {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_DB_URL, E2E_GUEST_TOKEN } = process.env;
  const sql = postgres(SUPABASE_DB_URL!, { max: 1 });
  const storage = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!).storage.from("media-thumb");
  const origin = new URL(baseURL!).origin;
  const headers = { origin, "x-vegenus-guest": "1" };
  const [shown, draft] = [randomUUID(), randomUUID()];
  const media = { [shown]: randomUUID(), [draft]: randomUUID() };
  const path = (item: string) => `pages/${PAGE}/media/${media[item]}/thumb`;
  try {
    for (const [item, status] of [[shown, "published"], [draft, "draft"]]) {
      await sql`insert into public.items (id, page_id, kind, lang, title, event_date, date_precision)
        values (${item}, ${PAGE}, 'memory', 'en', 'Guest media test', '2024-05-01', 'day')`;
      if (status === "published") {
        await sql`update public.items i set status = 'published', published = public.item_snapshot(i) where i.id = ${item}`;
      }
      await sql`insert into public.media (id, page_id, item_id, kind, state, width, height)
        values (${media[item]}, ${PAGE}, ${item}, 'photo', 'ready', 4, 3)`;
      await sql`insert into public.media_variants (media_id, page_id, variant, bucket, path, mime, bytes, write_until)
        values (${media[item]}, ${PAGE}, 'thumb', 'media-thumb', ${path(item)}, 'image/webp', 5, now())`;
      expect((await storage.upload(path(item), new Blob(["bytes"], { type: "image/webp" }), { contentType: "image/webp" })).error).toBeNull();
    }
    const ask = () => request.post("/api/guest/media", { headers, data: { ids: Object.values(media), variant: "thumb" } });

    expect((await ask()).status()).toBe(404);

    expect((await request.post("/api/guest/session", { headers, data: { token: E2E_GUEST_TOKEN } })).status()).toBe(200);
    const res = await ask();
    expect(res.status()).toBe(200);
    const { urls } = await res.json();
    expect(Object.keys(urls)).toEqual([media[shown]]);
    const file = await request.get(urls[media[shown]]);
    expect(file.status()).toBe(200);
    expect(await file.text()).toBe("bytes");
  } finally {
    await storage.remove([path(shown), path(draft)]);
    await sql`delete from public.items where id in ${sql([shown, draft])}`;
    // Deleting the items queued their files for the worker; the files are gone already (as media-upload.spec.ts does).
    await sql`delete from public.storage_deletions where path in ${sql([path(shown), path(draft)])}`;
    await sql.end();
  }
});
