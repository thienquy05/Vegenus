import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { Home } from "@/lib/home";
import { HomeEditor } from "./home";
import Owner from "./owner";

// Owner() needs a router; next/navigation is CommonJS, so Vite's interop reads it through its default export.
vi.mock("next/navigation", () => {
  const router = { push: () => {} }; // one object, as Next keeps it: Owner's read effect depends on it
  const useRouter = () => router;
  return { useRouter, default: { useRouter } };
});

// O17 Home editor in a real browser (owner UI "O17 Home editor and the O2 Home card"; PRD Q144; E14, E15). fetch is
// replaced: each route answers from a queue, and every request is kept. Placeholder data only.
const ID = "00000000-0000-0000-0000-0000000000d1";
const B1 = "00000000-0000-0000-0000-0000000000b1";
const C1 = "00000000-0000-0000-0000-0000000000c1";
const C2 = "00000000-0000-0000-0000-0000000000c2";
const C3 = "00000000-0000-0000-0000-0000000000c3";
const pick = (media_id: string, alt: string | null) => ({ media_id, item_id: B1, alt, alt_alt: null, width: 4, height: 3, preview_url: null });
const SAVED: Home = {
  id: ID, version: 3, status: "published", lang: "en", body: "Welcome", lang_alt: null, body_alt: null, start_date: "2026-11-01",
  published: { start_date: "2026-11-01" }, published_at: "2026-11-02T00:00:00Z", timezone: "UTC", unpublished_changes: false,
  picks: [pick(C1, "Beach"), pick(C2, "Hill"), pick(C3, null)],
};
const PAGE = { version: 2, theme: "a_dreamy", default_lang: "en", label_a: "[PARTNER_A]", label_b: "[PARTNER_B]", timezone: "UTC", visibility: "token_only", setup_completed: true, sections: [] };
const DRAFTS = { "home.greeting": { en: "Hello from {partner_a}.", vi: "Chào từ {partner_a}." }, "home.days": { en: "Together for {days} days.", vi: "Bên nhau {days} ngày." } };
const NOW = new Date("2026-11-21T12:00:00Z"); // Day 21 of a 2026-11-01 start in UTC

type Reply = { status: number; body?: unknown } | "network";
let calls: { url: string; body: Record<string, unknown> | null }[] = [];
function serve(routes: Record<string, (Reply | Promise<Reply>)[]>) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      const reply = await routes[url]?.shift();
      if (!reply || reply === "network") throw new TypeError(`no answer for ${url}`);
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status });
    }),
  );
}
const ok = (body: unknown = {}): Reply => ({ status: 200, body });
const read = (home: Home | null) => ok({ home });
const posted = (url: string) => calls.filter((c) => c.url === url);
const GET = "/api/owner/home/get";
const SAVE = "/api/owner/home";
const STATUS = "/api/owner/item/status";
const PICKER = "/api/owner/home/picker";

let root: Root | null = null;
let host: HTMLElement;
afterEach(() => {
  root?.unmount();
  root = null;
  host.remove();
  vi.unstubAllGlobals();
});
function editor() {
  const onBack = vi.fn();
  const onSignedOut = vi.fn();
  const onContent = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(createElement(HomeEditor, { page: PAGE, drafts: DRAFTS, now: NOW, onBack, onSignedOut, onContent }));
  return { onBack, onSignedOut, onContent };
}
const text = () => host.textContent ?? "";
const region = (role: string) => host.querySelector(`[role="${role}"]`)?.textContent ?? "";
const byId = <T extends HTMLElement = HTMLInputElement>(id: string) => host.querySelector<T>(`#${CSS.escape(id)}`)!;
const button = (label: string, scope: ParentNode = host.querySelector("dialog[open]") ?? host) =>
  [...scope.querySelectorAll("button")].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
