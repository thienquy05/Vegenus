// The only use of the Supabase secret key (design 7 §3): it bypasses every policy, so only the daily storage cron route
// and the guest media signer in src/lib/guest.ts import this module (src/app/api/cron/storage/route.test.ts fails
// otherwise; owner, 2026-11-26). The client is made per call, so a build
// without the key does not fail at import.
import { createClient } from "@supabase/supabase-js";

const admin = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

// Deletes objects through the Storage API (a direct SQL delete would leave the file behind). Whether each object is
// gone is confirmed by the database afterwards (worker_deletion_done), not by this answer.
// ponytail: the cron route passes at most 500 paths per run; chunk here if that limit grows.
export async function removeObjects(bucket: string, paths: string[]): Promise<boolean> {
  const { error } = await admin().storage.from(bucket).remove(paths);
  return !error;
}

// Signs read URLs for paths a database function has already admitted (guest_media); never for a path from a request.
// Null when Storage fails; a path it cannot sign comes back with a null signedUrl.
export async function signObjects(bucket: string, paths: string[], seconds: number) {
  const { data, error } = await admin().storage.from(bucket).createSignedUrls(paths, seconds);
  return error || !data ? null : data.map((d) => ({ path: d.path, signedUrl: d.signedUrl || null }));
}
