// The setup rules the dashboard (O2) and wizard (O3) share, kept free of the browser so they can be unit tested
// (owner UI "O2 and O3 revision for T2.1b"; Q114, Q121, Q125, Q126).

// Guests choose among these on their first visit; the owner may only suggest one (Q128).
export const THEMES = ["a_dreamy", "b_cosmic", "c_cozy", "d_elegant"] as const;
// Home is always on; Zodiac is not offered (Q118).
export const SECTIONS = ["memories", "together", "guestbook"] as const;

// What owner_page() returns.
export type Page = {
  version: number;
  theme: string | null;
  default_lang: string;
  label_a: string | null;
  label_b: string | null;
  timezone: string;
  visibility: string;
  setup_completed: boolean;
  sections: readonly string[];
};
// What owner_copy_drafts() returns: key -> language -> text.
export type Drafts = Record<string, Record<string, string>>;
// The wizard's unsaved choices; names as typed.
export type Draft = Pick<Page, "theme" | "default_lang" | "timezone"> & { label_a: string; label_b: string; sections: readonly string[] };

export const dashState = (page: Page | null) => (!page ? "empty" : page.setup_completed ? "done" : "resumed");

// Five steps since Q128: 1 language and names, 2 time zone, 3 sections, 4 wording, 5 review.
export const resumeStep = (page: Page) => (page.label_a === null || page.label_b === null ? 1 : 5);

// The characters owner_save_page refuses in a name, plus the line separators pages_labels_single_line refuses.
const BAD = /[\x01-\x1f\x7f-\x9f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u;

export function checkName(raw: string) {
  const value = raw.trim().normalize("NFC");
  const error = !value ? "required" : [...value].length > 40 ? "length" : BAD.test(value) ? "characters" : null;
  return { value, error } as const;
}

// Names the database would refuse, wherever the save starts (design ruling R3); a blank name waits for step 1.
export function nameErrors(draft: Draft) {
  const refused = (value: string) => {
    const { error } = checkName(value);
    return error === "required" ? null : error;
  };
  return { a: refused(draft.label_a), b: refused(draft.label_b) };
}

// The fields each step owns, compared with what was saved: Leave asks to discard only when the current step's differ
// (owner UI O3 states; the owner kept this wording, Q129).
export function stepDirty(step: number, draft: Draft, base: Draft) {
  const name = (value: string) => checkName(value).value;
  if (step === 1)
    return draft.default_lang !== base.default_lang || name(draft.label_a) !== name(base.label_a) || name(draft.label_b) !== name(base.label_b);
  if (step === 2) return draft.timezone !== base.timezone;
  if (step === 3) return [...draft.sections].sort().join() !== [...base.sections].sort().join();
  return false;
}

export const browserLang = (lang: string) => (lang.toLowerCase().startsWith("vi") ? "vi" : "en");

// The browser's zone when the list offers it, otherwise UTC, flagged for the owner to check at step 2.
export function proposeZone(browserZone: () => string | undefined, offered: readonly string[]) {
  try {
    const zone = browserZone();
    if (zone && offered.includes(zone)) return { zone, fallback: false };
  } catch {}
  return { zone: "UTC", fallback: true };
}

// The zone still to check (design ruling R1): the database stores no confirmation, so a saved UTC counts as unconfirmed
// on a page this session did not walk through (resume, Reload); with no page, the browser's proposal decides.
export const zoneFlagged = (page: Pick<Page, "timezone"> | null, proposedFallback: boolean) =>
  page ? page.timezone === "UTC" : proposedFallback;

// Every save re-sends every field and names the version it read (owner UI O3 states); the first one, from the names
// step, creates the page (Q128). The theme is only carried through: the owner never chooses it here.
export function saveBody(draft: Draft, version: number | null) {
  const name = (value: string) => checkName(value).value || null;
  return {
    expected_version: version,
    theme: draft.theme,
    default_lang: draft.default_lang,
    label_a: name(draft.label_a),
    label_b: name(draft.label_b),
    timezone: draft.timezone,
    sections: ["home", ...SECTIONS.filter((section) => draft.sections.includes(section))],
  };
}

const errorOf = (body: unknown) => (body as { error?: unknown } | null)?.error;

export function saveOutcome(status: number, body: unknown) {
  if (status === 200) return "ok";
  if (status === 409) return errorOf(body) === "setup_finished" ? "finished" : "conflict";
  if (status === 400) return "invalid";
  if (status === 401) return "signedOut";
  if (status === 403) return "accessLost";
  return "retry";
}

// Only the route's own "not_published" is a confirmed failure; a lost or unknown answer may follow a commit. After an
// uncertain Finish, a later failure says nothing about the first request, so it stays uncertain (Codex review).
export function finishOutcome(status: number, body: unknown, wasUncertain = false) {
  if (status === 200) return "done";
  if (status === 409) return errorOf(body) === "setup_finished" ? "finished" : "conflict";
  if (status === 503 && errorOf(body) === "not_published") return wasUncertain ? "uncertain" : "failed";
  if (status === 401) return "signedOut";
  if (status === 403) return "accessLost";
  return "uncertain";
}