const rows = () => [...host.querySelectorAll<HTMLElement>("#home-stack > li")];
const preview = () => byId<HTMLElement>("home-preview").textContent ?? "";
function offline(on: boolean) {
  if (on) Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  else delete (navigator as { onLine?: boolean }).onLine;
  dispatchEvent(new Event(on ? "offline" : "online"));
}
const opened = () => expect.poll(() => host.querySelector("#home-note")).not.toBeNull();

test("reads Home: the date with the page time zone beside it, the counter, the note count; the preview uses the working copy", async () => {
  serve({ [GET]: [read(SAVED)] });
  editor();
  await opened();
  expect(calls[0]).toEqual({ url: GET, body: {} });
  expect(byId("home-start").value).toBe("2026-11-01");
  expect(byId("home-start").type).toBe("date");
  expect(text()).toContain("Time zone");
  expect(byId<HTMLElement>("home-zone").textContent).toBe("UTC");
  expect(text()).toContain("Day 21 together");
  expect(byId<HTMLElement>("home-note-count").textContent).toBe("7/600");
  // The published Wording greeting and days line, filled and marked as placeholders.
  expect(preview()).toContain("Hello from [PARTNER_A].");
  expect(preview()).toContain("Together for 21 days.");
  expect(preview()).toContain("Wording placeholders");
  expect(preview()).toContain("Welcome");
  await userEvent.fill(byId("home-note"), "Xin chào");
  expect(preview()).toContain("Xin chào");
  await userEvent.fill(byId("home-start"), "2026-12-01");
  expect(text()).toContain("Counter starts on 2026-12-01");
  expect(preview()).not.toContain("Together for");
});

test("a new Home is created under the id the screen chose, then re-read; Save draft waits for a change", async () => {
  const created = { ...SAVED, version: 1, status: "draft" as const, published: null, published_at: null, picks: [], start_date: null };
  serve({ [GET]: [read(null), read(created)], [SAVE]: [ok({ id: ID, version: 1 })] });
  editor();
  await opened();
  expect(button("Save draft").disabled).toBe(true);
  expect(preview()).toContain("Photos will appear here once the owners add them.");
  expect(preview()).toContain("The owners have not added a welcome note yet.");
  await userEvent.fill(byId("home-note"), "Welcome");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("status")).toContain("Draft saved.");
  const sent = posted(SAVE)[0].body!;
  expect(sent).toMatchObject({ expected_version: null, lang: "en", body: "Welcome", lang_alt: null, body_alt: null, start_date: null, picks: [] });
  expect(sent.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(posted(GET)).toHaveLength(2);
});

test("an over-long note is marked on its control with one summary; nothing is sent", async () => {
  serve({ [GET]: [read(SAVED)] });
  editor();
  await opened();
  await userEvent.click(byId("home-second"));
  await userEvent.fill(byId("home-note"), "a".repeat(601));
  await userEvent.fill(byId("home-second-note"), "b".repeat(601));
  expect(byId<HTMLElement>("home-note-count").textContent).toBe("601/600");
  await userEvent.click(button("Save draft"));
  expect(text()).toContain("Check the highlighted fields before saving.");
  expect(host.querySelectorAll("#error-summary li")).toHaveLength(2);
  expect(byId("home-note").getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(byId("home-note"));
  expect(posted(SAVE)).toHaveLength(0);
});

test("the second language must differ from the main one; a missing second note falls back to the main one", async () => {
  serve({ [GET]: [read(SAVED)] });
  editor();
  await opened();
  await userEvent.click(byId("home-second"));
  expect(text()).toContain("If blank, guests see the main-language note.");
  await userEvent.selectOptions(byId<HTMLSelectElement>("home-second-lang"), "en");
  await userEvent.click(button("Save draft"));
  expect(text()).toContain("Choose a different language or remove the second language.");
  expect(posted(SAVE)).toHaveLength(0);
});

test("Publish saves first, then publishes, then re-reads; a clean published Home has nothing to publish", async () => {
  serve({
    [GET]: [read({ ...SAVED, unpublished_changes: true }), read({ ...SAVED, version: 5, body: "New" })],
    [SAVE]: [ok({ id: ID, version: 4 })],
    [STATUS]: [ok({ version: 5 })],
  });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "New");
  await userEvent.click(button("Publish"));
  await expect.poll(() => region("status")).toContain("Published.");
  expect(posted(SAVE)[0].body).toMatchObject({ expected_version: 3, body: "New" });
  expect(posted(STATUS)[0].body).toEqual({ id: ID, expected_version: 4, status: "published" });
  expect(button("Publish").disabled).toBe(true);
});

