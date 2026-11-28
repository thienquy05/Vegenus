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
// Note: a saved theme wins over the suggestion, so a test that remounts with another suggestion clears the key first.
// A returning guest unless the test asks for a first visit: a saved theme means no theme prompt (Q128). The real
// setItem, so tests that make storage fail still start as returning guests.
const realSetItem = Storage.prototype.setItem;
function mount(props: Partial<Parameters<typeof GuestApp>[0]> & { firstVisit?: boolean } = {}) {
  const { firstVisit, ...rest } = props;
  if (!firstVisit) {
    const saved = JSON.parse(localStorage.getItem("vegenus_prefs") ?? "{}");
    const theme = saved.theme ?? (rest.summary === undefined ? SUMMARY.theme : rest.summary.theme) ?? "a_dreamy";
    realSetItem.call(localStorage, "vegenus_prefs", JSON.stringify({ theme, ...saved }));
  }
  props = rest;
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
  // Guest UI §5 test 1: the counter is announced (a polite status), next and previous wrap.
  const count = () => host.querySelector('#photo-count[role="status"]')?.textContent;
  expect(count()).toBe("Photo 1 of 2");
  await userEvent.click(stack());
  expect(stack().querySelector("img")?.getAttribute("alt")).toBe("[ALT_2_VI]");
  expect(stack().querySelector("img")?.getAttribute("lang")).toBe("vi");
  expect(count()).toBe("Photo 2 of 2");
  const nav = (label: string) => [...host.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label)!;
  await userEvent.click(nav("Next photo"));
  expect(count()).toBe("Photo 1 of 2");
  await userEvent.click(nav("Previous photo"));
  expect(count()).toBe("Photo 2 of 2");
  expect(stack().querySelector("img")?.getAttribute("alt")).toBe("[ALT_2_VI]");
});

test("G1: section shortcuts link to the enabled sections (not Home or Settings) and open them like the menu", async () => {
  serve({ "/api/guest/list": [ok({ items: [memory(1)] })] });
  mount();
  const shortcuts = () => host.querySelector<HTMLElement>('nav[aria-label="Sections"]');
  await expect.poll(() => shortcuts()).toBeTruthy();
  const links = [...shortcuts()!.querySelectorAll("a")];
  expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([["Memories", "/g/memories"], ["Wishes", "/g/wishes"]]);
  await userEvent.click(links[0]);
  await expect.poll(() => heading()?.textContent).toBe("Memories");
  expect(document.activeElement).toBe(heading());
  root?.unmount();
  host.remove();
  mount({ summary: { ...SUMMARY, sections: ["home"] } });
  await expect.poll(() => heading()).toBeTruthy();
  expect(shortcuts()).toBeNull();
});

