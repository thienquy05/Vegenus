import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const { Wizard } = await import("./wizard");

// O3 setup wizard, one static render per step (owner UI "O2 and O3 revision for T2.1b"; Q114, Q120, Q121, Q124, Q128: five steps, no owner theme).
const PAGE = {
  version: 4, theme: "b_cosmic", default_lang: "vi", label_a: "Partner A", label_b: null,
  timezone: "Asia/Ho_Chi_Minh", visibility: "private", setup_completed: false, sections: ["home", "together"],
} as const;
const DRAFTS = {
  "home.greeting": { en: "Hello guests.", vi: "Chào khách." },
  "home.days": { en: "Together for {days} days.", vi: "Bên nhau {days} ngày." },
  "wishes.button": { en: "Write to us", vi: "Viết cho tụi mình" },
};
// True when one tag carries every attribute, in any order (React picks the order).
const hasTag = (html: string, ...attrs: string[]) => (html.match(/<[^>]+>/g) ?? []).some((tag) => attrs.every((attr) => tag.includes(attr)));
const render = (step: number, page: typeof PAGE | null = PAGE) =>
  renderToStaticMarkup(createElement(Wizard, { page, drafts: DRAFTS, initialStep: step, onExit: vi.fn() }));

test("every step shows the counter, a focusable step heading, Back, Next and Leave setup", () => {
  for (const step of [1, 2, 3, 4, 5]) {
    const html = render(step);
    expect(html, `step ${step}`).toContain(`<span lang="en">Step ${step} of 5</span> / Bước ${step}/5`);
    expect(html, `step ${step}`).toMatch(/<h2 tabindex="-1"/);
    expect(html, `step ${step}`).toContain('<span lang="en">Back</span>');
    expect(html, `step ${step}`).toContain('<span lang="en">Leave setup</span>');
    expect(html, `step ${step}`).toContain("Your page stays private.");
  }
  expect(render(1)).toMatch(/<button type="button"[^>]*disabled=""[^>]*>.*?Back/s);
  expect(render(4)).toContain('<span lang="en">Next</span>');
  expect(render(5)).toContain('<span lang="en">Finish and publish</span>');
});

test("the owner never chooses a theme: no step offers theme choices except the wording preview (Q128)", () => {
  for (const step of [1, 2, 3, 5]) expect(render(step), `step ${step}`).not.toContain("A Dreamy");
});

test("step 1: language radios and two required name fields with help and a counter", () => {
  const html = render(1);
  expect(html.match(/type="radio"/g)).toHaveLength(2);
  expect(html).toContain('for="name-a"');
  expect(html).toContain('for="name-b"');
  expect(html).toMatch(/id="name-a"[^>]*aria-required="true"/);
  expect(html).toContain("1 to 40 characters after trimming.");
  expect(html).toContain("9/40");
});

test("step 2: the saved zone is selected and described", () => {
  const html = render(2);
  expect(html).toMatch(/<select id="zone"[^>]*aria-describedby="zone-help zone-error"/);
  expect(html).toMatch(/<option value="Asia\/Ho_Chi_Minh" selected="">/);
});

test("step 3: Home on and disabled with its reason; no Zodiac", () => {
  const html = render(3);
  expect(hasTag(html, 'id="home"', 'checked=""', 'disabled=""', 'aria-describedby="home-reason"')).toBe(true);
  expect(hasTag(html, 'id="section-together"', 'checked=""')).toBe(true);
  expect(hasTag(html, 'id="section-memories"', 'checked=""')).toBe(false);
  expect(html).not.toContain("zodiac");
});

test("step 4: the drafted wording, the only path checked and disabled, a collapsed inert preview", () => {
  const html = render(4);
  expect(html).toContain('<span lang="en">Hello guests.</span> / Chào khách.');
  expect(html).toContain("{days}");
  expect(hasTag(html, 'type="checkbox"', 'checked=""', 'disabled=""', 'aria-describedby="wording-reason"')).toBe(true);
  expect(html).toMatch(/aria-expanded="false" aria-controls="wording-preview"/);
});