test("a clean Home with unpublished changes publishes without a save", async () => {
  serve({ [GET]: [read({ ...SAVED, unpublished_changes: true }), read({ ...SAVED, version: 4 })], [STATUS]: [ok({ version: 4 })] });
  editor();
  await opened();
  await userEvent.click(button("Publish"));
  await expect.poll(() => region("status")).toContain("Published.");
  expect(posted(SAVE)).toHaveLength(0);
  expect(posted(STATUS)[0].body).toEqual({ id: ID, expected_version: 3, status: "published" });
});

test("a save whose outcome is unknown keeps its payload: Try again re-reads, and later edits are never sent with it", async () => {
  serve({ [GET]: [read(SAVED), read({ ...SAVED, version: 4, body: "First" })], [SAVE]: [{ status: 503 }] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "First");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("alert")).toContain("Save outcome could not be confirmed. Try again to check.");
  expect(byId("home-note").value).toBe("First");
  await userEvent.fill(byId("home-note"), "Second");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("status")).toContain("Draft saved.");
  expect(posted(SAVE)).toHaveLength(1); // it landed: nothing is resent
  expect(byId("home-note").value).toBe("Second");
  expect(button("Save draft").disabled).toBe(false);
});

test("an unknown outcome that did not land resends the original payload", async () => {
  serve({ [GET]: [read(SAVED), read(SAVED), read({ ...SAVED, version: 4, body: "First" })], [SAVE]: ["network", ok({ id: ID, version: 4 })] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "First");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("alert")).toContain("Save outcome could not be confirmed.");
  await userEvent.fill(byId("home-note"), "Second");
  await userEvent.click(button("Try again"));
  await expect.poll(() => posted(SAVE)).toHaveLength(2);
  expect(posted(SAVE)[1].body).toEqual(posted(SAVE)[0].body);
  await expect.poll(() => region("status")).toContain("Draft saved.");
});

test("a signed-out save keeps the input, offers sign in in a new tab, and Try again sends it", async () => {
  serve({ [GET]: [read(SAVED), read(SAVED), read({ ...SAVED, version: 4, body: "First" })], [SAVE]: [{ status: 401 }, ok({ id: ID, version: 4 })] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "First");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("alert")).toContain("Sign in again. Your input is kept here.");
  const link = host.querySelector<HTMLAnchorElement>('a[href="/login?next=%2Fapp"]')!;
  expect(link.target).toBe("_blank");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("status")).toContain("Draft saved.");
  expect(posted(SAVE)[1].body).toMatchObject({ body: "First" });
});

test("409: the saved Home is re-read; the panel names what changed; both choices wait for the re-read", async () => {
  let answer: (r: Reply) => void = () => {};
  const held = new Promise<Reply>((resolve) => (answer = resolve));
  serve({ [GET]: [read(SAVED), held], [SAVE]: [{ status: 409 }, ok({ id: ID, version: 5 })] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "Mine");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => text()).toContain("This item changed elsewhere");
  expect(button("Keep mine").disabled).toBe(true);
  expect(button("Reload saved").disabled).toBe(true);
  answer(read({ ...SAVED, version: 4, start_date: "2026-10-01" }));
  await expect.poll(() => button("Keep mine").disabled).toBe(false);
  expect(byId<HTMLElement>("home-changed").textContent).toContain("Together since");
  expect(byId<HTMLElement>("home-changed").textContent).not.toContain("Photo stack");
  await userEvent.click(button("Keep mine"));
  expect(byId("home-note").value).toBe("Mine");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => posted(SAVE)).toHaveLength(2);
  expect(posted(SAVE)[1].body).toMatchObject({ expected_version: 4, body: "Mine" });
});

