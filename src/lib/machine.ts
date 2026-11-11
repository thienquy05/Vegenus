// requireMachine for routes of class `machine` (design 1 §9, design 7 §3): the daily Vercel cron sends
// "Authorization: Bearer <CRON_SECRET>" (Vercel docs, read through context7). No secret configured means no caller is
// allowed. Compared as hashes in constant time, so the length and content of the secret do not leak through timing.
import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

export function machineAllowed(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}
