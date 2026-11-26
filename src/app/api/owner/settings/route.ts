import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, ownerAuth } from "@/lib/owner-api";
import { checkName, THEMES } from "@/lib/setup";

// O19's settings save for a finished page, one panel per call (owner UI O19; Q115). The panel sends only its touched
// fields with the saved values they were edited against; owner_save_settings answers null ("conflict") when a saved
// value moved, and a retry of a committed request id answers the snapshot without applying twice. Names follow the
// shared O3 rule here, so a refusal can name the fields; the database refuses an unknown zone and a default language
// whose published wording is incomplete.
const isString = (value: unknown) => typeof value === "string";
const isLang = (value: unknown) => value === "en" || value === "vi";
// An empty name is a string: checkName refuses it as "required", which the panel can show.
const FIELDS: Record<string, Record<string, (value: unknown) => boolean>> = {
  names: { label_a: isString, label_b: isString, default_lang: isLang },
  timezone: { timezone: (value) => isString(value) && value !== "" },
  theme: { theme: (value) => value === null || THEMES.includes(value as (typeof THEMES)[number]) },
};
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const { panel, base, fields, request_id } = (await request.json().catch(() => null)) ?? {};
  const rules = FIELDS[panel as string];
  const keys = isObject(fields) ? Object.keys(fields) : [];
  if (
    !Object.hasOwn(FIELDS, panel) ||
    !isUuid(request_id) ||
    !isObject(base) ||
    !keys.length ||
    Object.keys(base).sort().join() !== [...keys].sort().join() ||
    !keys.every((key) => Object.hasOwn(rules, key) && rules[key](fields[key]) && rules[key](base[key]))
  ) {
    return answer(null, 400);
  }

  const sent = { ...fields };
  const refused: Record<string, string> = {};
  for (const key of ["label_a", "label_b"].filter((key) => key in sent)) {
    const { value, error } = checkName(sent[key] as string);
    sent[key] = value;
    if (error) refused[key] = error;
  }
  if (Object.keys(refused).length) return answer({ error: "invalid_name", fields: refused }, 400);

  const { data, error } = await auth.rpc("owner_save_settings", { panel, base, fields: sent, request_id });
  if (error?.code === "55000") return answer({ error: "setup_not_finished" }, 409);
  if (error) return dbFailure(error);
  if (data === null) return answer({ error: "conflict" }, 409);
  if (data.error) return answer({ error: data.error }, 400);
  return answer({ page: data }, 200);
}
