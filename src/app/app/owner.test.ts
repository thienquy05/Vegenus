import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { Dashboard } from "./owner";
import type { Home } from "@/lib/home";

// O2 dashboard states (owner UI "O2 and O3 revision for T2.1b"; E55, Q118, Q120).
const PAGE = {
  version: 7, theme: "d_elegant", default_lang: "en", label_a: "Partner A", label_b: "Partner B",
  timezone: "UTC", visibility: "token_only", setup_completed: true, sections: ["guestbook"],
} as const;
// True when one tag carries every attribute, in any order (React picks the order).
const hasTag = (html: string, ...attrs: string[]) => (html.match(/<[^>]+>/g) ?? []).some((tag) => attrs.every((attr) => tag.includes(attr)));
const render = (props: Partial<Parameters<typeof Dashboard>[0]>) =>
  renderToStaticMarkup(
    createElement(Dashboard, { state: "loading", page: null, offline: false, onSetup: vi.fn(), onRetry: vi.fn(), onContent: vi.fn(), ...props }),
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

const region = (html: string, role: string) => html.match(new RegExp(`<p[^>]*role="${role}"[^>]*>(.*?)</p>`))?.[1] ?? "";

test("a message that takes focus is read once: the alert region stays empty after a read the owner asked for", () => {
  for (const state of ["error", "accessLost"] as const) {
    expect(region(render({ state }), "alert"), state).not.toBe("");
    expect(region(render({ state, focused: true }), "alert"), state).toBe("");
  }
});

test("going offline is announced by the polite region, since nothing takes focus", () => {
  expect(region(render({ state: "empty", offline: true }), "status")).toContain("offline");
});

test("the set-up dashboard links to Content; no other state does (owner UI O4)", () => {
  expect(render({ state: "done", page: PAGE })).toMatch(/<button type="button"[^>]*>.*<span lang="en">Content<\/span>/s);
  for (const state of ["loading", "empty", "resumed", "error", "accessLost"] as const) {
    expect(render({ state, page: PAGE }), state).not.toContain('<span lang="en">Content</span>');
  }
  expect(render({ state: "done", page: PAGE, offline: true })).toMatch(/<button type="button"[^>]*disabled=""[^>]*>.*Content/s);
});

// O2 Home card (owner UI "O17 Home editor and the O2 Home card"; PRD Q144 defaults 1, 8 and 11; E14). O2 reads Home
// before it shows a status or a counter; the counter comes from the published Home, in the page time zone.
const NOW = new Date("2026-11-21T12:00:00Z");
const HOME: Home = {
  id: "00000000-0000-0000-0000-0000000000d1", version: 3, status: "published", lang: "en", body: null, lang_alt: null,
  body_alt: null, start_date: "2026-11-20", published: { start_date: "2026-11-20" }, published_at: "2026-11-20T00:00:00Z",
  timezone: "UTC", unpublished_changes: false, picks: [],
};
const card = (home: Parameters<typeof Dashboard>[0]["home"], offline = false) =>
  render({ state: "done", page: PAGE, home, now: NOW, offline, onHome: vi.fn(), onHomeRetry: vi.fn() });
const homeCard = (html: string) => html.slice(html.indexOf('id="home-card-title"'));

test("Home card: while Home is read it claims no status and offers no action", () => {
  const html = homeCard(card({ state: "loading" }));
  expect(html).toContain("Loading…");
  expect(html).not.toContain("Edit Home");
  expect(html).not.toContain("Set up Home");
  expect(html).not.toContain("together");
});

test("Home card: no Home yet offers Set up Home", () => {
  const html = homeCard(card({ state: "ready", home: null }));
  expect(html).toContain('<span lang="en">No Home yet</span> / Chưa thiết lập Trang chủ');
  expect(html).toContain('<span lang="en">Set up Home</span>');
});

test("Home card: a draft never published makes no counter claim", () => {
  const html = homeCard(card({ state: "ready", home: { ...HOME, status: "draft", published: null, published_at: null } }));
  expect(html).toContain('<span lang="en">Draft · not published yet</span> / Bản nháp · chưa đăng');
  expect(html).toContain('<span lang="en">Edit Home</span>');
  expect(html).not.toContain("together");
});

test("Home card: published shows the day counter of the published start date", () => {
  const html = homeCard(card({ state: "ready", home: HOME }));
  expect(html).toContain('<span lang="en">Published</span> / Đã đăng');
  expect(html).toContain('<span lang="en">Day 2 together</span> / Ngày thứ 2 bên nhau');
});

test("Home card: unpublished changes keep the counter of what guests see, not the draft's date", () => {
  const html = homeCard(card({ state: "ready", home: { ...HOME, start_date: "2020-01-01", unpublished_changes: true } }));
  expect(html).toContain('<span lang="en">Published · Unpublished changes</span> / Đã đăng · Thay đổi chưa đăng');
  expect(html).toContain('<span lang="en">Day 2 together</span>');
});

test("Home card: no start date, or a start date still to come", () => {
  const undated = homeCard(card({ state: "ready", home: { ...HOME, published: { start_date: null } } }));
  expect(undated).toContain('<span lang="en">No start date</span> / Chưa có ngày bắt đầu');
  const future = homeCard(card({ state: "ready", home: { ...HOME, published: { start_date: "2026-12-01" } } }));
  expect(future).toContain('<span lang="en">Counter starts on 2026-12-01</span> / Bộ đếm bắt đầu vào 2026-12-01');
});

test("Home card: a failed read says so with its own Try again, never a misleading empty state", () => {
  const html = homeCard(card({ state: "error" }));
  expect(html).toContain("Couldn’t load this. Try again.");
  expect(html).toContain('<span lang="en">Try again</span>');
  expect(html).not.toContain("No Home yet");
});

test("Home card: offline, its action and Try again are disabled with the reason", () => {
  expect(hasTag(card({ state: "ready", home: HOME }, true), "<button", "disabled", 'aria-describedby="offline-reason"', 'id="home-action"')).toBe(true);
  expect(hasTag(card({ state: "error" }, true), "<button", "disabled", 'aria-describedby="offline-reason"', 'id="home-retry"')).toBe(true);
});
