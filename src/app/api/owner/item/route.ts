import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, isVersion, ownerAuth } from "@/lib/owner-api";

// Create or edit one item (owner UI O5; design 3 §3.3, §1.6; T2.2). A new item sends the id the screen chose and no
// version, so a retry after a lost answer cannot make a second item; an edit names the version it read, so a stale
// screen changes nothing (E15). The database checks the owner, the kind rules and the text limits (owner_item_save).
const KINDS = ["memory", "milestone", "anniversary"];
const LANGS = ["en", "vi"];
const PRECISIONS = ["day", "month", "year"];

// Text is stored in NFC (E12). A title is trimmed; a blank body is not set. undefined marks a malformed value.
const text = (value: unknown, trim: boolean) =>
  value === null ? null : typeof value === "string" ? (trim ? value.trim() : value).normalize("NFC") : undefined;
const orNull = (value: string | null | undefined) => (value === "" ? null : value);
const oneOf = (value: unknown, list: string[]) => value === null || (typeof value === "string" && list.includes(value));

// Alt text per photo per language (O5): [{id, alt, alt_alt}], one entry per media at most (two for one media would
// leave which one wins undefined). The screen sends only changed entries. null or absent leaves alt text alone;
// undefined marks a malformed list.
// shortcut: 100 bounds the request, not the media; the server counts no media per item (Q139). Raise it if a limit is enforced.
const MAX_ALTS = 100;
const parseAlts = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length > MAX_ALTS) return undefined;
  const alts = value.map((a) => ({ id: a?.id, alt: text(a?.alt, false), alt_alt: text(a?.alt_alt, false) }));
  const ok = alts.every((a) => isUuid(a.id) && a.alt !== undefined && a.alt_alt !== undefined);
  return ok && new Set(alts.map((a) => a.id.toLowerCase())).size === alts.length ? alts : undefined;
};

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  const title = text(b?.title, true);
  const title_alt = orNull(text(b?.title_alt, true));
  const body = orNull(text(b?.body, false));
  const body_alt = orNull(text(b?.body_alt, false));
  const alts = parseAlts(b?.alts);
  if (
    !isUuid(b?.id) ||
    !(b.expected_version === null || isVersion(b.expected_version)) ||
    !KINDS.includes(b.kind) ||
    !LANGS.includes(b.lang) ||
    typeof title !== "string" ||
    title_alt === undefined ||
    body === undefined ||
    body_alt === undefined ||
    !(b.lang_alt === null || LANGS.includes(b.lang_alt)) ||
    !(b.event_date === null || (typeof b.event_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.event_date))) ||
    !oneOf(b.date_precision, PRECISIONS) ||
    typeof b.recurs_yearly !== "boolean" ||
    typeof b.remind_owner !== "boolean" ||
    alts === undefined
  ) {
    return answer(null, 400);
  }

  const { data, error } = await auth.rpc("owner_item_save", {
    item_id: b.id,
    expected_version: b.expected_version,
    kind: b.kind,
    lang: b.lang,
    title,
    body,
    lang_alt: b.lang_alt,
    title_alt,
    body_alt,
    event_date: b.event_date,
    date_precision: b.date_precision,
    recurs_yearly: b.recurs_yearly,
    remind_owner: b.remind_owner,
    alts,
  });
  if (error) return dbFailure(error);
  if (data === null) return answer({ error: "changed_elsewhere" }, 409);
  return answer(data, 200);
}
