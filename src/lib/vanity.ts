// The page address rule (T3.1p; owner UI "O9 Published address"; CHECKS.md name table), shared by the API and O9 so
// both answer the same reason. The database enforces the same pattern (valid_vanity_name) as a backstop.
export type VanityReason = "empty" | "format" | "characters" | "hyphens" | "length";

// Trim ASCII space, tab, LF, VT, FF and CR at the edges and lowercase ASCII only; other whitespace stays and is refused.
export const normalizeVanity = (name: string) =>
  name.replace(/^[\t-\r ]+|[\t-\r ]+$/g, "").replace(/[A-Z]/g, (letter) => letter.toLowerCase());

export function vanityReason(input: string): VanityReason | null {
  const name = normalizeVanity(input);
  if (!name) return "empty";
  if (/[\p{White_Space}\uFEFF/:.]/u.test(name)) return "format";
  if (/[^a-z0-9-]/.test(name)) return "characters";
  if (/^-|-$|--/.test(name)) return "hyphens";
  if (name.length < 3 || name.length > 40) return "length";
  return null;
}
