import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { GuestSummary } from "@/lib/guest";
import { daysTogether } from "@/lib/counter";
import { GuestApp } from "./guest-app";

// T3.1b guest shell in a real browser: theme and language, the circular menu (theme system §2), G1 Home (screens G1,
// owner UI "Guest Home states"), G2 Memories, G5 Wishes read-only and G8 Settings (guest UI §6, §7, §9). fetch answers
// each route from a queue and records the bodies sent. Placeholder data only.
const P1 = "00000000-0000-0000-0000-0000000000c1";
const P2 = "00000000-0000-0000-0000-0000000000c2";
const M1 = "00000000-0000-0000-0000-0000000000b1";
const E1 = "00000000-0000-0000-0000-0000000000e1";
const word = (en: string, vi: string) => ({ en, vi });
const SUMMARY: GuestSummary = {
  theme: "c_cozy",
  default_lang: "en",
  sections: ["home", "memories", "guestbook"],
  names: ["[PARTNER_A]", "[PARTNER_B]"],
  timezone: "UTC",
  copy: {
    "home.greeting": word("Hello from {partner_a} and {partner_b}.", "Chào từ {partner_a} và {partner_b}."),
    "home.days": word("Together for {days} days.", "Bên nhau {days} ngày."),
    "home.photoHint": word("Tap a photo to see the next one.", "Chạm vào ảnh để xem ảnh tiếp theo."),
    "memories.intro": word("Moments we keep.", "Những khoảnh khắc."),
    "memories.empty": word("Our first memory is coming soon.", "Kỷ niệm đầu tiên sắp có."),
    "wishes.intro": word("Leave us a few words.", "Hãy để lại đôi lời."),
    "wishes.empty": { en: "Be the first to write to us." },
  },
  home: {
    lang: "en", body: "[NOTE]", lang_alt: null, body_alt: null, start_date: "2020-02-29",
    picks: [
      { id: P1, alt: "[ALT_1]", alt_alt: null, lang: "en", lang_alt: null, width: 4, height: 3 },
      { id: P2, alt: null, alt_alt: "[ALT_2_VI]", lang: "en", lang_alt: "vi", width: 3, height: 4 },
    ],
  },
};
const memory = (n: number, more: object = {}) => ({
  id: n === 1 ? M1 : `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`, kind: "memory", lang: "en", title: `[TITLE_${n}]`,
  body: null, lang_alt: null, title_alt: null, body_alt: null, event_date: "2024-06-01", date_precision: "month", sort_order: n,
  media: [], ...more,
});

type Reply = { status: number; body?: unknown } | "network";
let sent: { url: string; body: Record<string, unknown> }[] = [];
let routes: Record<string, Reply[]> = {};
function serve(more: Record<string, Reply[]> = {}) {
  sent = [];
  routes = { "/api/guest/media": [ok({ urls: {} })], ...more };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      sent.push({ url, body });
      const queue = routes[url] ?? [];
      const reply = queue.length > 1 ? queue.shift() : queue[0];
      if (!reply || reply === "network") throw new TypeError(`no answer for ${url}`);
      return new Response(JSON.stringify(reply.body ?? null), { status: reply.status });
    }),
  );
}
const ok = (body: unknown): Reply => ({ status: 200, body });
const to = (url: string) => sent.filter((c) => c.url === url);

