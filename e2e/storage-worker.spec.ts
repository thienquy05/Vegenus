import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

// T2.3c against the real local Storage service (design 3 §3.4; Q134): the daily cron route deletes a queued file
// through the Storage API and marks its deletion done only once the file is gone, and the reconcile catches a stray
// file that no row accounts for and deletes it in the same run. API-level; it runs in both browser projects (the lint
// forbids skipping a project), each with its own random paths, so two concurrent runs of the job are covered too.
const E2E_PAGE = "00000000-0000-0000-0000-0000000000e2";

test("the storage cron deletes queued and stray files, and frees their charge only once they are gone", async ({ request }) => {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_DB_URL, CRON_SECRET } = process.env;
  const storage = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!).storage.from("media-thumb");
  const sql = postgres(SUPABASE_DB_URL!, { max: 1 });
  const queued = `pages/${E2E_PAGE}/media/${randomUUID()}/thumb`;
  const stray = `pages/${E2E_PAGE}/media/${randomUUID()}/thumb`;
  const file = new Blob([new Uint8Array(64)], { type: "image/webp" });
  try {
    for (const path of [queued, stray]) {
      const { error } = await storage.upload(path, file, { contentType: "image/webp", upsert: false });
      expect(error, path).toBeNull();
    }
    const [{ id }] = await sql`insert into public.storage_deletions (page_id, bucket, path, bytes, not_before)
      values (${E2E_PAGE}, 'media-thumb', ${queued}, 64, now() - interval '1 minute') returning id::text`;

    expect((await request.get("/api/cron/storage", { headers: { authorization: "Bearer wrong" } })).status()).toBe(403);
    const res = await request.get("/api/cron/storage", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    expect(res.status()).toBe(200);
    // No count check: the other project's concurrent run may be the one that reconciles this stray file.

    const left = await sql`select name from storage.objects where bucket_id = 'media-thumb' and name in (${queued}, ${stray})`;
    expect(left).toHaveLength(0);
    const rows = await sql`select path, done_at is not null as done from public.storage_deletions where path in (${queued}, ${stray}) order by path`;
    expect(rows.map((r) => r.done)).toEqual([true, true]);
    expect(rows.some((r) => r.path === stray)).toBe(true);
    expect((await sql`select done_at is not null as done from public.storage_deletions where id = ${id}::bigint`)[0].done).toBe(true);
  } finally {
    await storage.remove([queued, stray]);
    await sql`delete from public.storage_deletions where path in (${queued}, ${stray})`;
    await sql.end();
  }
});
