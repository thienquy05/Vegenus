import { expect, test } from "vitest";
import { browserLang, checkName, dashState, finishOutcome, nameErrors, proposeZone, resumeStep, saveBody, saveOutcome, stepDirty, zoneFlagged, type Draft } from "./setup";

// The O2/O3 rules that do not need a browser (owner UI "O2 and O3 revision for T2.1b"; Q114, Q121, Q125).
const PAGE = {
  version: 3, theme: "c_cozy", default_lang: "vi", label_a: "Partner A", label_b: "Partner B",
  timezone: "UTC", visibility: "private", setup_completed: false, sections: ["home", "guestbook"],
} as const;

test("the dashboard state comes from the saved page: none, resumed or done (E55)", () => {
  expect(dashState(null)).toBe("empty");
  expect(dashState(PAGE)).toBe("resumed");
  expect(dashState({ ...PAGE, setup_completed: true })).toBe("done");
});

test("a resumed setup opens at the names step while a name is missing, otherwise at the review (Q121, Q128)", () => {
  expect(resumeStep(PAGE)).toBe(5);
  expect(resumeStep({ ...PAGE, label_a: null })).toBe(1);
  expect(resumeStep({ ...PAGE, label_b: null })).toBe(1);
});

test("a name is trimmed and NFC, 1 to 40 code points, with no control or bidirectional character", () => {
  expect(checkName(`  Pa${String.fromCodePoint(0x301)}rtner A `)).toEqual({ value: "Pártner A", error: null });
  expect(checkName("   ").error).toBe("required");
  expect(checkName("x".repeat(40)).error).toBeNull();
  expect(checkName("x".repeat(41)).error).toBe("length");
  // 40 code points, more UTF-16 units: an emoji counts once.
  expect(checkName(`${"x".repeat(39)}${String.fromCodePoint(0x1f337)}`).error).toBeNull();
  for (const code of [0x01, 0x1f, 0x7f, 0x9f, 0x061c, 0x200e, 0x200f, 0x202a, 0x202e, 0x2066, 0x2069, 0x2028, 0x2029]) {
    expect(checkName(`Partner${String.fromCodePoint(code)}A`).error, code.toString(16)).toBe("characters");
  }
});

test("the browser language proposes vi or else en", () => {
  expect(browserLang("vi-VN")).toBe("vi");
  expect(browserLang("vi")).toBe("vi");
  expect(browserLang("en-US")).toBe("en");
  expect(browserLang("fr")).toBe("en");
});

test("the browser zone is proposed only when it is offered; otherwise UTC, flagged", () => {
  const offered = ["Asia/Ho_Chi_Minh", "Europe/Paris"];
  expect(proposeZone(() => "Asia/Ho_Chi_Minh", offered)).toEqual({ zone: "Asia/Ho_Chi_Minh", fallback: false });
  expect(proposeZone(() => "Mars/Base", offered)).toEqual({ zone: "UTC", fallback: true });
  expect(proposeZone(() => undefined, offered)).toEqual({ zone: "UTC", fallback: true });
  expect(proposeZone(() => { throw new Error("no Intl"); }, offered)).toEqual({ zone: "UTC", fallback: true });
});

test("every save sends every field, the first one too: it comes from the names step (Q128)", () => {
  const draft: Draft = { theme: null, default_lang: "en", label_a: " Partner A ", label_b: "  ", timezone: "UTC", sections: ["guestbook"] };
  expect(saveBody(draft, null)).toEqual({
    expected_version: null, theme: null, default_lang: "en", label_a: "Partner A", label_b: null, timezone: "UTC",
    sections: ["home", "guestbook"],
  });
  // A suggested theme set elsewhere is kept, never chosen here.
  expect(saveBody({ ...draft, theme: "b_cosmic" }, 4)).toMatchObject({ expected_version: 4, theme: "b_cosmic" });
});

