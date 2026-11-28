// The only connection as vegenus_server (design 3 §3.9): writes made without a verified identity. Its
// credentials are server-only; src/lib/server-db.test.ts fails if a module outside the routes that need it imports this.
import { createHmac } from "node:crypto";
import postgres from "postgres";
import type { Cred, Lang } from "./guest";

// prepare: false because the Supabase pooler runs in transaction mode.
const sql = postgres(process.env.VEGENUS_SERVER_DB_URL!, { max: 1, prepare: false });

// Keys for rate_limit_hits: no raw IP or address reaches the database. A missing secret throws.
const hmac = (value: string) => createHmac("sha256", process.env.VEGENUS_HMAC_SECRET!).update(value).digest();

// ponytail: the client IP is the first x-forwarded-for entry, which Vercel sets (unverified until the
// first deploy); on another host this must change
const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

export async function exchangeAllowed(request: Request): Promise<boolean> {
  const [row] = await sql`select public.guest_exchange_attempt(${hmac(`ip:${clientIp(request)}`)}) as ok`;
  return row.ok;
}

// The address budget is kept per IP, so failed attempts from another client cannot lock the owner out
// (Codex, Phase 1 security review; owner, 2026-10-30). Guessing from many IPs stays bounded by the per-IP budget.
export async function loginAllowed(request: Request, email: string): Promise<boolean> {
  const ip = clientIp(request);
  const [row] = await sql`select public.login_attempt(${hmac(`ip:${ip}`)}, ${hmac(`email:${ip}:${email}`)}) as ok`;
  return row.ok;
}

// A wish (T3.2a; design 3 §3.9): by token or by a Published page's name, keyed by the device cookie and the client IP.
// The database applies every rule; null is the one not-available answer. A refusal of the text throws with code 22023.
export type Wish = { submission_id: string; display_name: string; body: string; lang: Lang };
export type WishResult = { status: "sent" } | { status: "rate_limited"; retry_after: number; shared: boolean } | null;
export async function postWish(cred: Cred, w: Wish, device: string, request: Request): Promise<WishResult> {
  const d = hmac(`device:${device}`);
  const i = hmac(`ip:${clientIp(request)}`);
  const [row] =
    typeof cred === "string"
      ? await sql`select public.guest_guestbook_post(${cred}, ${w.submission_id}::uuid, ${d}, ${i}, ${w.display_name}, ${w.body}, ${w.lang}::public.lang) as r`
      : await sql`select public.public_guestbook_post(${cred.page}, ${w.submission_id}::uuid, ${d}, ${i}, ${w.display_name}, ${w.body}, ${w.lang}::public.lang) as r`;
  return row.r;
}

// Q45: rejected wishes 30 days after the decision, run by the daily job.
export async function purgeWishes(): Promise<number> {
  const [row] = await sql`select public.worker_purge_wishes() as n`;
  return row.n;
}

// The daily storage job (T2.3c; design 3 §3.4). Deletion ids are Postgres bigints, kept as strings.
export async function expireUploads(): Promise<number> {
  const [row] = await sql`select public.worker_expire_uploads() as n`;
  return row.n;
}

export async function reconcile(): Promise<{ orphans: number; resized: number }> {
  const [row] = await sql`select public.worker_reconcile() as r`;
  return row.r;
}

export async function dueDeletions(max: number): Promise<{ id: string; bucket: string; path: string }[]> {
  const rows = await sql`select id::text as id, bucket, path from public.worker_due_deletions(${max})`;
  return rows.map((r) => ({ id: r.id, bucket: r.bucket, path: r.path }));
}

export async function deletionDone(id: string): Promise<boolean> {
  const [row] = await sql`select public.worker_deletion_done(${id}::bigint) as ok`;
  return row.ok;
}

// T2.5a (Q145 3, 4): one row per daily run, no personal data. counts is null for a run that failed before it finished.
type JobResult = "200" | "200-deletion-failed" | "503";
type JobCounts = { expired: number; orphans: number; resized: number; deleted: number; failed: number };
export async function jobRecord(started: Date, result: JobResult, counts: JobCounts | null): Promise<void> {
  const c = counts ?? { expired: null, orphans: null, resized: null, deleted: null, failed: null };
  await sql`select public.worker_job_record(${started}, ${result}, ${c.expired}, ${c.orphans}, ${c.resized}, ${c.deleted}, ${c.failed})`;
}

// Q145 5, 6: a successful daily run in the last 26 hours.
export async function healthOk(): Promise<boolean> {
  const [row] = await sql`select public.health_ok() as ok`;
  return row.ok;
}