test("Reload saved takes the re-read Home; a first create that meets an existing Home says it was created elsewhere", async () => {
  serve({ [GET]: [read(null), read(SAVED)], [SAVE]: [{ status: 409 }] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "Mine");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => text()).toContain("Home was created elsewhere");
  await expect.poll(() => button("Reload saved").disabled).toBe(false);
  await userEvent.click(button("Reload saved"));
  expect(byId("home-note").value).toBe("Welcome");
  expect(text()).not.toContain("Home was created elsewhere");
});

test("Unpublish asks first with Home's consequence, then the preview shows what guests see now", async () => {
  serve({ [GET]: [read(SAVED), read({ ...SAVED, version: 4, status: "draft", published: null })], [STATUS]: [ok({ version: 4 })] });
  editor();
  await opened();
  await userEvent.click(button("Unpublish"));
  expect(host.querySelector("dialog[open]")?.textContent).toContain("On Home, guests will see the couple title and greeting.");
  await userEvent.click(button("Unpublish", host.querySelector("dialog[open]")!));
  await expect.poll(() => region("status")).toContain("Unpublished.");
  expect(posted(STATUS)[0].body).toEqual({ id: ID, expected_version: 3, status: "draft" });
  expect(preview()).toContain("What guests see now");
  expect(preview()).toContain("Hello from [PARTNER_A].");
  expect(preview()).not.toContain("Welcome");
  await userEvent.fill(byId("home-note"), "Back");
  expect(preview()).toContain("Back");
  expect(region("status")).toContain("Preview switched to Working copy.");
});

