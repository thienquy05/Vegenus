import { expect, test } from "vitest";
import { cardState, changedFields, counter, deletedCount, homeDirty, homeDraftOf, homeErrors, homeSaveBody, landed, type Home } from "./home";

// O2 Home card rules (owner UI "O17 Home editor and the O2 Home card"; PRD Q144 defaults 8 and 11; E14).
const HOME: Home = {
  id: "00000000-0000-0000-0000-0000000000d1",
  version: 3,
  status: "published",
  lang: "en",
  body: "Welcome",
  lang_alt: null,
  body_alt: null,
  start_date: "2020-02-29",
  published: { start_date: "2020-02-29" },
  published_at: "2026-11-01T00:00:00Z",
  timezone: "UTC",
  unpublished_changes: false,
  picks: [],
};

test("the card state comes from the read: none, draft, published, or published with unpublished changes", () => {
  expect(cardState(null)).toBe("new");
  expect(cardState({ ...HOME, status: "draft", published: null, published_at: null })).toBe("draft");
  expect(cardState(HOME)).toBe("published");
  expect(cardState({ ...HOME, unpublished_changes: true })).toBe("changes");
});

test("after Unpublish the card shows the draft line, with no counter claim (Q144 default 11)", () => {
  expect(cardState({ ...HOME, status: "draft", published: null })).toBe("draft");
});

test("the counter line: no start date, a future start, or the day number in the page time zone", () => {
  const now = new Date("2026-11-21T20:00:00Z");
  expect(counter(null, "UTC", now)).toEqual({ kind: "none" });
  expect(counter("2026-11-22", "UTC", now)).toEqual({ kind: "future", date: "2026-11-22" });
  expect(counter("2026-11-22", "Asia/Ho_Chi_Minh", now)).toEqual({ kind: "day", days: 1, utc: false });
  expect(counter("2026-11-20", "UTC", now)).toEqual({ kind: "day", days: 2, utc: false });
});

// T2.8 (CHECKS "Build contract"): a saved zone the browser rejects counts in UTC, flagged for the "(UTC)" label; the
// entered start date stays as entered.
test("a rejected zone counts in UTC across a UTC day boundary, flagged", () => {
  expect(counter("2026-11-21", "Not/A_Zone", new Date("2026-11-21T23:59:59Z"))).toEqual({ kind: "day", days: 1, utc: true });
  expect(counter("2026-11-21", "Not/A_Zone", new Date("2026-11-22T00:00:00Z"))).toEqual({ kind: "day", days: 2, utc: true });
  expect(counter("2026-11-23", "Not/A_Zone", new Date("2026-11-22T00:00:00Z"))).toEqual({ kind: "future", date: "2026-11-23" });
});

// O17 editor rules (owner UI O17; PRD Q144 defaults 2, 6, 10 and 23).
const ID = HOME.id;
const C1 = "00000000-0000-0000-0000-0000000000c1";
const C2 = "00000000-0000-0000-0000-0000000000c2";
const pick = (media_id: string) => ({ media_id, item_id: "00000000-0000-0000-0000-0000000000b1", alt: null, alt_alt: null, width: 4, height: 3, preview_url: null });
const SAVED: Home = { ...HOME, lang_alt: "vi", body_alt: "Chào", picks: [pick(C1), pick(C2)] };

test("the working copy starts from the saved Home, or empty in the page language; a save body mirrors the route", () => {
  const fresh = homeDraftOf(null, "vi");
  expect(fresh).toEqual({ lang: "vi", body: "", second: false, lang_alt: "en", body_alt: "", start_date: "", picks: [] });
  expect(homeSaveBody(fresh, ID, null)).toEqual({ id: ID, expected_version: null, lang: "vi", body: null, lang_alt: null, body_alt: null, start_date: null, picks: [] });
  const d = homeDraftOf(SAVED, "vi");
  expect(d).toMatchObject({ lang: "en", second: true, lang_alt: "vi", body_alt: "Chào", start_date: "2020-02-29" });
  expect(homeSaveBody({ ...d, body: "Café", second: false }, ID, 3)).toEqual({
    id: ID, expected_version: 3, lang: "en", body: "Café", lang_alt: null, body_alt: null, start_date: "2020-02-29", picks: [C1, C2],
  });
  // A second language with no note keeps the language: guests see the main note (Q144 default 6).
  expect(homeSaveBody({ ...d, body_alt: "" }, ID, 3)).toMatchObject({ lang_alt: "vi", body_alt: null });
});