test("G1: a published Home without photos or without a note shows the fixed notices (Q83); an unpublished one does not", async () => {
  serve();
  mount({ summary: { ...SUMMARY, home: { ...SUMMARY.home!, picks: [], body: null, body_alt: null } } });
  await expect.poll(() => text()).toContain("Photos will appear here once the owners add them.");
  expect(text()).toContain("The owners have not added a welcome note yet.");
  root?.unmount();
  host.remove();
  mount({ summary: { ...SUMMARY, home: null } });
  await expect.poll(() => heading()).toBeTruthy();
  expect(text()).not.toContain("Photos will appear");
  expect(text()).not.toContain("welcome note yet");
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
  mount({ cred: token });
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
  // A memory card is a link to its album (G3), so focus goes to that link.
  expect(document.activeElement).toBe(host.querySelectorAll("article")[100].closest("a"));
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

// Q128 theme choice (owner, 2026-11-26: the prompt wears the suggested theme, over Home, with "Not now"; boards in
// .design/guest-theme). Continue saves the chosen theme; Not now, Close and Escape save the suggestion, else A.
const prompt = () => host.querySelector<HTMLDialogElement>("dialog[open]");
const radio = (id: string) => host.querySelector<HTMLInputElement>(`dialog[open] input[value="${id}"]`)!;
const saved = () => JSON.parse(localStorage.getItem("vegenus_prefs") ?? "{}");
const button = (label: string) => [...(prompt()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === label)!;

test("first visit: the theme prompt over Home, the suggestion checked, focused and badged, the menu hidden", async () => {
  serve();
  mount({ firstVisit: true });
  await expect.poll(() => prompt()?.querySelector("h2")?.textContent).toBe("Choose a theme");
  expect(heading()?.textContent).toBe("[PARTNER_A] & [PARTNER_B]"); // Home behind it
  expect(document.documentElement.dataset.theme).toBe("c_cozy");
  expect(prompt()!.querySelector("legend")?.textContent).toBe("Theme");
  expect([...prompt()!.querySelectorAll<HTMLInputElement>("input[type=radio]")].map((r) => r.value)).toEqual(["a_dreamy", "b_cosmic", "c_cozy", "d_elegant"]);
  expect(radio("c_cozy").checked).toBe(true);
  expect(document.activeElement).toBe(radio("c_cozy"));
  expect(radio("c_cozy").closest("label")?.textContent).toContain("Suggested");
  expect(radio("a_dreamy").closest("label")?.textContent).not.toContain("Suggested");
  expect(radio("b_cosmic").closest("label")?.textContent).toContain("B Cosmic");
  expect(radio("d_elegant").closest("label")?.getAttribute("data-theme")).toBe("d_elegant"); // each card in its own look
  expect(menu().hidden).toBe(true);
});

test("choosing previews at once; Continue saves it and focus goes to Home's heading", async () => {
  serve();
  mount({ firstVisit: true });
  await expect.poll(() => prompt()).toBeTruthy();
  await userEvent.click(radio("b_cosmic"));
  expect(document.documentElement.dataset.theme).toBe("b_cosmic");
  expect(saved().theme).toBeUndefined();
  await userEvent.click(button("Continue"));
  expect(prompt()).toBeNull();
  expect(saved().theme).toBe("b_cosmic");
  await expect.poll(() => document.activeElement).toBe(heading());
  expect(menu().hidden).toBe(false);
});

test("Not now and Escape keep the suggestion (else A) and do not ask again", async () => {
  serve();
  mount({ firstVisit: true });
  await expect.poll(() => prompt()).toBeTruthy();
  await userEvent.click(radio("d_elegant"));
  await userEvent.click(button("Not now"));
  expect(prompt()).toBeNull();
  expect(document.documentElement.dataset.theme).toBe("c_cozy");
  expect(saved().theme).toBe("c_cozy");
  await expect.poll(() => document.activeElement).toBe(heading());
  root?.unmount();
  host.remove();
  mount({ firstVisit: true });
  await expect.poll(() => heading()).toBeTruthy();
  expect(prompt()).toBeNull();

  root?.unmount();
  host.remove();
  localStorage.clear();
  mount({ firstVisit: true, summary: { ...SUMMARY, theme: null } });
  await expect.poll(() => prompt()).toBeTruthy();
  expect(radio("a_dreamy").checked).toBe(true);
  expect(prompt()!.textContent).not.toContain("Suggested");
  await userEvent.keyboard("{Escape}");
  expect(prompt()).toBeNull();
  expect(saved().theme).toBe("a_dreamy");
});

test("the prompt in Vietnamese, and with storage blocked it still applies and says so", async () => {
  serve();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  mount({ firstVisit: true, summary: { ...SUMMARY, default_lang: "vi" } });
  await expect.poll(() => prompt()).toBeTruthy();
  expect(prompt()!.textContent).toContain("Chọn giao diện");
  expect(radio("b_cosmic").closest("label")?.textContent).toContain("B Vũ trụ");
  // The live region is there from the start and speaks when a choice cannot be kept (polite announcement on select).
  const status = prompt()!.querySelector('[role="status"]')!;
  expect(status.textContent).toBe("");
  await userEvent.click(radio("b_cosmic"));
  expect(status.textContent).toBe("Chỉ áp dụng trong lần truy cập này");
  await userEvent.click(button("Tiếp tục"));
  expect(document.documentElement.dataset.theme).toBe("b_cosmic");
});

test("G8: the Theme group follows Language, applies and saves at once, and the suggestion keeps its badge", async () => {
  serve();
  mount();
  await expect.poll(() => menu()).toBeTruthy();
  await userEvent.click(menu());
  await userEvent.click(item("Settings"));
  expect([...prompt()!.querySelectorAll("legend")].map((l) => l.textContent)).toEqual(["Language", "Theme", "Menu corner"]);
  expect(radio("c_cozy").checked).toBe(true);
  await userEvent.click(radio("a_dreamy"));
  expect(document.documentElement.dataset.theme).toBe("a_dreamy");
  expect(saved().theme).toBe("a_dreamy");
  expect(radio("c_cozy").closest("label")?.textContent).toContain("Suggested");
});

// Theme-choice review: a saved choice beats a new suggestion, an unknown saved theme asks again, Close is a skip,
// new copy is at least 16 px, and the check mark is visual only.
test("a saved theme beats a later suggestion; an unknown saved theme asks again; Close keeps the suggestion", async () => {
  serve();
  localStorage.setItem("vegenus_prefs", JSON.stringify({ theme: "d_elegant" }));
  mount({ firstVisit: true });
  await expect.poll(() => heading()).toBeTruthy();
  expect(prompt()).toBeNull();
  expect(document.documentElement.dataset.theme).toBe("d_elegant");
  root?.unmount();
  host.remove();
  localStorage.setItem("vegenus_prefs", JSON.stringify({ theme: "bogus" }));
  mount({ firstVisit: true });
  await expect.poll(() => prompt()).toBeTruthy();
  await userEvent.click(radio("a_dreamy"));
  await userEvent.click(button("Close"));
  expect(prompt()).toBeNull();
  expect(saved().theme).toBe("c_cozy");
});

test("the prompt's badge, help and status text are at least 16 px; the check mark adds nothing to the name", async () => {
  serve();
  mount({ firstVisit: true });
  await expect.poll(() => prompt()).toBeTruthy();
  const size = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
  const badge = radio("c_cozy").closest("label")!.querySelector("span:last-of-type")!;
  expect(badge.textContent).toBe("Suggested");
  expect(size(badge)).toBeGreaterThanOrEqual(16);
  const help = [...prompt()!.querySelectorAll("p")].find((p) => p.textContent?.startsWith("You can change"))!;
  expect(size(help)).toBeGreaterThanOrEqual(16);
  expect(size(prompt()!.querySelector('[role="status"]')!)).toBeGreaterThanOrEqual(16);
  const mark = getComputedStyle(radio("c_cozy").closest("label")!, "::after").content;
  expect(mark).toMatch(/^"✓"\s*\/\s*""$/);
});

// T3.1c G4 Together in Phase 3 (Q150): the place count, a search, milestones and anniversaries as place cards that open a
// sheet (guest UI §5 test 3 without pins: focus to the sheet heading, Escape and Close return it, previous and next wrap).
const WITH_TOGETHER: GuestSummary = { ...SUMMARY, sections: ["home", "memories", "together", "guestbook"] };
const place = (n: number, title: string, more: object = {}) => memory(n, { kind: "milestone", title, body: `[NOTE_${n}]`, ...more });

test("G4: Together in the menu and shortcuts between Memories and Wishes, its own address", async () => {
  serve({ "/api/guest/list": [ok({ items: [] })] });
  mount({ summary: WITH_TOGETHER });
  await expect.poll(() => host.querySelector('nav[aria-label="Sections"]')).toBeTruthy();
  expect([...host.querySelectorAll('nav[aria-label="Sections"] a')].map((a) => a.textContent)).toEqual(["Memories", "Together", "Wishes"]);
  await userEvent.click(menu());
  expect([...host.querySelectorAll("#guest-nav li")].map((li) => li.textContent)).toEqual(["Home", "Memories", "Together", "Wishes", "Settings"]);
  await userEvent.click(item("Together"));
  await expect.poll(() => heading()?.textContent).toBe("Together");
  expect(location.pathname).toBe("/g/together");
  expect(to("/api/guest/list")[0].body).toEqual({ section: "together" });
  history.replaceState(null, "", "/");
});

test("G4: place cards open a sheet; previous and next wrap; Escape and Close return focus to the card", async () => {
  serve({ "/api/guest/list": [ok({ items: [place(1, "[PLACE_ONE]"), place(2, "[PLACE_TWO]")] })] });
  mount({ summary: WITH_TOGETHER, section: "together" });
  await expect.poll(() => text()).toContain("2 places");
  const card = (title: string) => [...host.querySelectorAll<HTMLButtonElement>("main button")].find((b) => b.textContent?.includes(title))!;
  const sheet = () => host.querySelector<HTMLDialogElement>("dialog[open]");
  await userEvent.click(card("[PLACE_ONE]"));
  expect(sheet()?.querySelector("h2")?.textContent).toBe("[PLACE_ONE]");
  expect(document.activeElement).toBe(sheet()!.querySelector("h2"));
  expect(sheet()!.textContent).toContain("[NOTE_1]");
  const control = (label: string) => [...sheet()!.querySelectorAll("button")].find((b) => b.textContent === label || b.getAttribute("aria-label") === label)!;
  await userEvent.click(control("Next place"));
  expect(sheet()!.querySelector("h2")?.textContent).toBe("[PLACE_TWO]");
  await userEvent.click(control("Next place"));
  expect(sheet()!.querySelector("h2")?.textContent).toBe("[PLACE_ONE]");
  await userEvent.click(control("Previous place"));
  expect(sheet()!.querySelector("h2")?.textContent).toBe("[PLACE_TWO]");
  await userEvent.keyboard("{Escape}");
  expect(sheet()).toBeNull();
  expect(document.activeElement).toBe(card("[PLACE_TWO]"));
  await userEvent.click(card("[PLACE_ONE]"));
  await userEvent.click(control("Close"));
  expect(sheet()).toBeNull();
  expect(document.activeElement).toBe(card("[PLACE_ONE]"));
});

test("G4: search finds places by name in either language, without accents; no match says so", async () => {
  serve({ "/api/guest/list": [ok({ items: [place(1, "Quán cà phê"), place(2, "[PLACE_TWO]", { title_alt: "Bãi biển", lang_alt: "vi" })] })] });
  mount({ summary: WITH_TOGETHER, section: "together" });
  const search = () => host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await expect.poll(() => search()).toBeTruthy();
  expect(search().labels?.[0]?.textContent ?? search().getAttribute("aria-label")).toBe("Find one of our places");
  await userEvent.type(search(), "ca phe");
  expect(host.querySelectorAll("main li")).toHaveLength(1);
  await userEvent.clear(search());
  await userEvent.type(search(), "bien");
  expect(host.querySelectorAll("main li")).toHaveLength(1);
  await userEvent.clear(search());
  await userEvent.type(search(), "nowhere");
  expect(host.querySelectorAll("main li")).toHaveLength(0);
  expect(text()).toContain("No place with that name.");
});

// T3.1c G3 memory album (screens G3; editable copy §3.3; Q67, Q68): an opening page with the cover and contents, the
// message (with its voice note), photo pages of four, a video page; previous and next, a contents list, a photo viewer;
// video and voice are signed only when played. Own address /g/memories/<id>.
const media = (n: number, kind: string, more: object = {}) => ({
  id: `00000000-0000-0000-0000-${String(2000 + n).padStart(12, "0")}`, kind, width: 4, height: 3, duration_ms: null, alt: `[ALT_${n}]`, alt_alt: null, ...more,
});
const ALBUM = memory(1, {
  title: "[TRIP]", body: "[MESSAGE]",
  media: [1, 2, 3, 4, 5, 6].map((n) => media(n, "photo")).concat([media(7, "video", { duration_ms: 24000 }), media(8, "audio", { alt: "[TRANSCRIPT]" })]),
});
const button2 = (label: string) => [...host.querySelectorAll<HTMLButtonElement>("main button")].find((b) => b.textContent === label || b.getAttribute("aria-label") === label)!;
const pageLabel = () => host.querySelector<HTMLButtonElement>("button[aria-controls='album-contents']")?.textContent;

test("G3: a memory card opens the album at its own address; pages turn; the contents list jumps", async () => {
  serve({ "/api/guest/list": [ok({ items: [ALBUM] })], "/api/guest/item": [ok({ item: ALBUM })] });
  mount({ section: "memories" });
  await expect.poll(() => host.querySelector(`a[href="/g/memories/${M1}"]`)).toBeTruthy();
  await userEvent.click(host.querySelector(`a[href="/g/memories/${M1}"]`)!);
  await expect.poll(() => heading()?.textContent).toBe("[TRIP]");
  await expect.poll(() => document.activeElement).toBe(heading()); // focus moves in an effect after the heading renders
  expect(location.pathname).toBe(`/g/memories/${M1}`);
  expect(to("/api/guest/item")[0].body).toEqual({ id: M1 });
  // Opening, Message, Photos 2-5, Photo 6, Video.
  expect(pageLabel()).toBe("Page 1 of 5");
  await userEvent.click(button2("Next page"));
  expect(pageLabel()).toBe("Page 2 of 5");
  expect(text()).toContain("[MESSAGE]");
  expect(document.activeElement).toBe(button2("Next page"));
  await userEvent.click(button2("Next page"));
  expect(host.querySelectorAll("main .album-photo")).toHaveLength(4);
  await userEvent.click(button2("Previous page"));
  expect(pageLabel()).toBe("Page 2 of 5");
  await userEvent.click(host.querySelector<HTMLButtonElement>("button[aria-controls='album-contents']")!);
  const chapters = [...host.querySelectorAll<HTMLButtonElement>("#album-contents button")];
  expect(chapters.map((c) => c.textContent)).toEqual(["Opening", "Message", "Photos", "Video"]);
  await userEvent.click(chapters[3]);
  expect(pageLabel()).toBe("Page 5 of 5");
  expect(button2("Next page").getAttribute("aria-disabled")).toBe("true");
  history.replaceState(null, "", "/");
});

test("G3: the message falls back to the original language with a note (Q67); the voice note signs only on play", async () => {
  localStorage.setItem("vegenus_prefs", JSON.stringify({ lang: "vi" }));
  serve({ "/api/guest/item": [ok({ item: ALBUM })], "/api/guest/media": [ok({ urls: {} }), ok({ urls: { [media(8, "audio").id]: "/voice.m4a" } })] });
  mount({ section: "memories", item: M1 });
  await expect.poll(() => heading()?.textContent).toBe("[TRIP]");
  await userEvent.click(button2("Trang sau"));
  expect(text()).toContain("Hiển thị bằng ngôn ngữ gốc.");
  expect([...host.querySelectorAll("main p")].find((p) => p.textContent === "[MESSAGE]")?.getAttribute("lang")).toBe("en");
  expect(text()).toContain("[TRANSCRIPT]");
  expect(to("/api/guest/media").some((c) => c.body.variant === "audio")).toBe(false);
  await userEvent.click(button2("Nghe lời nhắn"));
  await expect.poll(() => host.querySelector("main audio")?.getAttribute("src")).toBe("/voice.m4a");
  expect(to("/api/guest/media").at(-1)!.body).toMatchObject({ ids: [media(8, "audio").id], variant: "audio" });
});

test("G3: the photo viewer opens on a photo, wraps, and Escape returns focus to it; video signs only on play", async () => {
  serve({ "/api/guest/item": [ok({ item: ALBUM })] });
  mount({ section: "memories", item: M1 });
  await expect.poll(() => heading()?.textContent).toBe("[TRIP]");
  await userEvent.click(button2("Next page"));
  await userEvent.click(button2("Next page"));
  const photo = host.querySelectorAll<HTMLButtonElement>("main .album-photo")[3];
  await userEvent.click(photo);
  const viewer = () => host.querySelector<HTMLDialogElement>("dialog[open]");
  expect(viewer()?.textContent).toContain("Photo 5 of 6");
  const control = (label: string) => [...viewer()!.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label || b.textContent === label)!;
  await userEvent.click(control("Next photo"));
  expect(viewer()?.textContent).toContain("Photo 6 of 6");
  await userEvent.click(control("Next photo"));
  expect(viewer()?.textContent).toContain("Photo 1 of 6");
  await userEvent.keyboard("{Escape}");
  expect(viewer()).toBeNull();
  expect(document.activeElement).toBe(photo);
  await userEvent.click(button2("Next page"));
  await userEvent.click(button2("Next page"));
  expect(host.querySelector("main video")).toBeNull();
  expect(to("/api/guest/media").some((c) => c.body.variant === "video")).toBe(false);
  await userEvent.click(button2("Play video"));
  await expect.poll(() => to("/api/guest/media").some((c) => c.body.variant === "video")).toBe(true);
});

test("G3: a memory that is gone says so, with a way back to Memories", async () => {
  serve({ "/api/guest/item": [{ status: 404, body: { error: "not_found" } }], "/api/guest/list": [ok({ items: [] })] });
  mount({ section: "memories", item: M1 });
  await expect.poll(() => text()).toContain("This memory is no longer available.");
  await userEvent.click([...host.querySelectorAll("main a")].find((a) => a.textContent === "Back to Memories")!);
  await expect.poll(() => heading()?.textContent).toBe("Memories");
});

test("G2: a memory card is a link named by its card (title and date), for screen readers", async () => {
  serve({ "/api/guest/list": [ok({ items: [memory(1, { title: "[CARD]" })] })] });
  mount({ section: "memories" });
  await expect.element(page.getByRole("link", { name: /\[CARD\].*2024/ })).toBeInTheDocument();
});

// T3.1c review fixes.
test("G3 review: a photo without alt text, or not loaded yet, is a button named by its place", async () => {
  const bare = memory(1, { title: "[T]", media: [media(1, "photo", { alt: null }), media(2, "photo", { alt: null })] });
  serve({ "/api/guest/item": [ok({ item: bare })] });
  mount({ section: "memories", item: M1 });
  await expect.element(page.getByRole("button", { name: "Photo 1 of 2" })).toBeInTheDocument();
});

test("G3 review: an album photo whose URL expired is signed again", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const id = media(1, "photo").id;
  serve({ "/api/guest/item": [ok({ item: ALBUM })], "/api/guest/media": [ok({ urls: { [id]: "/a.webp" } }), ok({ urls: { [id]: "/a2.webp" } })] });
  mount({ section: "memories", item: M1 });
  const img = () => host.querySelector<HTMLImageElement>("main .album-photo img");
  await expect.poll(() => img()?.getAttribute("src")).toBe("/a.webp");
  vi.setSystemTime(Date.now() + 301_000);
  img()!.dispatchEvent(new Event("error"));
  await expect.poll(() => img()?.getAttribute("src")).toBe("/a2.webp");
});

test("G3 review: Play video can be tried again after its signing failed", async () => {
  const film = memory(1, { title: "[T]", media: [media(7, "video", { duration_ms: 24000 })] });
  const vid = media(7, "video").id;
  serve({ "/api/guest/item": [ok({ item: film })], "/api/guest/media": [ok({ urls: {} }), { status: 503, body: { error: "unavailable" } }, ok({ urls: { [vid]: "/v.mp4" } })] });
  mount({ section: "memories", item: M1 });
  await expect.poll(() => heading()?.textContent).toBe("[T]");
  await userEvent.click(button2("Next page"));
  await userEvent.click(button2("Play video"));
  await expect.poll(() => to("/api/guest/media").filter((c) => c.body.variant === "video")).toHaveLength(1);
  await userEvent.click(button2("Play video"));
  await expect.poll(() => host.querySelector("main video")?.getAttribute("src")).toBe("/v.mp4");
});

test("G3 review: Back to Memories goes back through history; the browser Back from an album focuses the list heading", async () => {
  serve({ "/api/guest/list": [ok({ items: [ALBUM] })], "/api/guest/item": [ok({ item: ALBUM })] });
  mount({ section: "memories" });
  const push = vi.spyOn(history, "pushState");
  await expect.poll(() => host.querySelector(`a[href="/g/memories/${M1}"]`)).toBeTruthy();
  await userEvent.click(host.querySelector(`a[href="/g/memories/${M1}"]`)!);
  await expect.poll(() => heading()?.textContent).toBe("[TRIP]");
  await userEvent.click([...host.querySelectorAll("main a")].find((a) => a.textContent === "Back to Memories")!);
  await expect.poll(() => heading()?.textContent).toBe("Memories");
  expect(push).toHaveBeenCalledTimes(1);
  await expect.poll(() => document.activeElement).toBe(heading());
  await expect.poll(() => host.querySelector(`a[href="/g/memories/${M1}"]`)).toBeTruthy(); // the list reads its cards again
  await userEvent.click(host.querySelector(`a[href="/g/memories/${M1}"]`)!);
  await expect.poll(() => heading()?.textContent).toBe("[TRIP]");
  history.back();
  await expect.poll(() => heading()?.textContent).toBe("Memories");
  await expect.poll(() => document.activeElement).toBe(heading());
  push.mockRestore();
  history.replaceState(null, "", "/");
});

test("G4 review: the no-match notice is a live region present before searching; one place has no previous or next", async () => {
  serve({ "/api/guest/list": [ok({ items: [place(1, "[ONLY]")] })] });
  mount({ section: "together" });
  await expect.poll(() => host.querySelector("main li button")).toBeTruthy();
  const regions = [...host.querySelectorAll("main [role='status']")];
  await userEvent.type(host.querySelector<HTMLInputElement>("input[type='search']")!, "nowhere");
  expect(regions.some((r) => r.isConnected && r.textContent === "No place with that name.")).toBe(true);
  await userEvent.clear(host.querySelector<HTMLInputElement>("input[type='search']")!);
  await userEvent.click(host.querySelector<HTMLButtonElement>("main li button")!);
  await expect.poll(() => host.querySelector("dialog[open] h2")?.textContent).toBe("[ONLY]");
  expect([...host.querySelectorAll("dialog[open] button")].map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual(["Close"]);
});

test("G1 review: the photo stack is named by its place while its photo is not loaded, even with alt text", async () => {
  serve();
  mount();
  await expect.element(page.getByRole("button", { name: "Photo 1 of 2" })).toBeInTheDocument();
});

test("G2 review: a list thumbnail whose URL expired is signed again", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const id = media(1, "photo").id;
  serve({ "/api/guest/list": [ok({ items: [memory(1, { media: [media(1, "photo")] })] })], "/api/guest/media": [ok({ urls: { [id]: "/t.webp" } }), ok({ urls: { [id]: "/t2.webp" } })] });
  mount({ section: "memories" });
  const img = () => host.querySelector<HTMLImageElement>("main li img");
  await expect.poll(() => img()?.getAttribute("src")).toBe("/t.webp");
  vi.setSystemTime(Date.now() + 301_000);
  img()!.dispatchEvent(new Event("error"));
  await expect.poll(() => img()?.getAttribute("src")).toBe("/t2.webp");
});

// T3.1pc (Q155): the same views for a visitor at /p/<name>: every read names the page instead of sending a token, and
// the addresses follow /p/<name>, with the browser's Back as for /g.
test("a visitor at /p/<name>: reads name the page, menu, cards and Back follow /p/<name>", async () => {
  serve({ "/api/guest/list": [ok({ items: [ALBUM] })], "/api/guest/item": [ok({ item: ALBUM })] });
  history.replaceState(null, "", "/p/our-page");
  mount({ cred: { page: "our-page" } });
  await expect.poll(() => to("/api/guest/media").length).toBeGreaterThan(0);
  expect(to("/api/guest/media")[0].body).toMatchObject({ page: "our-page" });
  expect(to("/api/guest/media")[0].body).not.toHaveProperty("token");
  await userEvent.click(menu());
  expect(item("Memories").getAttribute("href")).toBe("/p/our-page/memories");
  await userEvent.click(item("Memories"));
  expect(location.pathname).toBe("/p/our-page/memories");
  expect(to("/api/guest/list")[0].body).toEqual({ section: "memories", page: "our-page" });
  await expect.poll(() => host.querySelector(`a[href="/p/our-page/memories/${M1}"]`)).toBeTruthy();
  await userEvent.click(host.querySelector(`a[href="/p/our-page/memories/${M1}"]`)!);
  expect(location.pathname).toBe(`/p/our-page/memories/${M1}`);
  await expect.poll(() => heading()?.textContent).toBe("[TRIP]");
  expect(to("/api/guest/item")[0].body).toEqual({ id: M1, page: "our-page" });
  history.back();
  await expect.poll(() => heading()?.textContent).toBe("Memories");
  history.replaceState(null, "", "/");
});