test("offline keeps the input and pauses every action; reconnecting says so", async () => {
  serve({ [GET]: [read(SAVED)] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "Kept");
  offline(true);
  try {
    await expect.poll(() => button("Save draft").disabled).toBe(true);
    expect(button("Publish").disabled).toBe(true);
    expect(button("Choose photos").disabled).toBe(true);
    expect(button("Save draft").getAttribute("aria-describedby")).toContain("offline-reason");
    expect(byId("home-note").value).toBe("Kept");
  } finally {
    offline(false);
  }
  await expect.poll(() => region("status")).toContain("Connection restored.");
  expect(button("Save draft").disabled).toBe(false);
});

test("Back with unsaved changes asks first", async () => {
  serve({ [GET]: [read(SAVED)] });
  const { onBack } = editor();
  await opened();
  await userEvent.fill(byId("home-note"), "Unsaved");
  await userEvent.click(button("Back"));
  expect(host.querySelector("dialog[open]")?.textContent).toContain("Leave without saving?");
  await userEvent.click(button("Keep writing"));
  expect(onBack).not.toHaveBeenCalled();
  await userEvent.click(button("Back"));
  await userEvent.click(button("Discard"));
  expect(onBack).toHaveBeenCalled();
});

test("the stack: the first pick is the cover, whatever its memory (Q152), and moves keep focus", async () => {
  serve({ [GET]: [read({ ...SAVED, picks: [pick(C2, "Hill"), pick(C1, "Beach"), pick(C3, null)] })] });
  editor();
  await opened();
  expect(rows()).toHaveLength(3);
  expect(text()).not.toContain("Hidden");
  expect(rows()[0].textContent).toContain("Cover");
  expect(rows()[1].textContent).not.toContain("Cover");
  expect(rows()[2].textContent).toContain("Photo 3"); // no description
  // Move down keeps focus on the same button in the pick's new row.
  await userEvent.click(button("Move down", rows()[1]));
  expect(rows()[2].textContent).toContain("Beach");
  expect(button("Move down", rows()[2]).disabled).toBe(true);
  // That button is now disabled, so focus is on the pick's row.
  expect(document.activeElement).toBe(rows()[2]);
  expect(rows()[0].textContent).toContain("Cover"); // the cover is the first pick
  expect(region("status")).toContain("Moved to position 3.");
  await userEvent.click(button("Move down", rows()[0]));
  expect(document.activeElement).toBe(button("Move down", rows()[1]));
  expect(button("Save draft").disabled).toBe(false);
});

test("Remove moves focus to the next pick's Remove, else the previous one's", async () => {
  serve({ [GET]: [read(SAVED)] });
  editor();
  await opened();
  await userEvent.click(button("Remove from stack", rows()[1]));
  expect(rows()).toHaveLength(2);
  expect(document.activeElement).toBe(button("Remove from stack", rows()[1]));
  expect(region("status")).toContain("Removed from the stack.");
  await userEvent.click(button("Remove from stack", rows()[1]));
  expect(document.activeElement).toBe(button("Remove from stack", rows()[0]));
  expect(text()).toContain("Pick 3 to 7 photos.");
});

const MEMORIES = [
  {
    item_id: B1, lang: "en", title: "Trip", title_alt: null, event_date: "2024-05-01", date_precision: "day",
    photos: [
      { media_id: C1, alt: "Beach", alt_alt: null, width: 4, height: 3, preview_url: null },
      { media_id: C3, alt: null, alt_alt: null, width: 4, height: 3, preview_url: null },
      ...[4, 5, 6, 7, 8, 9].map((n) => ({ media_id: `00000000-0000-0000-0000-0000000000e${n}`, alt: `View ${n}`, alt_alt: null, width: 4, height: 3, preview_url: null })),
    ],
  },
];
const boxes = () => [...host.querySelectorAll<HTMLInputElement>("dialog[open] input[type=checkbox]")];
const box = (name: string) => boxes().find((b) => b.labels?.[0]?.textContent?.includes(name))!;
const pickerOpen = () => expect.poll(() => boxes().length).toBeGreaterThan(0);

test("the picker stages choices until Use these photos; Esc discards them and returns focus", async () => {
  serve({ [GET]: [read({ ...SAVED, picks: [pick(C1, "Beach")] })], [PICKER]: [ok({ memories: MEMORIES }), ok({ memories: MEMORIES })] });
  editor();
  await opened();
  await userEvent.click(button("Choose photos"));
  await pickerOpen();
  expect(host.querySelector("dialog[open]")?.textContent).toContain("Trip");
  expect(box("Beach").checked).toBe(true); // already in the stack
  // The tile label is a flex row: the bilingual name is one item, not a column per language.
  expect(box("No description yet").labels![0].lastElementChild?.textContent).toBe("No description yet / Chưa có mô tả");
  expect(text()).toContain("Edit photo descriptions on the memory.");
  await userEvent.click(box("View 4"));
  expect(text()).toContain("2 of 7 photos selected");
  await userEvent.keyboard("{Escape}");
  expect(host.querySelector("dialog[open]")).toBeNull();
  expect(rows()).toHaveLength(1);
  expect(document.activeElement).toBe(button("Choose photos"));
  await userEvent.click(button("Choose photos"));
  await pickerOpen();
  expect(box("View 4").checked).toBe(false); // the discarded choice is gone
  await userEvent.click(box("View 4"));
  await userEvent.click(box("No description yet"));
  await userEvent.click(button("Use these photos"));
  expect(rows()).toHaveLength(3);
  expect(rows()[0].textContent).toContain("Beach");
  expect(rows()[1].textContent).toContain("Photo 2"); // picker order: the photo without a description comes first
  expect(rows()[2].textContent).toContain("View 4");
  expect(region("status")).toContain("Photo stack updated.");
  expect(text()).not.toContain("Pick 3 to 7 photos.");
});

test("at seven the picker disables the rest with the reason; a pick the picker does not list uses a slot and the picker says so", async () => {
  serve({ [GET]: [read({ ...SAVED, picks: [pick(C2, "Hill")] })], [PICKER]: [ok({ memories: MEMORIES })] });
  editor();
  await opened();
  await userEvent.click(button("Choose photos"));
  await pickerOpen();
  for (const b of boxes().slice(0, 6)) await userEvent.click(b);
  expect(text()).toContain("7 of 7 photos selected");
  expect(boxes()[6].disabled).toBe(true);
  expect(text()).toContain("Close the picker and remove a photo from the stack to free a slot.");
});

test("the picker: a failed read has its own Try again; empty links to Content", async () => {
  serve({ [GET]: [read(SAVED)], [PICKER]: [{ status: 503 }, ok({ memories: [] })] });
  const { onContent } = editor();
  await opened();
  await userEvent.click(button("Choose photos"));
  await expect.poll(() => host.querySelector("dialog[open]")?.textContent).toContain("Couldn’t load this. Try again.");
  await userEvent.click(button("Try again"));
  await expect.poll(() => host.querySelector("dialog[open]")?.textContent).toContain("No published photos yet.");
  await userEvent.click(button("Content"));
  expect(onContent).toHaveBeenCalled();
});

test("photos deleted meanwhile drop out on the re-read after a save, with one notice giving the count", async () => {
  serve({ [GET]: [read(SAVED), read({ ...SAVED, version: 4, picks: [pick(C1, "Beach")] })], [SAVE]: [ok({ id: ID, version: 4 })] });
  editor();
  await opened();
  await userEvent.click(button("Remove from stack", rows()[1]));
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("status")).toContain("Deleted photos removed from the stack: 1.");
  expect(posted(SAVE)[0].body).toMatchObject({ picks: [C1, C3] });
  expect(rows()).toHaveLength(1);
});

