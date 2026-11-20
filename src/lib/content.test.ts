import { expect, test } from "vitest";
import { displayDate, draftErrors, draftOf, eventDate, isDirty, itemAfterSave, leapDay, saveBody, unpublishedChanges, type Item } from "./content";

// O4 and O5 rules (owner UI "O4 Content list and O5 Item editor"; Q140; E12, E13, E15). Placeholder data only.
const ID = "00000000-0000-0000-0000-0000000000b1";
const C1 = "00000000-0000-0000-0000-0000000000c1";
const ITEM: Item = {
  id: ID,
  version: 3,
  kind: "memory",
  status: "published",
  lang: "vi",
  title: "Chuyến đi",
  body: "Biển",
  lang_alt: "en",
  title_alt: "The trip",
  body_alt: "Sea",
  event_date: "2022-06-01",
  date_precision: "month",
  recurs_yearly: false,
  remind_owner: false,
  published: {
    lang: "vi", title: "Chuyến đi", body: "Biển", lang_alt: "en", title_alt: "The trip", body_alt: "Sea",
    event_date: "2022-06-01", date_precision: "month", recurs_yearly: false, start_date: null, zodiac_system: null, zodiac_key: null,
  },
  media: [{ id: C1, kind: "photo", position: 0, width: 800, height: 600, duration_ms: null, alt: "Bãi biển", alt_alt: null, preview_url: null }],
};
const NEW = draftOf(null, { kind: "memory", lang: "vi" });
const valid = { ...NEW, title: "Tên", year: "2024", month: "5", day: "12" };

test("a saved item becomes a draft of fields, the date split by its precision and alt text by media", () => {
  expect(draftOf(ITEM, { kind: "memory", lang: "en" })).toEqual({
    kind: "memory", lang: "vi", title: "Chuyến đi", body: "Biển", second: true, lang_alt: "en", title_alt: "The trip", body_alt: "Sea",
    precision: "month", year: "2022", month: "6", day: "", recurs_yearly: false, remind_owner: false,
    alts: { [C1]: { alt: "Bãi biển", alt_alt: "" } },
  });
});

test("a new item starts empty in the chosen kind and the page's language, with the other language offered second", () => {
  expect(NEW).toMatchObject({ kind: "memory", lang: "vi", title: "", second: false, lang_alt: "en", precision: "day", alts: {} });
  expect(draftOf(null, { kind: "anniversary", lang: "en" })).toMatchObject({ kind: "anniversary", lang: "en", lang_alt: "vi", precision: "day" });
});

test("the stored date is the first day of a month or year (Q140); an impossible date is none", () => {
  expect(eventDate(valid)).toBe("2024-05-12");
  expect(eventDate({ ...valid, precision: "month" })).toBe("2024-05-01");
  expect(eventDate({ ...valid, precision: "year", month: "", day: "" })).toBe("2024-01-01");
  expect(eventDate({ ...valid, year: "987" })).toBe("0987-05-12");
  expect(eventDate({ ...valid, month: "2", day: "30" })).toBeNull();
  expect(eventDate({ ...valid, year: "2023", month: "2", day: "29" })).toBeNull();
  expect(eventDate({ ...valid, year: "2024", month: "2", day: "29" })).toBe("2024-02-29");
  expect(eventDate({ ...valid, year: "20x4" })).toBeNull();
  expect(eventDate({ ...valid, year: "0" })).toBeNull();
});

test("a row shows the date at its precision, never a made-up day", () => {
  expect(displayDate("2024-05-12", "day")).toBe("2024-05-12");
  expect(displayDate("2024-05-01", "month")).toBe("2024-05");
  expect(displayDate("2024-01-01", "year")).toBe("2024");
});

test("the leap-year hint shows for an Anniversary on 29 February only", () => {
  expect(leapDay({ ...valid, kind: "anniversary", month: "2", day: "29" })).toBe(true);
  expect(leapDay({ ...valid, kind: "anniversary", month: "02", day: "29" })).toBe(true);
  expect(leapDay({ ...valid, kind: "memory", month: "2", day: "29" })).toBe(false);
  expect(leapDay({ ...valid, kind: "anniversary", month: "2", day: "28" })).toBe(false);
});

