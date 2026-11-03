import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { Dashboard } from "./owner";

// O2 dashboard states (owner UI "O2 and O3 revision for T2.1b"; E55, Q118, Q120).
const PAGE = {
  version: 7, theme: "d_elegant", default_lang: "en", label_a: "Partner A", label_b: "Partner B",
  timezone: "UTC", visibility: "token_only", setup_completed: true, sections: ["guestbook"],
} as const;
// True when one tag carries every attribute, in any order (React picks the order).
const hasTag = (html: string, ...attrs: string[]) => (html.match(/<[^>]+>/g) ?? []).some((tag) => attrs.every((attr) => tag.includes(attr)));
const render = (props: Partial<Parameters<typeof Dashboard>[0]>) =>
  renderToStaticMarkup(
    createElement(Dashboard, { state: "loading", page: null, offline: false, onSetup: vi.fn(), onRetry: vi.fn(), ...props }),
  );

test("every state keeps the heading, both live regions and the native Log out form", () => {
  for (const state of ["loading", "empty", "resumed", "done", "error", "accessLost"] as const) {
    const html = render({ state, page: PAGE });
    expect(html, state).toContain('<span lang="en">Overview</span> / Tổng quan');
    expect(html, state).toContain('role="status"');
    expect(html, state).toContain('role="alert"');
    expect(hasTag(html, "<form", 'method="post"', 'action="/api/owner/logout"'), state).toBe(true);
    expect(html, state).not.toContain("menu");
  }
});

test("loading is busy and never shows the empty state", () => {
  const html = render({ state: "loading" });
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("Loading…");
  expect(html).not.toContain("Set up your page");
});

test("empty: three steps and Set up your page", () => {
  const html = render({ state: "empty" });
  expect(html).toContain("Make room for your memories");
  expect(html.match(/<li>/g)).toHaveLength(3);
  expect(html).toContain('<span lang="en">Set up your page</span>');
  expect(html).not.toContain("Private");
});

test("resumed: Private, the saved-choices help and Continue setup", () => {
  const html = render({ state: "resumed", page: { ...PAGE, visibility: "private", setup_completed: false } });
  expect(html).toContain('<span lang="en">Private</span> / Riêng tư');
  expect(html).toContain("Your saved choices are here when you&#x27;re ready to continue.");
  expect(html).toContain('<span lang="en">Continue setup</span>');
});

test("done: only the names, Token-only and the enabled sections, Home always first", () => {
  const html = render({ state: "done", page: { ...PAGE, label_a: "Kỷ niệm <b>", label_b: "Partner B" } });
  expect(html).toContain("<bdi>Kỷ niệm &lt;b&gt;</bdi> &amp; <bdi>Partner B</bdi>");
  expect(html).toContain('<span lang="en">Token-only</span> / Chỉ qua liên kết riêng');
  expect(html).toMatch(/Home.*Wishes<\/span> \/ Lời chúc/s);
  expect(html).not.toContain("Memories");
  expect(html).not.toContain("Continue setup");
});

test("read failure uses the shipped copy with Try again; access lost offers only Log out", () => {
  const error = render({ state: "error" });
  expect(error).toContain('<span lang="en">Couldn’t load this. Try again.</span> / Chưa tải được. Thử lại.');
  expect(error).toContain('<span lang="en">Try again</span>');
  const lost = render({ state: "accessLost" });
  expect(lost).toContain("Access is no longer available.");
  expect(lost).not.toContain("Try again");
  expect(lost).not.toContain("Set up your page");
});

test("read failure and access lost give focus a target", () => {
  for (const state of ["error", "accessLost"] as const) expect(render({ state }), state).toMatch(/<p[^>]*tabindex="-1"/);
});

test("the published message is shown on the done dashboard, not only announced", () => {
  const html = render({ state: "done", page: PAGE, status: "setup.published" });
  expect(html).toMatch(/<p class="[^"]*">.*Your page is set up\.<\/span>/s);
});

test("offline shows the notice and disables starting setup and retrying", () => {
  const html = render({ state: "empty", offline: true });
  expect(html).toContain('id="offline-reason"');
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="offline-reason"[^>]*>.*Set up your page/s);
  expect(render({ state: "error", offline: true })).toMatch(/<button[^>]*disabled=""[^>]*>.*Try again/s);
});