test("dirty compares what a save would send", () => {
  expect(homeDirty(homeDraftOf(SAVED, "vi"), SAVED)).toBe(false);
  expect(homeDirty({ ...homeDraftOf(SAVED, "vi"), picks: [pick(C2), pick(C1)] }, SAVED)).toBe(true);
  expect(homeDirty(homeDraftOf(null, "vi"), null)).toBe(false);
  expect(homeDirty({ ...homeDraftOf(null, "vi"), start_date: "2020-01-01" }, null)).toBe(true);
  // A new Home whose only change is its main language is a change (reviewer, T2.4b).
  expect(homeDirty({ ...homeDraftOf(null, "vi"), lang: "en", lang_alt: "vi" }, null, "vi")).toBe(true);
});

test("each note is capped at 600 characters as the database counts them; the second language must differ", () => {
  const d = homeDraftOf(SAVED, "vi");
  expect(homeErrors(d)).toEqual([]);
  expect(homeErrors({ ...d, body: "😀".repeat(600) })).toEqual([]);
  expect(homeErrors({ ...d, body: "a".repeat(601), lang_alt: "en", body_alt: "b".repeat(601) })).toEqual([
    ["home-note", "home.noteError"],
    ["home-second-lang", "home.secondRule"],
    ["home-second-note", "home.noteError"],
  ]);
  // A second note the owner is removing is not checked.
  expect(homeErrors({ ...d, second: false, lang_alt: "en", body_alt: "b".repeat(601) })).toEqual([]);
});

test("an unconfirmed write landed only when the re-read shows it (Q144 default 23)", () => {
  const body = homeSaveBody({ ...homeDraftOf(SAVED, "vi"), body: "New" }, ID, 3);
  const after = { ...SAVED, version: 4, body: "New" };
  expect(landed({ op: "save", body, publish: false }, after)).toBe(true);
  expect(landed({ op: "save", body, publish: false }, SAVED)).toBe(false);
  expect(landed({ op: "save", body, publish: false }, { ...after, body: "Other" })).toBe(false);
  // The database leaves out a photo deleted meanwhile; the save still landed.
  expect(landed({ op: "save", body, publish: false }, { ...after, picks: [pick(C2)] })).toBe(true);
  expect(landed({ op: "save", body: { ...body, expected_version: null }, publish: false }, null)).toBe(false);
  expect(landed({ op: "publish", version: 3 }, { ...SAVED, version: 4 })).toBe(true);
  expect(landed({ op: "publish", version: 3 }, { ...SAVED, version: 4, unpublished_changes: true })).toBe(false);
  expect(landed({ op: "unpublish", version: 3 }, { ...SAVED, version: 4, status: "draft", published: null })).toBe(true);
  expect(landed({ op: "unpublish", version: 3 }, SAVED)).toBe(false);
});

test("the conflict panel names what changed: date, note, languages, photos, status", () => {
  expect(changedFields(SAVED, SAVED)).toEqual([]);
  expect(changedFields(SAVED, { ...SAVED, start_date: null, body_alt: null, lang: "vi", lang_alt: "en", picks: [], status: "draft", published: null })).toEqual([
    "home.start", "home.note", "content.mainLanguage", "content.language", "home.photos", "home.statusLabel",
  ]);
  // Created elsewhere: compared with an empty Home.
  expect(changedFields(null, { ...SAVED, lang_alt: null, body_alt: null, picks: [], lang: "vi" })).toEqual(["home.start", "home.note", "home.statusLabel"]);
});

test("photos sent but missing from the re-read were deleted meanwhile", () => {
  expect(deletedCount([C1, C2], { ...SAVED, picks: [pick(C2)] })).toBe(1);
  expect(deletedCount([C1], SAVED)).toBe(0);
});
