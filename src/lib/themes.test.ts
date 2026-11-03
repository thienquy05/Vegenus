import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

// Theme token files (design 4 §3, §4, §11 tests 1 and 3; Q113, T2.1b). The neutral set dresses the owner area and
// the login; the four themes dress the wizard preview now and the guest site later.
const THEMES = ["neutral", "a_dreamy", "b_cosmic", "c_cozy", "d_elegant"];
const css = (id: string) => readFileSync(join("themes", id, "tokens.css"), "utf8");

// Design 4 §3: the names are the contract.
const TOKENS = [
  "--bg", "--bg-image", "--surface", "--surface-border", "--scrim",
  "--text", "--text-muted", "--text-on-accent", "--accent", "--accent-text",
  "--line", "--focus", "--danger", "--success",
  "--menu-button-bg", "--menu-button-fg", "--menu-item-bg", "--menu-item-border", "--menu-item-fg",
  "--menu-item-active-bg", "--menu-item-active-fg", "--menu-card-shadow", "--menu-ring",
  "--color-scheme",
  "--font-display", "--font-body", "--font-hand", "--display-style", "--display-weight",
  "--fs-xs", "--fs-sm", "--fs-md", "--fs-lg", "--fs-xl", "--fs-display",
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `--space-${n}`),
  "--radius-sm", "--radius-md", "--radius-pill",
  "--dur-fast", "--dur-slow", "--ease", "--ease-enter",
  "--shadow",
];

test.each(THEMES)("%s defines every token of the contract (theme test 1)", (id) => {
  const file = css(id);
  const missing = TOKENS.filter((token) => !new RegExp(`${token}\\s*:`).test(file));
  expect(missing).toEqual([]);
});

test.each(THEMES)("%s is scoped to its data-theme, so a preview container can carry it", (id) => {
  expect(css(id)).toContain(`[data-theme="${id}"]`);
});

test("the neutral set is also the default on :root", () => {
  expect(css("neutral")).toMatch(/:root\s*,\s*\[data-theme="neutral"\]/);
});

test.each(THEMES)("%s sets every duration to 0ms under reduced motion (design 4 §7)", (id) => {
  const reduced = css(id).split("prefers-reduced-motion: reduce")[1] ?? "";
  expect(reduced).toMatch(/--dur-fast:\s*0ms/);
  expect(reduced).toMatch(/--dur-slow:\s*0ms/);
});

test("only theme D has the gold entrance line (Q72)", () => {
  expect(THEMES.filter((id) => css(id).includes("--line-gold"))).toEqual(["d_elegant"]);
});

// rem, so the scale follows the reader's text size (WCAG 1.4.4): 16 px to the rem.
test("theme A's couple title is 52 px, the others 44 px (design 4 §3.1, Q127)", () => {
  for (const id of THEMES) {
    expect(css(id), id).toMatch(new RegExp(`--fs-display:\\s*${id === "a_dreamy" ? "3.25" : "2.75"}rem`));
  }
});

// Theme test 3: no colour, font family or duration outside themes/.
const appCss = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? appCss(join(dir, entry.name)) : entry.name.endsWith(".css") ? [join(dir, entry.name)] : [],
  );

test("app CSS takes colours, fonts and durations from the tokens (theme test 3)", () => {
  const files = appCss("src");
  expect(files).toContain(join("src", "app", "login", "login.module.css"));
  for (const file of files) {
    const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(text, file).not.toMatch(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(|\b\d+m?s\b/i);
    expect(text, file).not.toMatch(/font-family:(?!\s*var\()/);
  }
});