let root: Root | null = null;
let host: HTMLElement;
function mount(props: Partial<Parameters<typeof GuestApp>[0]> = {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(createElement(GuestApp, { summary: SUMMARY, section: "home", ...props }));
}
afterEach(() => {
  root?.unmount();
  root = null;
  host.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-motion");
  vi.useRealTimers();
  delete (navigator as { onLine?: boolean }).onLine;
});
const text = () => host.textContent ?? "";
const menu = () => host.querySelector<HTMLButtonElement>("#guest-menu")!;
const item = (label: string) => [...host.querySelectorAll<HTMLElement>("#guest-nav a, #guest-nav button")].find((a) => a.textContent?.includes(label))!;
const heading = () => host.querySelector("h1");

test("the page takes the suggested theme, else A, and the page language, else the guest's saved choice", async () => {
  serve();
  mount();
  await expect.poll(() => document.documentElement.dataset.theme).toBe("c_cozy");
  expect(document.documentElement.lang).toBe("en");
  root?.unmount();
  host.remove();
  localStorage.setItem("vegenus_prefs", JSON.stringify({ lang: "vi" }));
  mount({ summary: { ...SUMMARY, theme: null } });
  await expect.poll(() => document.documentElement.dataset.theme).toBe("a_dreamy");
  expect(document.documentElement.lang).toBe("vi");
  expect(menu().getAttribute("aria-label")).toBe("Mở menu");
});

test("G1: the couple title, the greeting, the note and the day count from the start date in the page zone", async () => {
  serve({ "/api/guest/media": [ok({ urls: { [P1]: "/one.webp", [P2]: "/two.webp" } })] });
  mount();
  await expect.poll(() => heading()?.textContent).toBe("[PARTNER_A] & [PARTNER_B]");
  expect(text()).toContain("Hello from [PARTNER_A] and [PARTNER_B].");
  expect(text()).toContain("[NOTE]");
  expect(text()).toContain(`Together for ${daysTogether("2020-02-29", "UTC")} days.`);
  expect(to("/api/guest/media")[0].body).toEqual({ ids: [P1, P2], variant: "display" });
});

test("G1: the photo stack advances on tap, with each photo's alt text in the shown language, else the other one", async () => {
  serve({ "/api/guest/media": [ok({ urls: { [P1]: "/one.webp", [P2]: "/two.webp" } })] });
  mount();
  const stack = () => host.querySelector<HTMLButtonElement>("#photo-stack")!;
  await expect.poll(() => stack()?.querySelector("img")?.getAttribute("alt")).toBe("[ALT_1]");
  expect(stack().textContent).toContain("Photo 1 of 2");
  await userEvent.click(stack());
  expect(stack().querySelector("img")?.getAttribute("alt")).toBe("[ALT_2_VI]");
  expect(stack().querySelector("img")?.getAttribute("lang")).toBe("vi");
  await userEvent.click(stack());
  expect(stack().querySelector("img")?.getAttribute("alt")).toBe("[ALT_1]");
});

test("G1: no Home shows the title and greeting only; a future start shows no counter; no photos, no stack", async () => {
  serve();
  mount({ summary: { ...SUMMARY, home: null } });
  await expect.poll(() => heading()?.textContent).toBe("[PARTNER_A] & [PARTNER_B]");
  expect(text()).toContain("Hello from");
  expect(text()).not.toContain("[NOTE]");
  expect(to("/api/guest/media")).toHaveLength(0);
  root?.unmount();
  host.remove();
  mount({ summary: { ...SUMMARY, home: { ...SUMMARY.home!, start_date: "2999-01-01", picks: [] } } });
  await expect.poll(() => text()).toContain("[NOTE]");
  expect(text()).not.toContain("Together for");
  expect(host.querySelector("#photo-stack")).toBeNull();
});

test("the menu: enabled sections and Settings, focus on the first item, the page inert, Escape returns focus", async () => {
  serve();
  mount({ summary: { ...SUMMARY, sections: ["home", "guestbook"] } });
  await expect.poll(() => menu()).toBeTruthy();
  expect(menu().getAttribute("aria-expanded")).toBe("false");
  await userEvent.click(menu());
  expect(menu().getAttribute("aria-expanded")).toBe("true");
  expect(menu().getAttribute("aria-label")).toBe("Close menu");
  const labels = [...host.querySelectorAll("#guest-nav li")].map((li) => li.textContent);
  expect(labels).toEqual(["Home", "Wishes", "Settings"]);
  expect(document.activeElement).toBe(item("Home"));
  expect(host.querySelector("main")?.closest("[inert]")).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  expect(menu().getAttribute("aria-expanded")).toBe("false");
  expect(host.querySelector("[inert]")).toBeNull();
  expect(document.activeElement).toBe(menu());
});

test("choosing Memories closes the menu, reads the section and moves focus to its heading", async () => {
  serve({ "/api/guest/list": [ok({ items: [memory(1)] })] });
  mount();
  await expect.poll(() => menu()).toBeTruthy();
  await userEvent.click(menu());
  await userEvent.click(item("Memories"));
  await expect.poll(() => heading()?.textContent).toBe("Memories");
  expect(document.activeElement).toBe(heading());
  expect(menu().getAttribute("aria-expanded")).toBe("false");
  expect(to("/api/guest/list")[0].body).toEqual({ section: "memories" });
  await expect.poll(() => text()).toContain("[TITLE_1]");
  expect(text()).toContain("June 2024");
  expect(location.pathname).toBe("/g/memories");
});

test("G2: a thumbnail per memory, Load more after a full page, empty wording, and Try again after a failure", async () => {
  const full = Array.from({ length: 50 }, (_, i) => memory(i + 1, i === 0 ? { media: [{ id: P1, kind: "photo", alt: "[ALT_1]", alt_alt: null, lang: "en", lang_alt: null, width: 4, height: 3 }] } : {}));
  serve({ "/api/guest/list": [ok({ items: full }), ok({ items: [memory(51)] })], "/api/guest/media": [ok({ urls: { [P1]: "/one.webp" } })] });
  mount({ section: "memories" });
  await expect.poll(() => host.querySelectorAll("article").length).toBe(50);
  await expect.poll(() => host.querySelector("article img")?.getAttribute("src")).toBe("/one.webp");
  expect(to("/api/guest/media")[0].body).toEqual({ ids: [P1], variant: "thumb" });
  await userEvent.click([...host.querySelectorAll("button")].find((b) => b.textContent === "Load more")!);
  await expect.poll(() => host.querySelectorAll("article").length).toBe(51);
  expect(to("/api/guest/list")[1].body).toEqual({ section: "memories", after: { sort: 50, id: full[49].id } });
  expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Load more")).toBe(false);

  root?.unmount();
  host.remove();
  serve({ "/api/guest/list": ["network", ok({ items: [] })] });
  mount({ section: "memories" });
  await expect.poll(() => text()).toContain("Couldn’t load this. Try again.");
  await userEvent.click([...host.querySelectorAll("button")].find((b) => b.textContent === "Try again")!);
  await expect.poll(() => text()).toContain("Our first memory is coming soon.");
});

test("G5: approved wishes newest first; the empty wording falls back to the language it exists in", async () => {
  serve({ "/api/guest/wishes": [ok({ entries: [{ id: E1, display_name: "[DISPLAY_NAME]", body: "[WISH_TEXT]", lang: "vi", created_at: "2026-11-20T10:00:00Z" }] })] });
  mount({ section: "guestbook" });
  await expect.poll(() => text()).toContain("[WISH_TEXT]");
  expect(heading()?.textContent).toBe("Wishes");
  expect(host.querySelector("article [lang=vi]")?.textContent).toBe("[WISH_TEXT]");
  expect(to("/api/guest/wishes")[0].body).toEqual({});
  root?.unmount();
  host.remove();
  localStorage.setItem("vegenus_prefs", JSON.stringify({ lang: "vi" }));
  serve({ "/api/guest/wishes": [ok({ entries: [] })] });
  mount({ section: "guestbook" });
  await expect.poll(() => host.querySelector("[lang=en]")?.textContent).toBe("Be the first to write to us.");
});

test("G8: language applies at once and is saved on this device; menu corner and reduce motion too; Escape returns focus", async () => {
  serve();
  mount();
  await expect.poll(() => menu()).toBeTruthy();
  await userEvent.click(menu());
  await userEvent.click(item("Settings"));
  const dialog = () => host.querySelector("dialog[open]")!;
  await expect.poll(() => dialog()).toBeTruthy();
  expect(menu().hidden).toBe(true);
  expect(document.activeElement).toBe(dialog().querySelector("input[name=lang]:checked"));
  await userEvent.click(dialog().querySelector<HTMLInputElement>("#lang-vi")!);
  expect(document.documentElement.lang).toBe("vi");
  expect(dialog().textContent).toContain("Ngôn ngữ");
  expect(JSON.parse(localStorage.getItem("vegenus_prefs")!)).toMatchObject({ lang: "vi" });
  expect(dialog().textContent).toContain("Lưu trên thiết bị này");
  await userEvent.click(dialog().querySelector<HTMLInputElement>("#corner-right")!);
  await userEvent.click(dialog().querySelector<HTMLInputElement>("#reduce-motion")!);
  expect(document.documentElement.dataset.motion).toBe("reduce");
  expect(JSON.parse(localStorage.getItem("vegenus_prefs")!)).toMatchObject({ corner: "right", motion: "reduce" });
  await userEvent.keyboard("{Escape}");
  expect(host.querySelector("dialog[open]")).toBeNull();
  expect(menu().hidden).toBe(false);
  expect(menu().dataset.corner).toBe("right");
  expect(document.activeElement).toBe(menu());
});

test("G8: when the device cannot store settings they apply to this visit only", async () => {
  serve();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  mount();
  await expect.poll(() => menu()).toBeTruthy();
  await userEvent.click(menu());
  await userEvent.click(item("Settings"));
  await userEvent.click(host.querySelector<HTMLInputElement>("dialog[open] #lang-vi")!);
  expect(document.documentElement.lang).toBe("vi");
  expect(host.querySelector("dialog[open]")?.textContent).toContain("Chỉ áp dụng trong lần truy cập này");
});

test("a visit run from memory (cookies blocked) sends the token with every read and never changes the address", async () => {
  const token = "T".repeat(43);
  serve({ "/api/guest/list": [ok({ items: [] })] });
  history.replaceState(null, "", "/g");
  mount({ token });
  await expect.poll(() => to("/api/guest/media")).toHaveLength(1);
  expect(to("/api/guest/media")[0].body.token).toBe(token);
  await userEvent.click(menu());
  await userEvent.click(item("Memories"));
  await expect.poll(() => to("/api/guest/list")).toHaveLength(1);
  expect(to("/api/guest/list")[0].body).toEqual({ section: "memories", token });
  expect(location.pathname).toBe("/g");
});

// Review fixes (T3.1b reviewer, 2026-11-26).
const photoMemory = (n: number) => memory(n, { media: [{ id: `00000000-0000-0000-0000-${String(1000 + n).padStart(12, "0")}`, kind: "photo", alt: null, alt_alt: null, lang: "en", lang_alt: null, width: 4, height: 3 }] });
const buttonNamed = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label);

