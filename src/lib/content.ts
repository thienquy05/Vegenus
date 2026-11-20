// O4 content list and O5 item editor rules (owner UI "O4 Content list and O5 Item editor"; Q140; E12, E13, E15).
// Pure functions, so the screens stay thin and the rules are tested once. The database checks the same limits.
export type Kind = "memory" | "milestone" | "anniversary";
export type Lang = "en" | "vi";
export type Precision = "day" | "month" | "year";
export type Section = "memories" | "together";

export type Media = {
  id: string;
  kind: "photo" | "video" | "audio";
  position: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  alt: string | null;
  alt_alt: string | null;
  preview_url: string | null;
};
// What POST /api/owner/item/get returns (owner_item_get): the working fields, and `published`, the snapshot guests read.
export type Item = {
  id: string;
  version: number;
  kind: Kind;
  status: "draft" | "published";
  lang: Lang;
  title: string;
  body: string | null;
  lang_alt: Lang | null;
  title_alt: string | null;
  body_alt: string | null;
  event_date: string;
  date_precision: Precision;
  recurs_yearly: boolean;
  remind_owner: boolean;
  published: Record<string, unknown> | null;
  media: Media[];
};
// One row of POST /api/owner/items (owner_items_list).
export type Row = {
  id: string;
  kind: Kind;
  status: "draft" | "published";
  lang: Lang;
  title: string;
  event_date: string;
  date_precision: Precision;
  unpublished_changes: boolean;
  version: number;
};

export type Alt = { alt: string; alt_alt: string };
// The editor's working copy: every control's value as typed.
export type Draft = {
  kind: Kind;
  lang: Lang;
  title: string;
  body: string;
  second: boolean;
  lang_alt: Lang;
  title_alt: string;
  body_alt: string;
  precision: Precision;
  year: string;
  month: string;
  day: string;
  recurs_yearly: boolean;
  remind_owner: boolean;
  alts: Record<string, Alt>;
};
export type ErrorKey = "titleError" | "textError" | "dateError" | "secondError" | "altError";

export const otherLang = (lang: Lang): Lang => (lang === "vi" ? "en" : "vi");
export const sectionOf = (kind: Kind): Section => (kind === "memory" ? "memories" : "together");
const nfc = (text: string) => text.normalize("NFC");
const chars = (text: string) => [...nfc(text)].length; // the database counts characters (char_length), not UTF-16 units
const precisionOf = (d: Draft): Precision => (d.kind === "anniversary" ? "day" : d.precision);

export function draftOf(item: Item | null, init: { kind: Kind; lang: Lang }): Draft {
  if (!item) {
    return {
      kind: init.kind, lang: init.lang, title: "", body: "", second: false, lang_alt: otherLang(init.lang), title_alt: "", body_alt: "",
      precision: "day", year: "", month: "", day: "", recurs_yearly: false, remind_owner: false, alts: {},
    };
  }
  const [y, m, d] = item.event_date.split("-");
  return {
    kind: item.kind,
    lang: item.lang,
    title: item.title,
    body: item.body ?? "",
    second: item.lang_alt !== null,
    lang_alt: item.lang_alt ?? otherLang(item.lang),
    title_alt: item.title_alt ?? "",
    body_alt: item.body_alt ?? "",
    precision: item.date_precision,
    year: String(Number(y)),
    month: item.date_precision === "year" ? "" : String(Number(m)),
    day: item.date_precision === "day" ? String(Number(d)) : "",
    recurs_yearly: item.recurs_yearly,
    remind_owner: item.remind_owner,
    alts: Object.fromEntries(item.media.map((media) => [media.id, { alt: media.alt ?? "", alt_alt: media.alt_alt ?? "" }])),
  };
}

const whole = (value: string, max: number) => (/^\d{1,4}$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null);
const daysIn = (year: number, month: number) =>
  month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

// Which date fields are wrong; a field the precision does not use is never wrong.
function dateFaults(d: Draft) {
  const precision = precisionOf(d);
  const year = whole(d.year, 9999);
  const month = precision === "year" ? 1 : whole(d.month, 12);
  const day = precision === "day" ? whole(d.day, 31) : 1;
  return {
    year: year === null,
    month: month === null,
    day: day === null || (year !== null && month !== null && day > daysIn(year, month)),
    value: { year, month, day },
  };
}