// Review fixes (reviewer, T2.4b).

test("Unpublish keeps unsaved edits in the working copy", async () => {
  serve({ [GET]: [read(SAVED), read({ ...SAVED, version: 4, status: "draft", published: null })], [STATUS]: [ok({ version: 4 })] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "Unsaved");
  await userEvent.click(button("Unpublish"));
  await userEvent.click(button("Unpublish", host.querySelector("dialog[open]")!));
  await expect.poll(() => region("status")).toContain("Unpublished.");
  expect(byId("home-note").value).toBe("Unsaved");
  expect(button("Save draft").disabled).toBe(false);
});

test("after a kept retry whose re-read failed, Try again re-reads and still keeps the later edits", async () => {
  serve({
    [GET]: [read(SAVED), read(SAVED), "network", read({ ...SAVED, version: 4, body: "First" })],
    [SAVE]: [{ status: 503 }, ok({ id: ID, version: 4 })],
  });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "First");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("alert")).toContain("Save outcome could not be confirmed.");
  await userEvent.fill(byId("home-note"), "Second");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("alert")).toContain("Couldn’t load this. Try again.");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("status")).toContain("Saved Home loaded.");
  expect(byId("home-note").value).toBe("Second");
});

test("a picker read that answers after Close does not reopen the picker", async () => {
  let answer: (r: Reply) => void = () => {};
  serve({ [GET]: [read(SAVED)], [PICKER]: [new Promise<Reply>((resolve) => (answer = resolve))] });
  editor();
  await opened();
  await userEvent.click(button("Choose photos"));
  await expect.poll(() => host.querySelector("dialog[open]")).not.toBeNull();
  await userEvent.keyboard("{Escape}");
  answer(ok({ memories: MEMORIES }));
  await new Promise((r) => setTimeout(r, 50));
  expect(host.querySelector("dialog[open]")).toBeNull();
  expect(document.activeElement).toBe(button("Choose photos"));
});

test("a description only in the other language is not marked with the memory's language", async () => {
  const memories = [{ ...MEMORIES[0], photos: [{ media_id: C1, alt: null, alt_alt: "Biển", width: 4, height: 3, preview_url: null }] }];
  serve({ [GET]: [read({ ...SAVED, picks: [] })], [PICKER]: [ok({ memories })] });
  editor();
  await opened();
  await userEvent.click(button("Choose photos"));
  await pickerOpen();
  expect(box("Biển").labels![0].lastElementChild?.hasAttribute("lang")).toBe(false);
});