test("reduce motion changes no layout: the menu button stays 56 px", async () => {
  localStorage.setItem("vegenus_prefs", JSON.stringify({ motion: "reduce" }));
  serve();
  mount();
  await expect.poll(() => document.documentElement.dataset.motion).toBe("reduce");
  expect(menu().getBoundingClientRect().height).toBe(56);
});

test("Load more signs thumbnails only for the new rows, never over the route's 100-id limit", async () => {
  const first = Array.from({ length: 50 }, (_, i) => photoMemory(i + 1));
  const second = Array.from({ length: 50 }, (_, i) => photoMemory(i + 51));
  serve({ "/api/guest/list": [ok({ items: first }), ok({ items: second })] });
  mount({ section: "memories" });
  await expect.poll(() => to("/api/guest/media")).toHaveLength(1);
  await userEvent.click(buttonNamed("Load more")!);
  await expect.poll(() => to("/api/guest/media")).toHaveLength(2);
  expect(to("/api/guest/media")[1].body.ids).toEqual(second.map((_, i) => `00000000-0000-0000-0000-${String(1051 + i).padStart(12, "0")}`));
});

test("Load more keeps focus on its button; the last page moves focus to its first new card", async () => {
  const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => memory(from + i));
  serve({ "/api/guest/list": [ok({ items: page(1, 50) }), ok({ items: page(51, 50) }), ok({ items: page(101, 1) })] });
  mount({ section: "memories" });
  await expect.poll(() => buttonNamed("Load more")).toBeTruthy();
  await userEvent.click(buttonNamed("Load more")!);
  await expect.poll(() => host.querySelectorAll("article").length).toBe(100);
  expect(document.activeElement).toBe(buttonNamed("Load more"));
  await userEvent.click(buttonNamed("Load more")!);
  await expect.poll(() => host.querySelectorAll("article").length).toBe(101);
  expect(document.activeElement).toBe(host.querySelectorAll("article")[100]);
});