// Month and year precision store the first day of the period (Q140). null when the date is not valid.
export function eventDate(d: Draft): string | null {
  const f = dateFaults(d);
  if (f.year || f.month || f.day) return null;
  const { year, month, day } = f.value;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// A row shows only the parts the precision holds: never a made-up day.
export const displayDate = (date: string, precision: Precision) => date.slice(0, precision === "day" ? 10 : precision === "month" ? 7 : 4);

export const leapDay = (d: Draft) => d.kind === "anniversary" && Number(d.month) === 2 && Number(d.day) === 29;

// [control id, message] for every invalid control, in the order they appear on the screen.
export function draftErrors(d: Draft, media: Media[]): [string, ErrorKey][] {
  const errors: [string, ErrorKey][] = [];
  const title = chars(d.title.trim());
  if (title < 1 || title > 120) errors.push(["title", "titleError"]);
  if (chars(d.body) > 5000) errors.push(["text", "textError"]);
  const f = dateFaults(d);
  if (f.year) errors.push(["year", "dateError"]);
  if (f.month) errors.push(["month", "dateError"]);
  if (f.day) errors.push(["day", "dateError"]);
  if (d.second) {
    if (d.lang_alt === d.lang) errors.push([`language-${d.lang_alt}`, "secondError"]);
    const titleAlt = chars(d.title_alt.trim());
    if (titleAlt < 1 || titleAlt > 120) errors.push(["secondTitle", "titleError"]);
    if (!d.body_alt.trim()) errors.push(["secondText", "secondError"]);
    else if (chars(d.body_alt) > 5000) errors.push(["secondText", "textError"]);
  }
  for (const m of media.filter((m) => m.kind === "photo")) {
    const alt = d.alts[m.id] ?? { alt: "", alt_alt: "" };
    if (chars(alt.alt) > 300) errors.push([`alt-${m.id}-${d.lang}`, "altError"]);
    if (d.second && chars(alt.alt_alt) > 300) errors.push([`alt-${m.id}-${d.lang_alt}`, "altError"]);
  }
  return errors;
}

export type SaveBody = ReturnType<typeof saveBody>;
// The body of POST /api/owner/item. alts carries only the alt text that differs from base (null when none does), so
// a save never sends more entries than the owner changed.
export function saveBody(d: Draft, id: string, version: number | null, base: Draft | null) {
  const anniversary = d.kind === "anniversary";
  const alts = base
    ? Object.entries(d.alts)
        .filter(([key, a]) => nfc(a.alt) !== base.alts[key]?.alt || nfc(a.alt_alt) !== base.alts[key]?.alt_alt)
        .map(([key, a]) => ({ id: key, alt: nfc(a.alt), alt_alt: nfc(a.alt_alt) }))
    : [];
  return {
    id,
    expected_version: version,
    kind: d.kind,
    lang: d.lang,
    title: nfc(d.title.trim()),
    body: nfc(d.body) || null,
    lang_alt: d.second ? d.lang_alt : null,
    title_alt: d.second ? nfc(d.title_alt.trim()) : null,
    body_alt: d.second ? nfc(d.body_alt) || null : null,
    event_date: eventDate(d),
    date_precision: precisionOf(d),
    recurs_yearly: anniversary && d.recurs_yearly,
    remind_owner: anniversary && d.remind_owner,
    alts: alts.length ? alts : null,
  };
}

// Save draft and Publish enable only on real changes: what would be saved differs from what was saved.
export function isDirty(d: Draft, base: Draft | null) {
  if (!base) return true;
  const mine = saveBody(d, "", null, base);
  return mine.alts !== null || JSON.stringify({ ...mine, alts: null }) !== JSON.stringify(saveBody(base, "", null, base));
}

const SNAPSHOT = ["lang", "title", "body", "lang_alt", "title_alt", "body_alt", "event_date", "date_precision", "recurs_yearly"] as const;
// A published item whose saved fields differ from the snapshot guests read (owner_items_list computes the same).
export const unpublishedChanges = (item: Item) =>
  item.status === "published" && !!item.published && SNAPSHOT.some((field) => (item.published?.[field] ?? null) !== item[field]);

// The item as the server now holds it after a save answered `version`.
export function itemAfterSave(item: Item | null, body: SaveBody, version: number): Item {
  const alts = new Map((body.alts ?? []).map((a) => [a.id, a]));
  const media = (item?.media ?? []).map((m) => {
    const a = alts.get(m.id);
    const next = a ? { ...m, alt: a.alt || null, alt_alt: a.alt_alt || null } : m;
    return body.lang_alt === null ? { ...next, alt_alt: null } : next;
  });
  return {
    status: "draft",
    published: null,
    ...item,
    id: body.id,
    version,
    kind: body.kind,
    lang: body.lang,
    title: body.title,
    body: body.body,
    lang_alt: body.lang_alt,
    title_alt: body.title_alt,
    body_alt: body.body_alt,
    event_date: body.event_date ?? "",
    date_precision: body.date_precision,
    recurs_yearly: body.recurs_yearly,
    remind_owner: body.remind_owner,
    media,
  };
}