test("save answers map to the wizard states", () => {
  expect(saveOutcome(200, { version: 2 })).toBe("ok");
  expect(saveOutcome(409, { error: "changed_elsewhere" })).toBe("conflict");
  expect(saveOutcome(409, { error: "setup_finished" })).toBe("finished");
  expect(saveOutcome(400, null)).toBe("invalid");
  expect(saveOutcome(401, null)).toBe("signedOut");
  expect(saveOutcome(403, null)).toBe("accessLost");
  expect(saveOutcome(503, null)).toBe("retry");
  expect(saveOutcome(502, null)).toBe("retry");
});

test("only a server-confirmed failure says nothing was published; anything unclear is uncertain (Q126)", () => {
  expect(finishOutcome(200, { visibility: "token_only" })).toBe("done");
  expect(finishOutcome(409, { error: "setup_finished" })).toBe("finished");
  expect(finishOutcome(409, { error: "changed_elsewhere" })).toBe("conflict");
  expect(finishOutcome(503, { error: "not_published" })).toBe("failed");
  expect(finishOutcome(401, null)).toBe("signedOut");
  expect(finishOutcome(403, null)).toBe("accessLost");
  for (const [status, body] of [[502, { error: "outcome_unknown" }], [503, null], [504, null], [500, null], [0, null]] as const) {
    expect(finishOutcome(status, body), String(status)).toBe("uncertain");
  }
});

test("after an uncertain Finish, a later failure cannot prove the first one rolled back (Codex)", () => {
  expect(finishOutcome(503, { error: "not_published" }, true)).toBe("uncertain");
  expect(finishOutcome(200, { visibility: "token_only" }, true)).toBe("done");
  expect(finishOutcome(409, { error: "setup_finished" }, true)).toBe("finished");
});

const DRAFT: Draft = { theme: "a_dreamy", default_lang: "en", label_a: "Partner A", label_b: "", timezone: "UTC", sections: [] };

test("names that would be refused are caught before any save; blank names wait for step 1 (R3)", () => {
  expect(nameErrors(DRAFT)).toEqual({ a: null, b: null });
  expect(nameErrors({ ...DRAFT, label_b: "x".repeat(41) })).toEqual({ a: null, b: "length" });
  expect(nameErrors({ ...DRAFT, label_a: `A${String.fromCodePoint(0x202e)}` })).toEqual({ a: "characters", b: null });
});

test("Leave asks only when the current step has unsaved input (spec wording kept, owner Q129)", () => {
  const base = { ...DRAFT, sections: ["memories"] };
  expect(stepDirty(1, base, base)).toBe(false);
  expect(stepDirty(1, { ...base, label_b: " Partner B" }, base)).toBe(true);
  expect(stepDirty(1, { ...base, default_lang: "vi" }, base)).toBe(true);
  // Whitespace and normalisation alone are not input; an edit left behind on another step does not count.
  expect(stepDirty(1, { ...base, label_a: " Partner A " }, base)).toBe(false);
  expect(stepDirty(1, { ...base, timezone: "Europe/Paris" }, base)).toBe(false);
  expect(stepDirty(2, { ...base, timezone: "Europe/Paris" }, base)).toBe(true);
  expect(stepDirty(3, { ...base, sections: [] }, base)).toBe(true);
  expect(stepDirty(3, { ...base, sections: ["memories"] }, base)).toBe(false);
  for (const step of [4, 5]) expect(stepDirty(step, { ...base, sections: [] }, base)).toBe(false);
});

test("a saved UTC zone is flagged whatever this session knew; another zone never; no page uses the browser's proposal (R1, Codex)", () => {
  expect(zoneFlagged({ timezone: "UTC" }, false)).toBe(true);
  expect(zoneFlagged({ timezone: "Asia/Tokyo" }, true)).toBe(false);
  expect(zoneFlagged(null, true)).toBe(true);
  expect(zoneFlagged(null, false)).toBe(false);
});
