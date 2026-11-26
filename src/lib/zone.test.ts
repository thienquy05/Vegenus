import { expect, test } from "vitest";
import { safeZone, zoneFormat } from "./zone";

// T2.8 (owner UI O19, CHECKS "Build contract"): one safe zone formatter for Share, Usage, Home and the counter. A saved
// zone the browser rejects formats in UTC with a visible "(UTC)" label; the saved identifier itself is never changed.
test("a zone the browser accepts is used as saved, spelling included", () => {
  expect(safeZone("Asia/Ho_Chi_Minh")).toEqual({ zone: "Asia/Ho_Chi_Minh", utc: false });
  expect(safeZone("UTC")).toEqual({ zone: "UTC", utc: false });
});

test("a rejected zone falls back to UTC, flagged", () => {
  expect(safeZone("Not/A_Zone")).toEqual({ zone: "UTC", utc: true });
  expect(safeZone("")).toEqual({ zone: "UTC", utc: true });
});

test("formatting in a rejected zone uses UTC and says so; an accepted zone has no label", () => {
  const iso = "2026-03-10T12:00:00.000Z";
  expect(zoneFormat(iso, "Not/A_Zone", "en", { timeStyle: "short" })).toMatch(/^12:00\sPM \(UTC\)$/);
  expect(zoneFormat(iso, "Asia/Ho_Chi_Minh", "en", { timeStyle: "short" })).toMatch(/^7:00\sPM$/);
  expect(zoneFormat(iso, "Not/A_Zone", "vi", { dateStyle: "medium" })).toMatch(/2026 \(UTC\)$/);
});