test("step 4: four preview themes (never saved) and two preview languages; the preview starts on the suggested theme", () => {
  const html = render(4);
  expect(html).toMatch(/id="preview-theme-label"[^>]*>.*Preview theme.*Chủ đề xem trước/);
  expect(html).toMatch(/role="group" aria-labelledby="preview-theme-label"/);
  expect(html.match(/aria-pressed=/g)).toHaveLength(6);
  expect(html).toMatch(/data-theme="b_cosmic"[^>]*inert=""/);
  const none = renderToStaticMarkup(createElement(Wizard, { page: { ...PAGE, theme: null }, drafts: DRAFTS, initialStep: 4, onExit: vi.fn() }));
  expect(none).toMatch(/data-theme="a_dreamy"[^>]*inert=""/);
});

test("the name counters are not live regions (they are read through aria-describedby)", () => {
  expect(render(1)).not.toMatch(/id="count-a"[^>]*aria-live/);
});

test("a saved zone the browser does not know shows its error at once", () => {
  const html = renderToStaticMarkup(createElement(Wizard, { page: { ...PAGE, timezone: "Mars/Base" }, drafts: DRAFTS, initialStep: 2, onExit: vi.fn() }));
  expect(html).toContain("This time zone isn&#x27;t available. Choose another.");
});

test("step 4 without the drafted wording offers Try again and holds Next", () => {
  const html = renderToStaticMarkup(createElement(Wizard, { page: PAGE, drafts: null, initialStep: 4, onExit: vi.fn() }));
  expect(html).toMatch(/<button type="button"[^>]*>.*?Try again/s);
  expect(hasTag(html, 'type="submit"', 'disabled=""')).toBe(true);
});

test("after an uncertain Finish the wizard no longer says the page stays private (Codex)", () => {
  const html = renderToStaticMarkup(createElement(Wizard, { page: PAGE, drafts: DRAFTS, initialStep: 5, onExit: vi.fn(), uncertain: true }));
  expect(html).not.toContain("Your page stays private.");
  expect(html).toContain("We couldn&#x27;t confirm whether your page was published.");
});

test("step 5: Token-only as a fact, every saved value with Change, a missing name flagged; no theme row (Q128)", () => {
  const html = render(5);
  expect(html).toContain('<strong><span lang="en">Token-only</span> / Chỉ qua liên kết riêng</strong>');
  expect(html.match(/<dt>/g)).toHaveLength(5);
  expect(html).not.toContain("Theme");
  expect(html).toContain('<span lang="en">Not added yet</span> / Chưa thêm');
  expect(html).toContain("<bdi>Asia/Ho_Chi_Minh</bdi>");
  expect(html).toContain('<span lang="en"> time zone</span>');
});

const NAMED = { ...PAGE, label_b: "Partner B" };
const on = (page: object, step: number) =>
  renderToStaticMarkup(createElement(Wizard, { page: page as typeof PAGE, drafts: DRAFTS, initialStep: step, onExit: vi.fn() }));

test("a resumed page on UTC keeps the fallback flag on the zone and review steps; another zone has none (R1, Codex)", () => {
  expect(on({ ...NAMED, timezone: "UTC" }, 5)).toContain("Set from a fallback: please check.");
  expect(on({ ...NAMED, timezone: "UTC" }, 2)).toContain("UTC is selected for now.");
  expect(on(NAMED, 5)).not.toContain("Set from a fallback");
});

test("the review says Home only when no other section is on (approved copy)", () => {
  expect(on({ ...NAMED, sections: ["home"] }, 5)).toContain("Home only");
  expect(on(NAMED, 5)).not.toContain("Home only");
});

test("no unnamed group wraps the steps: only step 1 has a fieldset, with its legend", () => {
  expect(render(1).match(/<fieldset/g)).toHaveLength(1);
  for (const step of [2, 3, 4, 5]) expect(render(step), `step ${step}`).not.toContain("<fieldset");
});