test("the preview offers both Wording languages with a single note; the note falls back to the main one", async () => {
  await page.viewport(1440, 900); // the preview column shows from tablet width up, as in O5
  serve({ [GET]: [read({ ...SAVED, body_alt: null })] });
  editor();
  await opened();
  await userEvent.selectOptions(byId<HTMLSelectElement>("preview-lang"), "vi");
  expect(preview()).toContain("Chào từ [PARTNER_A].");
  expect(preview()).toContain("Bên nhau 21 ngày.");
  const note = [...byId<HTMLElement>("home-preview").querySelectorAll("p")].find((p) => p.textContent === "Welcome")!;
  expect(note.getAttribute("lang")).toBe("en");
});

test("offline, removing the last pick moves focus to the photo stack heading, not the disabled Choose photos", async () => {
  serve({ [GET]: [read({ ...SAVED, picks: [pick(C1, "Beach")] })] });
  editor();
  await opened();
  offline(true);
  try {
    await expect.poll(() => button("Choose photos").disabled).toBe(true);
    await userEvent.click(button("Remove from stack", rows()[0]));
    expect(document.activeElement).toBe(byId("home-photos-title"));
  } finally {
    offline(false);
  }
});

test("a repeated stack message is announced again", async () => {
  serve({ [GET]: [read(SAVED)] });
  editor();
  await opened();
  await userEvent.click(button("Remove from stack", rows()[0]));
  const changes: MutationRecord[] = [];
  const watch = new MutationObserver((m) => changes.push(...m));
  watch.observe(host.querySelector('[role="status"]')!, { childList: true, subtree: true, characterData: true });
  await userEvent.click(button("Remove from stack", rows()[0]));
  watch.disconnect();
  expect(changes.length).toBeGreaterThan(0);
  expect(region("status")).toContain("Removed from the stack.");
});

test("access lost on a retry's re-read offers Log out, not Try again", async () => {
  serve({ [GET]: [read(SAVED), { status: 403 }], [SAVE]: [{ status: 503 }] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "First");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("alert")).toContain("Save outcome could not be confirmed.");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("alert")).toContain("Access is no longer available.");
  expect(button("Try again")).toBeUndefined();
  expect(button("Log out")).toBeDefined();
});

test("a refused publish after a confirmed save whose re-read failed keeps a way to re-read", async () => {
  serve({ [GET]: [read({ ...SAVED, unpublished_changes: true }), "network"], [SAVE]: [ok({ id: ID, version: 4 })], [STATUS]: [{ status: 400 }] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "New");
  await userEvent.click(button("Publish"));
  await expect.poll(() => region("alert")).toContain("Couldn’t load this. Try again.");
  expect(button("Try again")).toBeDefined();
});

test("photos deleted meanwhile also leave a kept working copy after a resent save", async () => {
  serve({
    [GET]: [read(SAVED), read(SAVED), read({ ...SAVED, version: 4, body: "First", picks: [pick(C1, "Beach")] })],
    [SAVE]: [{ status: 503 }, ok({ id: ID, version: 4 })],
  });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "First");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("alert")).toContain("Save outcome could not be confirmed.");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("status")).toContain("Deleted photos removed from the stack: 2.");
  expect(rows()).toHaveLength(1);
});

test("a retried create that this screen made, edited elsewhere meanwhile, is a plain conflict, not created elsewhere", async () => {
  let sentId = "";
  serve({ [GET]: [read(null)], [SAVE]: [{ status: 503 }, { status: 409 }] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "Mine");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("alert")).toContain("Save outcome could not be confirmed.");
  sentId = String(posted(SAVE)[0].body!.id);
  const theirs = { ...SAVED, id: sentId, version: 2, body: "Edited elsewhere" };
  serve({ [GET]: [read(theirs), read(theirs)], [SAVE]: [{ status: 409 }] });
  await userEvent.click(button("Try again"));
  await expect.poll(() => text()).toContain("This item changed elsewhere");
  expect(text()).not.toContain("Home was created elsewhere");
});

