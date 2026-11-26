// Home rules for O17 and the O2 Home card (owner UI "O17 Home editor and the O2 Home card"; PRD Q144; E14). Pure
// functions, so the screens stay thin; the database checks the same limits (owner_home_save).
import { daysTogether } from "./counter";
import { safeZone } from "./zone";
import type { Lang } from "./content";

// One pick of POST /api/owner/home/get: hidden when its memory is unpublished (guests skip it).
export type Pick = {
  media_id: string;
  item_id: string;
  hidden: boolean;
  alt: string | null;
  alt_alt: string | null;
  width: number | null;
  height: number | null;
  preview_url: string | null;
};
// What POST /api/owner/home/get returns (owner_home_get); `published` is the snapshot guests read.
export type Home = {
  id: string;
  version: number;
  status: "draft" | "published";
  lang: Lang;
  body: string | null;
  lang_alt: Lang | null;
  body_alt: string | null;
  start_date: string | null;
  published: { start_date: string | null } | null;
  published_at: string | null;
  timezone: string;
  unpublished_changes: boolean;
  picks: Pick[];
};
// O2 reads Home on its own: no status or counter until the read answers, and a failed read is never "no Home".
export type HomeRead = { state: "loading" } | { state: "error" } | { state: "ready"; home: Home | null };

// The card's status line (Q144 defaults 8 and 11): a Home not published (never, or since Unpublish) is a draft.
export const cardState = (home: Home | null) =>
  !home ? "new" : !home.published ? "draft" : home.unpublished_changes ? "changes" : "published";

// The counter line for a start date in the page time zone (E14): none, starts later, or the day number. A saved zone
// the browser rejects counts in UTC, flagged for the "(UTC)" label (T2.8); the entered date stays as entered.
export function counter(start: string | null, timeZone: string, now = new Date()) {
  if (!start) return { kind: "none" } as const;
  const { zone, utc } = safeZone(timeZone);
  const days = daysTogether(start, zone, now);
  return days === null ? ({ kind: "future", date: start } as const) : ({ kind: "day", days, utc } as const);
}

// O17's working copy (Q144 defaults 2 and 6): the note per language, the start date as the date input's YYYY-MM-DD
// ("" when unset) and the picks in order with what the stack shows of them.
export type HomeDraft = { lang: Lang; body: string; second: boolean; lang_alt: Lang; body_alt: string; start_date: string; picks: Pick[] };
export type HomeBody = {
  id: string;
  expected_version: number | null;
  lang: Lang;
  body: string | null;
  lang_alt: Lang | null;
  body_alt: string | null;
  start_date: string | null;
  picks: string[];
};
// A write whose outcome is unknown (Q144 default 23): its payload and the version it named, kept for Try again.
export type Pending = { op: "save"; body: HomeBody; publish: boolean } | { op: "publish" | "unpublish"; version: number };

export const NOTE_MAX = 600;
// The database counts characters after NFC (char_length), so an emoji is one.
export const noteLength = (note: string) => [...note.normalize("NFC")].length;

export const homeDraftOf = (home: Home | null, lang: Lang, main = home?.lang ?? lang): HomeDraft => ({
  lang: main,
  body: home?.body ?? "",
  second: !!home?.lang_alt,
  lang_alt: home?.lang_alt ?? (main === "vi" ? "en" : "vi"),
  body_alt: home?.body_alt ?? "",
  start_date: home?.start_date ?? "",
  picks: home?.picks ?? [],
});

// What POST /api/owner/home receives, normalised as the route stores it (NFC; a blank note is not set).
export const homeSaveBody = (d: HomeDraft, id: string, version: number | null): HomeBody => ({
  id,
  expected_version: version,
  lang: d.lang,
  body: d.body.normalize("NFC") || null,
  lang_alt: d.second ? d.lang_alt : null,
  body_alt: d.second ? d.body_alt.normalize("NFC") || null : null,
  start_date: d.start_date || null,
  picks: d.picks.map((p) => p.media_id),
});

// lang: the page language a new Home starts in, so changing only the main language of a new Home is a change.
export const homeDirty = (d: HomeDraft, home: Home | null, lang: Lang = d.lang) =>
  JSON.stringify(homeSaveBody(d, "", null)) !== JSON.stringify(homeSaveBody(homeDraftOf(home, lang), "", null));

// The controls that block a save, each with its message, in screen order.
export function homeErrors(d: HomeDraft): [string, "home.noteError" | "home.secondRule"][] {
  const errors: [string, "home.noteError" | "home.secondRule"][] = [];
  if (noteLength(d.body) > NOTE_MAX) errors.push(["home-note", "home.noteError"]);
  if (d.second && d.lang_alt === d.lang) errors.push(["home-second-lang", "home.secondRule"]);
  if (d.second && noteLength(d.body_alt) > NOTE_MAX) errors.push(["home-second-note", "home.noteError"]);
  return errors;
}

// Whether the re-read shows the unconfirmed write took effect. A save landed when Home moved past the version it
// named with the content it sent (the database leaves out photos deleted meanwhile).
export function landed(p: Pending, read: Home | null): boolean {
  if (!read) return false;
  if (p.op !== "save") return read.version > p.version && (p.op === "publish" ? !!read.published && !read.unpublished_changes : !read.published);
  const b = p.body;
  return (
    read.id === b.id &&
    read.version > (b.expected_version ?? 0) &&
    read.lang === b.lang &&
    read.body === b.body &&
    read.lang_alt === b.lang_alt &&
    read.body_alt === b.body_alt &&
    read.start_date === b.start_date &&
    read.picks.every((pk) => b.picks.includes(pk.media_id))
  );
}

// The 409 panel's list of what the saved Home has that the one this screen read does not (none read: an empty Home).
export function changedFields(mine: Home | null, saved: Home) {
  const base: Home = mine ?? { ...saved, start_date: null, body: null, lang_alt: null, body_alt: null, picks: [], status: "draft" };
  const ids = (h: Home) => h.picks.map((p) => p.media_id).join();
  const keys = [
    base.start_date !== saved.start_date && "home.start",
    (base.body !== saved.body || base.body_alt !== saved.body_alt) && "home.note",
    base.lang !== saved.lang && "content.mainLanguage",
    base.lang_alt !== saved.lang_alt && "content.language",
    ids(base) !== ids(saved) && "home.photos",
    base.status !== saved.status && "home.statusLabel",
  ] as const;
  return keys.filter((key) => key !== false);
}

// Photos a save sent that its re-read no longer has: deleted meanwhile (one notice gives the count).
export const deletedCount = (sent: string[], read: Home) => sent.filter((id) => !read.picks.some((p) => p.media_id === id)).length;
