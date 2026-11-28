import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { COPY, chooseLang } from "./copy";

// T3.3 (editable copy §4 "Language availability", E54): the wanted language is the saved G8 choice, else the phone's;
// it is used only when the page offers it, else the page default.
test("the saved choice wins when offered", () => {
  expect(chooseLang("vi", ["en-US"], ["en", "vi"], "en")).toBe("vi");
});
test("a saved choice the page no longer offers falls back to the default, not to the phone", () => {
  expect(chooseLang("vi", ["vi-VN"], ["en"], "en")).toBe("en");
});
test("no saved choice: the first phone language that is English or Vietnamese, when offered", () => {
  expect(chooseLang(undefined, ["fr-FR", "vi-VN", "en"], ["en", "vi"], "en")).toBe("vi");
  expect(chooseLang(undefined, ["VI"], ["en", "vi"], "en")).toBe("vi");
  expect(chooseLang(undefined, ["en-GB"], ["en", "vi"], "vi")).toBe("en");
});
test("a phone language the page does not offer, or none of ours, gives the default", () => {
  expect(chooseLang(undefined, ["vi-VN"], ["en"], "en")).toBe("en");
  expect(chooseLang(undefined, ["fr-FR"], ["en", "vi"], "vi")).toBe("vi");
  expect(chooseLang(undefined, [], ["en", "vi"], "vi")).toBe("vi");
});

// No blank label (E54): every fixed string has text in both languages.
test("every fixed guest string has English and Vietnamese text", () => {
  for (const [key, pair] of Object.entries(COPY)) {
    expect(pair[0].trim(), key).not.toBe("");
    expect(pair[1].trim(), key).not.toBe("");
  }
});

// "No hard-coded strings" (T3.3): guest screens take every word from the copy tables or the couple's wording, so no
// text is typed into JSX; only marks that read the same in both languages are allowed. The project's own ESLint
// config, plus this one rule.
const GUEST_TSX = ["src/app/g/**/*.tsx", "src/app/p/**/*.tsx", "src/app/privacy/**/*.tsx"];
test("guest screens have no text typed into JSX", { timeout: 60_000 }, async () => {
  const { ESLint } = await import("eslint");
  const eslint = new ESLint({
    // noStrings also catches a string in braces, {"Sent"}; the language names are the same in both.
    // shortcut: a string inside a ternary or && ({ok ? "Sent" : "Failed"}) is not caught; a custom rule if one slips in.
    overrideConfig: {
      rules: {
        "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true, allowedStrings: ["·", "/", ".", "‹", "›", "←", "→", "English", "Tiếng Việt"] }],
      },
    },
  });
  // The guard catches what it claims at least once.
  const [probe] = await eslint.lintText('export const P = () => <p>{"Sent"}</p>;', { filePath: "src/app/g/probe.tsx" });
  expect(probe.messages.some((m) => m.ruleId === "react/jsx-no-literals")).toBe(true);
  const results = await eslint.lintFiles(GUEST_TSX);
  expect(results.length).toBeGreaterThan(5);
  const found = results.flatMap((r) => r.messages.filter((m) => m.ruleId === "react/jsx-no-literals").map((m) => `${r.filePath}:${m.line} ${m.message}`));
  // Props are skipped above (class names, ids); the ones people read are checked here, written as attr="...".
  for (const r of results) {
    const source = readFileSync(r.filePath, "utf8");
    for (const m of source.matchAll(/\b(aria-label|alt|title|placeholder)="[^"]/g)) found.push(`${r.filePath}: ${m[0]}`);
  }
  expect(found).toEqual([]);
});
