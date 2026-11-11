import { NextResponse } from "next/server";
import { machineAllowed } from "@/lib/machine";
import { deletionDone, dueDeletions, expireUploads, reconcile } from "@/lib/server-db";
import { removeObjects } from "@/lib/storage-admin";

// The daily storage job (T2.3c; design 3 §3.4; Q134), called by Vercel cron (vercel.json). Order: expire overdue
// uploads, reconcile the buckets (queues orphans, corrects sizes), then delete the due files through the Storage API
// and mark each deletion done only when the database confirms the object is gone, so a failure keeps the bytes charged.
const answer = (body: object | null, status: number) => {
  const res = body ? NextResponse.json(body, { status }) : new NextResponse(null, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
};

// ponytail: 500 deletions a run; a backlog drains over several days. Raise it if O10 shows held bytes growing.
const BATCH = 500;
// shortcut: 5 s per run for the storage calls, well inside a Hobby function's limit (unverified); revisit with real timings
const STORAGE_WAIT_MS = 5_000;

export async function GET(request: Request) {
  if (!machineAllowed(request)) return answer(null, 403);
  try {
    const expired = await expireUploads();
    const { orphans, resized } = await reconcile();
    const byBucket = new Map<string, { id: string; path: string }[]>();
    for (const d of await dueDeletions(BATCH)) byBucket.set(d.bucket, [...(byBucket.get(d.bucket) ?? []), d]);

    // The buckets are deleted in parallel and given STORAGE_WAIT_MS at most, so a request that never answers cannot use
    // up the function's time (Codex T2.3c). Then, whatever storage answered, threw or left hanging, the database
    // decides each row: done only if its file is gone, otherwise it counts an attempt and goes behind untried rows.
    await Promise.all(
      [...byBucket].map(([bucket, rows]) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const giveUp = new Promise<false>((resolve) => (timer = setTimeout(() => resolve(false), STORAGE_WAIT_MS)));
        return Promise.race([removeObjects(bucket, rows.map((r) => r.path)).catch(() => false), giveUp]).finally(() =>
          clearTimeout(timer),
        );
      }),
    );
    let deleted = 0;
    let failed = 0;
    for (const rows of byBucket.values()) {
      for (const r of rows) {
        if (await deletionDone(r.id)) deleted++;
        else failed++;
      }
    }
    // shortcut: the alert is a log line until T2.5 adds the alert channel
    if (orphans || resized || failed) console.error("storage job needs attention", { orphans, resized, failed });
    return answer({ expired, orphans, resized, deleted, failed }, 200);
  } catch (error) {
    console.error("storage job failed", error);
    return answer(null, 503);
  }
}
