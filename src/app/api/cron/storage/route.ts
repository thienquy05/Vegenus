import { NextResponse } from "next/server";
import { machineAllowed } from "@/lib/machine";
import { deletionDone, dueDeletions, expireUploads, jobRecord, purgeWishes, reconcile } from "@/lib/server-db";
import { removeObjects } from "@/lib/storage-admin";

// The daily storage job (T2.3c; design 3 §3.4; Q134), called by Vercel cron (vercel.json). Order: expire overdue
// uploads, reconcile the buckets (queues orphans, corrects sizes), then delete the due files through the Storage API
// and mark each deletion done only when the database confirms the object is gone, so a failure keeps the bytes charged.
// Last, apart from that work, the wish purge (T3.2a, Q45): its failure is logged and never stops the storage run.
// It is also the keep-alive, and each run is recorded (T2.5a; Q145 3, 4): the health route and O10 read those rows.
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
  const started = new Date();
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
    // The log line is for the Vercel cron log; O10 and the health check read the recorded run.
    if (orphans || resized || failed) console.error("storage job needs attention", { orphans, resized, failed });
    const counts = { expired, orphans, resized, deleted, failed };
    // A success that cannot be recorded throws to the catch below: without its row the run looks missed, so say 503.
    // shortcut: a reply lost after the row committed records a 503 too (O10 shows failed while health stays 200); accept, it heals on the next run
    await jobRecord(started, failed ? "200-deletion-failed" : "200", counts);
    // Rejected wishes 30 days after the decision; reported in the answer, not in the storage run record.
    const wishesPurged = await purgeWishes().catch((error) => (console.error("wish purge failed", error), null));
    return answer({ ...counts, wishes_purged: wishesPurged }, 200);
  } catch (error) {
    console.error("storage job failed", error);
    await jobRecord(started, "503", null).catch((recordError) => console.error("storage job record failed", recordError));
    return answer(null, 503);
  }
}
