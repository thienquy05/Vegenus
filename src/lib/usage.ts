// O10 Usage and the O2 attention line (owner UI "O10 Usage and the O2 attention line for T2.5"; PRD Q145). The
// snapshot is what `owner_usage()` returns (T2.5a); the rules are the approved boards' deriveUsage.
import { zoneFormat } from "./zone";
export type Usage = {
  total_bytes: number;
  budget_bytes: number;
  uploading_bytes: number;
  deleting_bytes: number;
  read_at: string;
  page_created_at: string;
  timezone: string;
  last_attempt_at: string | null;
  last_attempt_result: "200" | "200-deletion-failed" | "503" | null;
  last_success_at: string | null;
  last_success_corrections: number;
  has_run: boolean;
};
export type Level = "normal" | "notice" | "warning" | "full" | "zero";
export type Job = "ok" | "corrected" | "failed" | "missed" | "never";
export type Attention = "attention.missed" | "attention.failed" | "attention.zeroBudget" | "attention.full" | "attention.warning";

const MIB = 1048576;
const MISSED = 26 * 3600000; // Q145 5: a day plus the cron's ±59 minutes and slack, as the health route
const age = (from: string, at: string) => Date.parse(at) - Date.parse(from);

function job(u: Usage): Job {
  if (!u.has_run) return age(u.page_created_at, u.read_at) >= MISSED ? "missed" : "never";
  if (!u.last_success_at || age(u.last_success_at, u.read_at) >= MISSED) return "missed";
  if (u.last_attempt_result !== "200") return "failed";
  return u.last_success_corrections > 0 ? "corrected" : "ok";
}

function level(used: number, budget: number): Level {
  if (budget <= 0) return "zero";
  if (used >= budget) return "full";
  return used >= budget * 0.8 ? "warning" : used >= budget * 0.6 ? "notice" : "normal";
}

export function deriveUsage(u: Usage) {
  const l = level(u.total_bytes, u.budget_bytes);
  const j = job(u);
  const attention: Attention | null =
    j === "missed" || j === "failed" ? `attention.${j}` : l === "zero" ? "attention.zeroBudget" : l === "full" || l === "warning" ? `attention.${l}` : null;
  return {
    level: l,
    job: j,
    attention,
    percent: u.budget_bytes <= 0 ? 100 : Math.min(100, (100 * u.total_bytes) / u.budget_bytes),
    lastAttemptShown: !!u.last_attempt_at && u.last_attempt_at !== u.last_success_at,
  };
}

// Q145 15: what a refresh announces about the attention line (null: nothing changed).
const RANK = [null, "attention.warning", "attention.full", "attention.failed", "attention.missed"];
const rank = (a: Attention | null) => RANK.indexOf(a === "attention.zeroBudget" ? "attention.full" : a);
export function attentionChange(before: Attention | null, after: Attention | null) {
  if (before === after) return null;
  if (!after) return "usage.attentionCleared" as const;
  if (rank(after) === rank(before)) return after;
  return rank(after) > rank(before) ? ("usage.attentionHigher" as const) : ("usage.attentionLower" as const);
}

// Q145 16: MB as O6 shows them (MiB), rounded down so it never reads full before it is.
export const usageSize = (bytes: number, lang: "en" | "vi") =>
  bytes > 0 && bytes < MIB ? "<1 MB" : `${new Intl.NumberFormat(lang).format(Math.floor(bytes / MIB))} MB`;

// Q145 13: a time with its date, in the page time zone.
export const usageDate = (iso: string, timeZone: string, lang: "en" | "vi") =>
  zoneFormat(iso, timeZone, lang, { dateStyle: "medium", timeStyle: "short" });
