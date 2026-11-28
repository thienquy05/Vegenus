import { expect, test } from "vitest";
import { normalizeVanity, vanityReason } from "./vanity";

// T3.1p: the page address rule the API and O9 share (owner UI "O9 Published address"; CHECKS.md name table). Trim ASCII
// space, tab, LF, CR, VT and FF at the edges and lowercase ASCII, then: empty, format (any other whitespace, a slash,
// colon or period: a pasted URL), characters (outside a-z 0-9 -), hyphens (at an end or doubled), length (3-40).
test.each([
  [" \t\n\r\v\f", "empty"],
  ["", "empty"],
  ["\u00a0abc", "format"],
  ["abc\ufeff", "format"],
  ["https://[HOST]/p/abc", "format"],
  ["a bc", "format"],
  ["a\nbc", "format"],
  ["page.one", "format"],
  ["đab", "characters"],
  ["aáb", "characters"],
  ["a_b", "characters"],
  ["-ab", "hyphens"],
  ["ab-", "hyphens"],
  ["a--b", "hyphens"],
  ["ab", "length"],
  ["a".repeat(41), "length"],
])("%j is refused for %s", (input, reason) => {
  expect(vanityReason(input)).toBe(reason);
});

test.each([["abc"], ["a".repeat(40)], ["our-page-2"], ["  Our-Page \n"]])("%j is valid", (input) => {
  expect(vanityReason(input)).toBeNull();
});

test("normalizing trims ASCII edge whitespace and lowercases ASCII only", () => {
  expect(normalizeVanity("\t PREVIEW-Page \r\n")).toBe("preview-page");
  expect(normalizeVanity("\u00a0ABC")).toBe("\u00a0abc");
  expect(normalizeVanity("ĐAB")).toBe("Đab");
});