test("Keep writing after the empty picker's Content link returns focus to Choose photos", async () => {
  serve({ [GET]: [read(SAVED)], [PICKER]: [ok({ memories: [] })] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "Unsaved");
  await userEvent.click(button("Choose photos"));
  await expect.poll(() => host.querySelector("dialog[open]")?.textContent).toContain("No published photos yet.");
  await userEvent.click(button("Content"));
  await expect.poll(() => host.querySelector("dialog[open]")?.textContent).toContain("Leave without saving?");
  await userEvent.click(button("Keep writing"));
  expect(document.activeElement).toBe(button("Choose photos"));
});

test("O2: the Home card's Try again keeps focus on the card and announces the result", async () => {
  serve({
    "/api/owner/page": [ok({ page: { ...PAGE, setup_completed: true }, drafts: DRAFTS })],
    [GET]: [{ status: 503 }, read(SAVED)],
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(createElement(Owner));
  await expect.poll(() => host.querySelector("#home-retry")).not.toBeNull();
  await userEvent.click(byId("home-retry"));
  expect(document.activeElement).toBe(byId("home-card-title"));
  await expect.poll(() => region("status")).toContain("Home loaded.");
});

// Re-review fixes (reviewer, T2.4b).

test("after a plain save whose re-read failed, Try again keeps what was typed since and announces photos deleted meanwhile", async () => {
  serve({ [GET]: [read(SAVED), "network", read({ ...SAVED, version: 4, body: "First", picks: [pick(C1, "Beach")] })], [SAVE]: [ok({ id: ID, version: 4 })] });
  editor();
  await opened();
  await userEvent.fill(byId("home-note"), "First");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("alert")).toContain("Couldn’t load this. Try again.");
  await userEvent.fill(byId("home-note"), "First, more");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("status")).toContain("Deleted photos removed from the stack: 2.");
  expect(byId("home-note").value).toBe("First, more");
  expect(rows()).toHaveLength(1);
});

test("closing the picker while offline moves focus to the photo stack heading, not the disabled Choose photos", async () => {
  serve({ [GET]: [read(SAVED)], [PICKER]: [ok({ memories: [] })] });
  editor();
  await opened();
  await userEvent.click(button("Choose photos"));
  await expect.poll(() => host.querySelector("dialog[open]")?.textContent).toContain("No published photos yet.");
  offline(true);
  try {
    await expect.poll(() => button("Choose photos", host).disabled).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(byId("home-photos-title"));
  } finally {
    offline(false);
  }
});

test("O2: a Home read still in flight when the owner leaves the dashboard never fills the card later", async () => {
  let answer: (r: Reply) => void = () => {};
  serve({
    "/api/owner/page": [ok({ page: { ...PAGE, setup_completed: true }, drafts: DRAFTS })],
    [GET]: [read(SAVED), new Promise<Reply>((resolve) => (answer = resolve)), read(SAVED), new Promise<Reply>(() => {})],
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(createElement(Owner));
  await expect.poll(() => host.querySelector("#home-action")).not.toBeNull();
  offline(true); // reconnecting reads Home again: that read is held
  await expect.poll(() => region("status")).toContain("You’re offline.");
  offline(false);
  await expect.poll(() => posted(GET)).toHaveLength(2);
  await userEvent.click(byId("home-action"));
  await opened();
  // The old read answers while the editor is open (the Home as it was before editing).
  answer(read({ ...SAVED, status: "draft", published: null }));
  await new Promise((r) => setTimeout(r, 50));
  await userEvent.click(button("Back"));
  await expect.poll(() => posted(GET)).toHaveLength(4);
  expect(host.querySelector("#home-action")).toBeNull(); // still loading: the old read was dropped
  expect(text()).not.toContain("Draft · not published yet");
});