test("a read answered not-available means access is gone: the content goes and a neutral notice stays", async () => {
  serve({ "/api/guest/list": [{ status: 404, body: { error: "not_available" } }] });
  mount({ section: "memories" });
  await expect.poll(() => text()).toContain("Access is no longer available.");
  expect(text()).not.toContain("[PARTNER_A]");
  expect(menu()).toBeNull();
  // Focus does not fall to the page: the notice's heading takes it, so a screen reader speaks it.
  await expect.poll(() => document.activeElement).toBe(heading());
});

test("Home photos are signed again when a shown URL has expired (5 minutes, Q29)", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  serve({ "/api/guest/media": [ok({ urls: { [P1]: "/one.webp", [P2]: "/two.webp" } }), ok({ urls: { [P1]: "/one-b.webp", [P2]: "/two-b.webp" } })] });
  mount();
  const img = () => host.querySelector<HTMLImageElement>("#photo-stack img");
  await expect.poll(() => img()?.getAttribute("src")).toBe("/one.webp");
  vi.setSystemTime(Date.now() + 301_000);
  img()!.dispatchEvent(new Event("error"));
  await expect.poll(() => img()?.getAttribute("src")).toBe("/one-b.webp");
});

test("the open menu never overlaps two items: four items fan out at 390 px, the list at 320 px", async () => {
  await page.viewport(390, 844);
  serve();
  mount();
  await expect.poll(() => menu()).toBeTruthy();
  await userEvent.click(menu());
  await expect.poll(() => host.querySelectorAll("#guest-nav li").length).toBe(4);
  const parts = [...host.querySelectorAll("#guest-nav li")].map((li) => [...li.querySelectorAll("span")].map((x) => x.getBoundingClientRect()));
  const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const overlaps = parts.flatMap((a, i) => parts.slice(i + 1).filter((b) => a.some((x) => b.some((y) => hit(x, y)))));
  expect(overlaps).toEqual([]);
  expect(getComputedStyle(host.querySelector("#guest-nav li")!).position).toBe("fixed"); // the fan, not the list
  await userEvent.keyboard("{Escape}");
  await page.viewport(320, 640);
  await userEvent.click(menu());
  await expect.poll(() => host.querySelector("#guest-nav li")).toBeTruthy();
  expect(getComputedStyle(host.querySelector("#guest-nav li")!).position).not.toBe("fixed");
});

