import { expect, test } from "vitest";
import { attentionChange, deriveUsage, usageDate, usageSize, type Usage } from "./usage";

// O10 Usage and the O2 attention line (owner UI "O10 Usage and the O2 attention line for T2.5"; PRD Q145 2, 4, 9,
// 12, 16, 18, 19). Rules lifted from the approved boards' deriveUsage (.design/usage/CHECKS.md). Placeholder data.
const MIB = 1048576;
const HOUR = 3600000;
const READ_AT = "2026-03-10T12:00:00.000Z";
const ago = (hours: number) => new Date(Date.parse(READ_AT) - hours * HOUR).toISOString();
const USAGE: Usage = {
  total_bytes: 120 * MIB,
  budget_bytes: 900 * MIB,
  uploading_bytes: 0,
  deleting_bytes: 0,
  read_at: READ_AT,
  page_created_at: "2025-01-01T03:00:00+00:00",
  timezone: "Asia/Ho_Chi_Minh",
  last_attempt_at: ago(9),
  last_attempt_result: "200",
  last_success_at: ago(9),
  last_success_corrections: 0,
  has_run: true,
};
const at = (fields: Partial<Usage>) => deriveUsage({ ...USAGE, ...fields });

test("storage levels are decided on raw bytes: normal, notice at 60 %, warning at 80 %, full at 100 % or more", () => {
  const budget = 1000;
  expect(at({ budget_bytes: budget, total_bytes: 599 }).level).toBe("normal");
  expect(at({ budget_bytes: budget, total_bytes: 600 }).level).toBe("notice");
  expect(at({ budget_bytes: budget, total_bytes: 799 }).level).toBe("notice");
  expect(at({ budget_bytes: budget, total_bytes: 800 }).level).toBe("warning");
  expect(at({ budget_bytes: budget, total_bytes: 999 }).level).toBe("warning");
  expect(at({ budget_bytes: budget, total_bytes: 1000 }).level).toBe("full");
  expect(at({ budget_bytes: budget, total_bytes: 1500 })).toMatchObject({ level: "full", percent: 100 });
});

test("a zero budget is its own level, with the meter full", () => {
  expect(at({ budget_bytes: 0, total_bytes: 0 })).toMatchObject({ level: "zero", percent: 100 });
  expect(at({ budget_bytes: 0, total_bytes: 5 }).level).toBe("zero");
});

test("sizes are whole MiB rounded down, and a non-zero amount under 1 MB reads <1 MB", () => {
  expect(usageSize(0, "en")).toBe("0 MB");
  expect(usageSize(1, "en")).toBe("<1 MB");
  expect(usageSize(MIB - 1, "vi")).toBe("<1 MB");
  expect(usageSize(MIB, "en")).toBe("1 MB");
  // Never reads full before it is: 899.99 MiB of 900 is 899.
  expect(usageSize(900 * MIB - 1, "en")).toBe("899 MB");
  expect(usageSize(1234 * MIB, "en")).toBe("1,234 MB");
  expect(usageSize(1234 * MIB, "vi")).toBe("1.234 MB");
});

test("the daily job: ok, corrected, failed while a success is under 26 hours old, missed from the last success", () => {
  expect(at({}).job).toBe("ok");
  expect(at({ last_success_corrections: 3 }).job).toBe("corrected");
  expect(at({ last_attempt_at: ago(1), last_attempt_result: "503" }).job).toBe("failed");
  expect(at({ last_attempt_at: ago(1), last_attempt_result: "200-deletion-failed" }).job).toBe("failed");
  // Measured from the last success, not the last attempt; missed outranks failed.
  expect(at({ last_attempt_at: ago(26), last_success_at: ago(26) }).job).toBe("missed");
  expect(at({ last_attempt_at: ago(25.99), last_success_at: ago(25.99) }).job).toBe("ok");
  expect(at({ last_attempt_at: ago(1), last_attempt_result: "503", last_success_at: ago(30) }).job).toBe("missed");
  expect(at({ last_attempt_at: ago(1), last_attempt_result: "503", last_success_at: null }).job).toBe("missed");
});

test("no run at all is neutral while the page is under 26 hours old, missed after that", () => {
  const none = { has_run: false, last_attempt_at: null, last_attempt_result: null, last_success_at: null } as const;
  expect(at({ ...none, page_created_at: ago(25.99) }).job).toBe("never");
  expect(at({ ...none, page_created_at: ago(26) }).job).toBe("missed");
});

test("the last attempt is shown only when it is not the last success", () => {
  expect(at({}).lastAttemptShown).toBe(false);
  expect(at({ last_attempt_at: ago(1), last_attempt_result: "503" }).lastAttemptShown).toBe(true);
  expect(at({ has_run: false, last_attempt_at: null, last_attempt_result: null, last_success_at: null }).lastAttemptShown).toBe(false);
});

test("the O2 attention line shows only the highest: missed > failed > no allowance or full > 80 %; 60 % and corrections never", () => {
  expect(at({}).attention).toBeNull();
  expect(at({ total_bytes: 600 * MIB, last_success_corrections: 4 }).attention).toBeNull();
  expect(at({ total_bytes: 720 * MIB }).attention).toBe("attention.warning");
  expect(at({ total_bytes: 900 * MIB }).attention).toBe("attention.full");
  expect(at({ budget_bytes: 0, total_bytes: 0 }).attention).toBe("attention.zeroBudget");
  expect(at({ total_bytes: 900 * MIB, last_attempt_at: ago(1), last_attempt_result: "503" }).attention).toBe("attention.failed");
  expect(at({ total_bytes: 900 * MIB, last_attempt_at: ago(1), last_attempt_result: "503", last_success_at: ago(27) }).attention).toBe("attention.missed");
});

test("a refresh announces the attention change once: cleared, lower, higher, or the same level's line", () => {
  expect(attentionChange(null, null)).toBeNull();
  expect(attentionChange("attention.failed", "attention.failed")).toBeNull();
  expect(attentionChange("attention.warning", null)).toBe("usage.attentionCleared");
  expect(attentionChange("attention.missed", "attention.warning")).toBe("usage.attentionLower");
  expect(attentionChange(null, "attention.warning")).toBe("usage.attentionHigher");
  expect(attentionChange("attention.warning", "attention.missed")).toBe("usage.attentionHigher");
  // No allowance ranks with full: a move between them names the new line.
  expect(attentionChange("attention.full", "attention.zeroBudget")).toBe("attention.zeroBudget");
});

test("times show with their date in the page time zone, per language", () => {
  expect(usageDate("2026-03-10T12:00:00.000Z", "Asia/Ho_Chi_Minh", "en")).toMatch(/Mar 10, 2026.*7:00\sPM/);
  expect(usageDate("2026-03-10T12:00:00.000Z", "UTC", "en")).toMatch(/12:00\sPM/);
});
