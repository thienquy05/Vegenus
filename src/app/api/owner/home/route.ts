import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, isVersion, ownerAuth } from "@/lib/owner-api";

// Create or edit Home (owner UI O17; PRD Q144; T2.4). As an item save: a create sends the id the screen chose and no
// version, an edit names the version it read (E15). picks: up to seven photo ids in order; the database keeps only
// ready photos of the page's memories. A conflict (stale version, or a Home made elsewhere) is 409 and the screen
// re-reads. The database checks the owner and the 600-character note cap. Publish and Unpublish: /api/owner/item/status.
const LANGS = ["en", "vi"];
const MAX_PICKS = 7;

// The note is stored in NFC (E12); a blank one is not set. undefined marks a malformed value.
const note = (value: unknown) =>
  value === null ? null : typeof value === "string" ? value.normalize("NFC") || null : undefined;
const isPicks = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= MAX_PICKS &&
  value.every(isUuid) &&
  new Set(value.map((id: string) => id.toLowerCase())).size === value.length;

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  const body = note(b?.body);
  const body_alt = note(b?.body_alt);
  if (
    !isUuid(b?.id) ||
    !(b.expected_version === null || isVersion(b.expected_version)) ||
    !LANGS.includes(b.lang) ||
    !(b.lang_alt === null || LANGS.includes(b.lang_alt)) ||
    body === undefined ||
    body_alt === undefined ||
    !(b.start_date === null || (typeof b.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.start_date))) ||
    !isPicks(b.picks)
  ) {
    return answer(null, 400);
  }

  const { data, error } = await auth.rpc("owner_home_save", {
    item_id: b.id,
    expected_version: b.expected_version,
    lang: b.lang,
    body,
    lang_alt: b.lang_alt,
    body_alt,
    start_date: b.start_date,
    picks: b.picks,
  });
  if (error) return dbFailure(error);
  if (data === null) return answer({ error: "changed_elsewhere" }, 409);
  return answer(data, 200);
}