test("errors name the control that is actually invalid, in screen order", () => {
  expect(draftErrors(valid, [])).toEqual([]);
  expect(draftErrors({ ...NEW, title: "   ", body: "x".repeat(5001) }, [])).toEqual([
    ["title", "titleError"], ["text", "textError"], ["year", "dateError"], ["month", "dateError"], ["day", "dateError"],
  ]);
  expect(draftErrors({ ...valid, title: "a".repeat(121) }, []).map(([id]) => id)).toEqual(["title"]);
  expect(draftErrors({ ...valid, title: "👍".repeat(120) }, [])).toEqual([]); // characters, not UTF-16 units
  expect(draftErrors({ ...valid, month: "2", day: "30" }, [])).toEqual([["day", "dateError"]]);
  expect(draftErrors({ ...valid, precision: "year", month: "", day: "" }, [])).toEqual([]);
  expect(draftErrors({ ...valid, second: true, lang_alt: "vi" }, [])).toEqual([
    ["language-vi", "secondError"], ["secondTitle", "titleError"], ["secondText", "secondError"],
  ]);
  expect(draftErrors({ ...valid, second: true, title_alt: "Name", body_alt: "Text" }, [])).toEqual([]);
});

test("alt text over 300 characters is an error on that photo's field in that language", () => {
  const draft = { ...valid, second: true, title_alt: "Name", body_alt: "Text", alts: { [C1]: { alt: "a".repeat(301), alt_alt: "b".repeat(301) } } };
  expect(draftErrors(draft, ITEM.media)).toEqual([[`alt-${C1}-vi`, "altError"], [`alt-${C1}-en`, "altError"]]);
  expect(draftErrors({ ...draft, second: false }, ITEM.media)).toEqual([[`alt-${C1}-vi`, "altError"]]);
});

test("the save body follows the route's shape: trimmed NFC title, no empty text, nulls without a second language", () => {
  expect(saveBody({ ...valid, title: "  Café ", body: "" }, ID, null, null)).toEqual({
    id: ID, expected_version: null, kind: "memory", lang: "vi", title: "Café", body: null, lang_alt: null, title_alt: null,
    body_alt: null, event_date: "2024-05-12", date_precision: "day", recurs_yearly: false, remind_owner: false, alts: null,
  });
  const base = draftOf(ITEM, { kind: "memory", lang: "vi" });
  const edited = { ...base, alts: { [C1]: { alt: "Bãi biển", alt_alt: "Beach" } } };
  expect(saveBody(edited, ID, 3, base)).toMatchObject({
    expected_version: 3, lang_alt: "en", title_alt: "The trip", body_alt: "Sea", event_date: "2022-06-01", date_precision: "month",
    alts: [{ id: C1, alt: "Bãi biển", alt_alt: "Beach" }],
  });
  expect(saveBody(base, ID, 3, base).alts).toBeNull(); // only changed alt text is sent
});

test("only Anniversary keeps repeat and remind; another kind sends both false", () => {
  expect(saveBody({ ...valid, recurs_yearly: true, remind_owner: true }, ID, null, null)).toMatchObject({ recurs_yearly: false, remind_owner: false });
  expect(saveBody({ ...valid, kind: "anniversary", recurs_yearly: true, remind_owner: true }, ID, null, null)).toMatchObject({
    recurs_yearly: true, remind_owner: true, date_precision: "day",
  });
});

test("a draft is dirty only when what would be saved changes", () => {
  const base = draftOf(ITEM, { kind: "memory", lang: "vi" });
  expect(isDirty(base, base)).toBe(false);
  expect(isDirty({ ...base, title: " Chuyến đi " }, base)).toBe(false);
  expect(isDirty({ ...base, title: "Chuyến đi khác" }, base)).toBe(true);
  expect(isDirty({ ...base, alts: { [C1]: { alt: "Bãi biển", alt_alt: "x" } } }, base)).toBe(true);
  expect(isDirty(valid, null)).toBe(true); // a new item is always unsaved
  // Alt text typed in decomposed form is stored composed (NFC), like every other field, so it is not a change.
  expect(isDirty({ ...base, alts: { [C1]: { ...base.alts[C1], alt: base.alts[C1].alt.normalize("NFD") } } }, base)).toBe(false);
});

test("unpublished changes: a published item whose saved fields differ from what guests see", () => {
  expect(unpublishedChanges(ITEM)).toBe(false);
  expect(unpublishedChanges({ ...ITEM, title: "Edited" })).toBe(true);
  expect(unpublishedChanges({ ...ITEM, status: "draft", published: null, title: "Edited" })).toBe(false);
});

test("after a save the item carries the saved fields and version, and keeps what guests see", () => {
  const base = draftOf(ITEM, { kind: "memory", lang: "vi" });
  const body = saveBody({ ...base, title: "Edited", alts: { [C1]: { alt: "New", alt_alt: "" } } }, ID, 3, base);
  const after = itemAfterSave(ITEM, body, 4);
  expect(after).toMatchObject({ version: 4, title: "Edited", status: "published", published: ITEM.published });
  expect(after.media[0]).toMatchObject({ alt: "New", alt_alt: null });
  expect(unpublishedChanges(after)).toBe(true);
  const created = itemAfterSave(null, saveBody(valid, ID, null, null), 1);
  expect(created).toMatchObject({ id: ID, version: 1, status: "draft", published: null, media: [] });
});