test("Home photos whose signing failed are asked again when the device is back online", async () => {
  serve({ "/api/guest/media": ["network", ok({ urls: { [P1]: "/one.webp", [P2]: "/two.webp" } })] });
  mount();
  await expect.poll(() => to("/api/guest/media")).toHaveLength(1);
  await new Promise((r) => setTimeout(r, 50));
  dispatchEvent(new Event("online"));
  await expect.poll(() => host.querySelector<HTMLImageElement>("#photo-stack img")?.getAttribute("src")).toBe("/one.webp");
});

test("offline: a notice, and a failed read says offline rather than read failure", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  serve({ "/api/guest/list": ["network"] });
  mount({ section: "memories" });
  await expect.poll(() => text()).toContain("You’re offline. Reconnect to continue.");
  expect(text()).not.toContain("Couldn’t load this");
});

test("choosing the section already shown keeps focus: it moves to the heading", async () => {
  serve();
  mount();
  await expect.poll(() => menu()).toBeTruthy();
  await userEvent.click(menu());
  await userEvent.click(item("Home"));
  expect(document.activeElement).toBe(heading());
});

test("G8 says from the start when this device cannot store settings; unknown saved values are ignored", async () => {
  localStorage.setItem("vegenus_prefs", JSON.stringify({ lang: "fr", corner: "middle" }));
  serve();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  mount();
  await expect.poll(() => menu()).toBeTruthy();
  expect(document.documentElement.lang).toBe("en");
  expect(menu().dataset.corner).toBe("left");
  await userEvent.click(menu());
  await userEvent.click(item("Settings"));
  expect(host.querySelector("dialog[open]")?.textContent).toContain("Applies to this visit only");
});
