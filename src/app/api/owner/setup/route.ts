import type { NextRequest } from "next/server";
import { answer, isVersion, ownerAuth } from "@/lib/owner-api";

// Save the setup wizard's choices (owner UI O3; design 3 §3.1, §1.6; T2.1a). The first save creates the Private
// page and the caller's owner membership; later saves name the version they read, so a stale screen changes
// nothing (E15). The database checks the owner, the time zone and the names (owner_save_page).
const THEMES = ["a_dreamy", "b_cosmic", "c_cozy", "d_elegant"];
const LANGS = ["en", "vi"];
// Zodiac is not offered until T3.9 (Q118).
const SECTIONS = ["home", "memories", "together", "guestbook"];
// Bad input the database refuses: 22023 time zone or name characters, 23514 name length or NFC, 22P02 enum text,
// 22P05 a NUL character.
const BAD_INPUT = ["22023", "23514", "22P02", "22P05"];

// Names are stored trimmed and in NFC (E12); a blank name is not set yet. undefined marks a malformed value.
const name = (value: unknown) =>
  value === null ? null : typeof value === "string" ? value.trim().normalize("NFC") || null : undefined;

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => null);
  const { expected_version, theme, default_lang, timezone, sections } = body ?? {};
  const label_a = name(body?.label_a);
  const label_b = name(body?.label_b);
  if (
    !(expected_version === null || isVersion(expected_version)) ||
    // No theme: guests choose it; the owner may only suggest one (Q128).
    !(theme === null || THEMES.includes(theme)) ||
    !LANGS.includes(default_lang) ||
    typeof timezone !== "string" ||
    !Array.isArray(sections) ||
    !sections.every((section) => SECTIONS.includes(section)) ||
    label_a === undefined ||
    label_b === undefined
  ) {
    return answer(null, 400);
  }

  const args = { expected_version, theme, default_lang, label_a, label_b, timezone, sections };
  const { data, error } = await auth.rpc("owner_save_page", args);
  if (error?.code === "42501") return answer(null, 403);
  if (error?.code === "55000") return answer({ error: "setup_finished" }, 409);
  if (error && BAD_INPUT.includes(error.code)) return answer(null, 400);
  if (error) return answer(null, 503);
  if (data === null) return answer({ error: "changed_elsewhere" }, 409);
  return answer({ version: data }, 200);
}
