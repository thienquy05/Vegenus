import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { Item as Data, Row } from "@/lib/content";
import { Content } from "./content";
import { Item } from "./item";

// O4 content list and O5 item editor in a real browser (owner UI "O4 Content list and O5 Item editor"; Q140; E15).
// fetch is replaced: each route answers from a queue, and every request is kept. Placeholder data only.
const A = "00000000-0000-0000-0000-0000000000a1";
const B = "00000000-0000-0000-0000-0000000000a2";
const P1 = "00000000-0000-0000-0000-0000000000c1";
const ROWS: Row[] = [
  { id: A, kind: "memory", status: "published", lang: "vi", title: "Chuyến đi biển", event_date: "2024-06-01", date_precision: "month", unpublished_changes: true, version: 4 },
  { id: B, kind: "memory", status: "draft", lang: "vi", title: "Draft title", event_date: "2023-01-01", date_precision: "year", unpublished_changes: false, version: 1 },
];
const TOGETHER: Row[] = [
  { id: B, kind: "anniversary", status: "draft", lang: "en", title: "First date", event_date: "2020-02-29", date_precision: "day", unpublished_changes: false, version: 2 },
];
const ITEM: Data = {
  id: A, version: 4, kind: "memory", status: "published", lang: "vi", title: "Chuyến đi biển", body: "Biển", lang_alt: null,
  title_alt: null, body_alt: null, event_date: "2024-06-01", date_precision: "month", recurs_yearly: false, remind_owner: false,
  published: { lang: "vi", title: "Chuyến đi", body: "Biển", lang_alt: null, title_alt: null, body_alt: null, event_date: "2024-06-01", date_precision: "month", recurs_yearly: false },
  media: [{ id: P1, kind: "photo", position: 0, width: 4, height: 3, duration_ms: null, alt: "Bãi biển", alt_alt: null, preview_url: null }],
};

type Reply = { status: number; body?: unknown } | "network";
let calls: { url: string; body: Record<string, unknown> | null }[] = [];
// A reply may be a promise, to hold a request open.
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

let root: Root | null = null;
let host: HTMLElement;
function mount(element: ReturnType<typeof createElement>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(element);
}
afterEach(() => {
  root?.unmount();
  root = null;
  host.remove();
  vi.unstubAllGlobals();
});

const text = () => host.textContent ?? "";
function offline(on: boolean) {
  if (on) Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  else delete (navigator as { onLine?: boolean }).onLine;
  dispatchEvent(new Event(on ? "offline" : "online"));
}
const region = (role: string) => host.querySelector(`[role="${role}"]`)?.textContent ?? "";
const byId = <T extends HTMLElement = HTMLInputElement>(id: string) => host.querySelector<T>(`#${CSS.escape(id)}`)!;
// The first button whose visible text holds `label`; inside an open dialog when one is open.
const button = (label: string, scope: ParentNode = host.querySelector("dialog[open]") ?? host) =>
  [...scope.querySelectorAll("button")].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;


const list = (props: Partial<Parameters<typeof Content>[0]> = {}) => {
  const onOpen = vi.fn();
  const onSignedOut = vi.fn();
  mount(createElement(Content, { initialSection: "memories", onBack: vi.fn(), onOpen, onSignedOut, ...props }));
  return { onOpen, onSignedOut };
};
const editor = (props: Partial<Parameters<typeof Item>[0]> = {}) => {
  const onBack = vi.fn();
  const onSignedOut = vi.fn();
  mount(createElement(Item, { id: A, kind: "memory", lang: "vi", onBack, onSignedOut, ...props }));
  return { onBack, onSignedOut };
};

// O4

test("the list reads one section and shows each row's status, changes, title and date at its precision", async () => {
  serve({ "/api/owner/items": [ok({ items: ROWS }), ok({ items: TOGETHER })] });
  list();
  await expect.poll(() => host.querySelectorAll("article").length).toBe(2);
  expect(calls[0]).toEqual({ url: "/api/owner/items", body: { section: "memories" } });
  const [first, second] = host.querySelectorAll("article");
  expect(first.textContent).toContain("Published");
  expect(first.textContent).toContain("Unpublished changes");
  expect(first.querySelector("h3")?.textContent).toBe("Chuyến đi biển");
  expect(first.querySelector("h3 [lang]")).toBeNull(); // user content is never marked English
  expect(first.textContent).toContain("2024-06");
  expect(first.textContent).not.toContain("2024-06-01");
  expect(second.textContent).toContain("Draft");
  expect(second.textContent).toContain("2023");
  expect(text()).toContain("By date, newest first");
  expect(byId("memories").getAttribute("aria-pressed")).toBe("true");
  // Open and Publish name their row for screen readers.
  expect(button("Open", first).textContent).toContain("Chuyến đi biển");

  await userEvent.click(byId("together"));
  await expect.poll(() => text()).toContain("First date");
  expect(calls[1].body).toEqual({ section: "together" });
  expect(text()).toContain("By date, oldest first");
  expect(host.querySelector("article")?.textContent).toContain("Anniversary");
});

test("a failed read is never shown as empty, and Try again reads again", async () => {
  serve({ "/api/owner/items": [{ status: 503 }, ok({ items: [] })] });
  list();
  await expect.poll(() => text()).toContain("Couldn’t load this. Try again.");
  expect(text()).not.toContain("No items in this section yet.");
  await userEvent.click(button("Try again"));
  await expect.poll(() => text()).toContain("No items in this section yet.");
});

test("an empty section offers its first item, in the section's kind", async () => {
  serve({ "/api/owner/items": [ok({ items: [] }), ok({ items: [] })] });
  const { onOpen } = list();
  await expect.poll(() => text()).toContain("Add your first memory");
  await userEvent.click(button("Add your first memory"));
  expect(onOpen).toHaveBeenLastCalledWith({ id: null, kind: "memory", section: "memories" });
  await userEvent.click(byId("together"));
  await expect.poll(() => text()).toContain("Add your first moment together");
  await userEvent.click(button("New item"));
  expect(onOpen).toHaveBeenLastCalledWith({ id: null, kind: "milestone", section: "together" });
});

test("Open hands the row's id to the editor", async () => {
  serve({ "/api/owner/items": [ok({ items: ROWS })] });
  const { onOpen } = list();
  await expect.poll(() => host.querySelectorAll("article").length).toBe(2);
  await userEvent.click(button("Open", host.querySelectorAll("article")[1]));
  expect(onOpen).toHaveBeenCalledWith({ id: B, kind: "memory", section: "memories" });
});

test("Publish from the list changes the badge only after the server confirms", async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  serve({ "/api/owner/items": [ok({ items: ROWS })], "/api/owner/item/status": [ok({ version: 2 })] });
  const original = globalThis.fetch;
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url === "/api/owner/item/status") await held;
    return original(url, init);
  });
  list();
  await expect.poll(() => host.querySelectorAll("article").length).toBe(2);
  const draft = host.querySelectorAll("article")[1];
  await userEvent.click(button("Publish", draft));
  await expect.poll(() => region("status")).toContain("Updating status…");
  expect(draft.textContent).toContain("Draft");
  release();
  await expect.poll(() => region("status")).toContain("Status updated.");
  expect(calls.at(-1)).toEqual({ url: "/api/owner/item/status", body: { id: B, expected_version: 1, status: "published" } });
  expect(host.querySelectorAll("article")[1].textContent).toContain("Published");
  expect(button("Unpublish", host.querySelectorAll("article")[1])).toBeTruthy();
  // The button was disabled while the change ran; focus comes back to it rather than falling to the page.
  expect(document.activeElement).toBe(button("Unpublish", host.querySelectorAll("article")[1]));
});

test("Unpublish from the list asks first; Cancel sends nothing", async () => {
  serve({ "/api/owner/items": [ok({ items: ROWS })], "/api/owner/item/status": [ok({ version: 5 })] });
  list();
  await expect.poll(() => host.querySelectorAll("article").length).toBe(2);
  await userEvent.click(button("Unpublish", host.querySelector("article")!));
  expect(host.querySelector("dialog[open]")?.textContent).toContain("Unpublish this item?");
  await userEvent.click(button("Cancel"));
  expect(host.querySelector("dialog[open]")).toBeNull();
  expect(calls).toHaveLength(1);
  await userEvent.click(button("Unpublish", host.querySelector("article")!));
  await userEvent.click(button("Unpublish"));
  await expect.poll(() => host.querySelector("article")?.textContent).toContain("Draft");
  expect(calls.at(-1)?.body).toEqual({ id: A, expected_version: 4, status: "draft" });
});

test("a 409 re-reads the list and never says which change happened", async () => {
  serve({ "/api/owner/items": [ok({ items: ROWS }), ok({ items: ROWS.slice(0, 1) })], "/api/owner/item/status": [{ status: 409 }] });
  list();
  await expect.poll(() => host.querySelectorAll("article").length).toBe(2);
  await userEvent.click(button("Publish", host.querySelectorAll("article")[1]));
  await expect.poll(() => host.querySelectorAll("article").length).toBe(1);
  expect(region("alert")).toContain("This item changed elsewhere. The list has been refreshed.");  // The clicked row is gone after the re-read; focus goes to the page heading rather than falling to the page.
  expect(document.activeElement).toBe(host.querySelector("h1"));
});

test("access lost offers only Log out; signed out goes to sign-in", async () => {
  serve({ "/api/owner/items": [{ status: 403 }] });
  list();
  await expect.poll(() => text()).toContain("Access is no longer available.");
  expect(button("New item")).toBeUndefined();
  expect(button("Log out")).toBeTruthy();
  root?.unmount();
  host.remove();
  serve({ "/api/owner/items": [{ status: 401 }] });
  const { onSignedOut } = list();
  await expect.poll(() => onSignedOut.mock.calls.length).toBe(1);
});

test("offline keeps the last confirmed list, says it may be out of date and blocks actions", async () => {
  serve({ "/api/owner/items": [ok({ items: ROWS })] });
  list();
  await expect.poll(() => host.querySelectorAll("article").length).toBe(2);
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  try {
    dispatchEvent(new Event("offline"));
    await expect.poll(() => text()).toContain("This list may be out of date.");
    expect(host.querySelectorAll("article")).toHaveLength(2);
    expect(button("Publish", host.querySelectorAll("article")[1]).disabled).toBe(true);
    expect(button("New item").disabled).toBe(true);
    // Switching section or opening an item would need a read that cannot happen, and would lose the last list.
    expect(button("Together").disabled).toBe(true);
    expect(button("Open", host.querySelectorAll("article")[1]).disabled).toBe(true);
  } finally {
    delete (navigator as { onLine?: boolean }).onLine;
    dispatchEvent(new Event("online"));
  }
});

// O5

test("a new memory: kind Memory only, no Delete or Unpublish, and media waits for the first save", async () => {
  serve({});
  editor({ id: null });
  await expect.poll(() => host.querySelector("#kind-memory")).toBeTruthy();
  expect(byId("kind-memory").checked).toBe(true);
  expect(host.querySelector("#kind-milestone")).toBeNull();
  expect(byId("mainLanguage-vi").checked).toBe(true);
  expect(text()).toContain("Save the draft first to add photos");
  expect(button("Delete")).toBeUndefined();
  expect(button("Unpublish")).toBeUndefined();
  expect(button("Save draft").disabled).toBe(false);
  expect(calls).toHaveLength(0);
});

test("a new Together item offers Milestone and Anniversary, and Anniversary is always day precision", async () => {
  serve({});
  editor({ id: null, kind: "milestone" });
  await expect.poll(() => host.querySelector("#kind-milestone")).toBeTruthy();
  expect(host.querySelector("#kind-memory")).toBeNull();
  expect(byId("kind-milestone").checked).toBe(true);
  expect(byId("precision-month").disabled).toBe(false);
  await userEvent.click(byId("kind-anniversary"));
  expect(byId("precision-day").checked).toBe(true);
  expect(byId("precision-month").disabled).toBe(true);
  expect(byId("repeat")).toBeTruthy();
  expect(byId("remind")).toBeTruthy();
  await userEvent.fill(byId("month"), "2");
  await userEvent.fill(byId("day"), "29");
  expect(text()).toContain("In non-leap years, 29 Feb appears on 28 Feb.");
});

test("invalid input sends nothing: one summary, each error on its control, focus on the first", async () => {
  serve({});
  editor({ id: null });
  await expect.poll(() => host.querySelector("#text")).toBeTruthy();
  await userEvent.fill(byId("text"), "x".repeat(5001));
  // What a screen reader reads when focus lands: the control must already be marked invalid, with its message.
  let heard = "";
  byId("title").addEventListener("focus", () => (heard = `${byId("title").getAttribute("aria-invalid")} ${byId("title-error").textContent}`), { once: true });
  await userEvent.click(button("Save draft"));
  expect(heard).toMatch(/^true .*Enter a title/);
  expect(calls).toHaveLength(0);
  expect(text()).toContain("Check the highlighted fields before saving.");
  for (const id of ["title", "text", "year", "month", "day"]) expect(byId(id).getAttribute("aria-invalid"), id).toBe("true");
  expect(document.activeElement).toBe(byId("title"));
  expect(byId("title-error").textContent).toContain("Enter a title of 1–120 characters.");
  expect(byId("text-error").textContent).toContain("Use no more than 5,000 characters.");
  // Each summary link names its field, so two "Enter a title" errors are told apart.
  const links = [...host.querySelectorAll("#error-summary a")].map((a) => a.textContent);
  expect(links[0]).toMatch(/^Title \/ Tiêu đề: /);
  expect(links[1]).toMatch(/^Text \/ Nội dung chữ: /);
  // A summary link moves focus to its control.
  await userEvent.click([...host.querySelectorAll("#error-summary a")].find((a) => a.textContent?.includes("5,000"))!);
  expect(document.activeElement).toBe(byId("text"));
});

test("saving a new draft sends its id once, then the editor holds the saved version", async () => {
  serve({ "/api/owner/item": [ok({ id: "x", version: 1 })] });
  editor({ id: null });
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  await userEvent.fill(byId("title"), "  Tên mới ");
  await userEvent.fill(byId("year"), "2024");
  await userEvent.fill(byId("month"), "5");
  await userEvent.fill(byId("day"), "12");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("status")).toContain("Draft saved.");
  const body = calls[0].body!;
  expect(body).toMatchObject({ expected_version: null, kind: "memory", lang: "vi", title: "Tên mới", event_date: "2024-05-12", date_precision: "day", alts: null });
  expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(byId("kind-memory").disabled).toBe(true);
  expect(button("Save draft").disabled).toBe(true);
  expect(button("Delete")).toBeTruthy();
  expect(text()).toContain("No media yet.");
  expect(text()).toContain("Draft");
});

test("an existing item loads with its media and alt text; Publish saves edits first, then publishes", async () => {
  serve({
    "/api/owner/item/get": [ok({ item: ITEM })],
    "/api/owner/item": [ok({ id: A, version: 5 })],
    "/api/owner/item/status": [ok({ version: 6 })],
  });
  editor();
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  expect(calls[0]).toEqual({ url: "/api/owner/item/get", body: { id: A } });
  expect(byId("title").value).toBe("Chuyến đi biển");
  expect(byId("precision-month").checked).toBe(true);
  expect(host.querySelector("#day")).toBeNull();
  expect(text()).toContain("Unpublished changes: guests still see the last published version");
  expect(byId<HTMLTextAreaElement>(`alt-${P1}-vi`).value).toBe("Bãi biển");
  expect(button("Save draft").disabled).toBe(true);
  expect(button("Publish").disabled).toBe(false); // unpublished changes can be published without an edit

  await userEvent.fill(byId(`alt-${P1}-vi`), "Biển xanh");
  await userEvent.click(button("Publish"));
  await expect.poll(() => region("status")).toContain("Published.");
  expect(calls.map((c) => c.url)).toEqual(["/api/owner/item/get", "/api/owner/item", "/api/owner/item/status"]);
  expect(calls[1].body).toMatchObject({ expected_version: 4, alts: [{ id: P1, alt: "Biển xanh", alt_alt: "" }] });
  expect(calls[2].body).toEqual({ id: A, expected_version: 5, status: "published" });
  expect(text()).not.toContain("Unpublished changes: guests");
  expect(button("Publish").disabled).toBe(true);
});

test("a 409 re-reads the item: Keep mine keeps the input and saves over the new version; Reload saved takes the saved one", async () => {
  const newer = { ...ITEM, version: 7, title: "Edited elsewhere" };
  serve({
    "/api/owner/item/get": [ok({ item: ITEM }), ok({ item: newer }), ok({ item: { ...newer, version: 9 } })],
    "/api/owner/item": [{ status: 409 }, ok({ id: A, version: 8 }), { status: 409 }],
  });
  editor();
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  await userEvent.fill(byId("title"), "Mine");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => text()).toContain("This item changed elsewhere");
  expect(text()).toContain("Edited elsewhere"); // the re-read saved version is shown
  expect(byId("title").value).toBe("Mine");
  await userEvent.click(button("Keep mine"));
  expect(text()).not.toContain("This item changed elsewhere");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("status")).toContain("Draft saved.");
  expect(calls.at(-1)?.body).toMatchObject({ expected_version: 7, title: "Mine" });

  await userEvent.fill(byId("title"), "Mine again");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => button("Reload saved")).toBeTruthy();
  await userEvent.click(button("Reload saved"));
  expect(byId("title").value).toBe("Edited elsewhere");
  expect(button("Save draft").disabled).toBe(true);
});

test("not found reads the same whatever the reason, with Back", async () => {
  serve({ "/api/owner/item/get": [{ status: 404 }] });
  const { onBack } = editor();
  await expect.poll(() => text()).toContain("This item is no longer available");
  expect(host.querySelector("form")).toBeNull();
  await userEvent.click(button("Back"));
  expect(onBack).toHaveBeenCalled();
});

test("a failed save keeps the input: 503 offers Try again, 400 one generic message, 401 Sign in again", async () => {
  serve({
    "/api/owner/item/get": [ok({ item: ITEM })],
    "/api/owner/item": [{ status: 503 }, ok({ id: A, version: 5 }), { status: 400 }, { status: 401 }, ok({ id: A, version: 6 })],
  });
  const { onSignedOut } = editor();
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  await userEvent.fill(byId("title"), "Kept");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => text()).toContain("Not saved. Your changes are still here.");
  expect(byId("title").value).toBe("Kept");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("status")).toContain("Draft saved.");
  await userEvent.fill(byId("title"), "Again");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => text()).toContain("Couldn’t save this. Review your input before saving again.");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => text()).toContain("Sign in again. Your input is kept here.");
  expect(byId("title").value).toBe("Again");
  // Sign-in opens in a new tab, so this one keeps the input; back here, Try again saves it.
  const signin = [...host.querySelectorAll("a")].find((a) => a.textContent?.includes("Sign in again"))!;
  expect(signin.getAttribute("href")).toBe("/login?next=%2Fapp");
  expect(signin.target).toBe("_blank");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("status")).toContain("Draft saved.");
  expect(calls.at(-1)?.body).toMatchObject({ expected_version: 5, title: "Again" });
  expect(onSignedOut).not.toHaveBeenCalled();
});

test("a second language preselects the other one, warns what removing it drops, and sends nothing for it when off", async () => {
  serve({ "/api/owner/item/get": [ok({ item: ITEM })], "/api/owner/item": [ok({ id: A, version: 5 })] });
  editor();
  await expect.poll(() => host.querySelector("#second")).toBeTruthy();
  expect(host.querySelector(`#alt-${P1}-en`)).toBeNull();
  await userEvent.click(byId("second"));
  expect(byId("language-en").checked).toBe(true);
  expect(byId(`alt-${P1}-en`)).toBeTruthy();
  expect(text()).toContain("Removing the second language also removes its photo alt text from the saved item.");
  await userEvent.fill(byId("secondTitle"), "The trip");
  await userEvent.fill(byId("secondText"), "Sea");
  await userEvent.click(byId("second"));
  await userEvent.fill(byId("title"), "Edited");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1].body).toMatchObject({ lang_alt: null, title_alt: null, body_alt: null });
});

test("Delete asks first, then returns to the list with the result", async () => {
  serve({ "/api/owner/item/get": [ok({ item: ITEM })], "/api/owner/item/delete": [ok()] });
  const { onBack } = editor();
  await expect.poll(() => button("Delete")).toBeTruthy();
  await userEvent.click(button("Delete"));
  expect(host.querySelector("dialog[open]")?.textContent).toContain("The item and its photos and video will be deleted.");
  await userEvent.click(button("Delete"));
  await expect.poll(() => onBack.mock.calls.length).toBe(1);
  expect(onBack).toHaveBeenCalledWith("content.deleted");
  expect(calls.at(-1)).toEqual({ url: "/api/owner/item/delete", body: { id: A, expected_version: 4 } });
});

test("Remove asks first, says space is freed after cleanup, and drops the file", async () => {
  serve({ "/api/owner/item/get": [ok({ item: ITEM })], "/api/owner/upload/delete": [ok()] });
  editor();
  await expect.poll(() => button("Remove")).toBeTruthy();
  await userEvent.click(button("Remove"));
  const dialog = host.querySelector("dialog[open]")!;
  expect(dialog.textContent).toContain("Remove this file?");
  expect(dialog.textContent).toContain("Space is freed after cleanup.");
  await userEvent.click(button("Remove"));
  await expect.poll(() => region("status")).toContain("File removed.");
  expect(calls.at(-1)).toEqual({ url: "/api/owner/upload/delete", body: { media_id: P1 } });
  expect(host.querySelector(`#alt-${P1}-vi`)).toBeNull();
  expect(text()).toContain("No media yet.");
  expect(document.activeElement).toBe(host.querySelector("h1")); // the removed row took its button with it
});

test("Back with unsaved changes asks; Esc keeps writing, Discard leaves", async () => {
  serve({ "/api/owner/item/get": [ok({ item: ITEM })] });
  const { onBack } = editor();
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  await userEvent.click(button("Back"));
  expect(onBack).toHaveBeenCalledTimes(1); // nothing unsaved: leaves at once
  await userEvent.fill(byId("title"), "Unsaved");
  await userEvent.click(button("Back"));
  expect(host.querySelector("dialog[open]")?.textContent).toContain("Leave without saving?");
  await userEvent.keyboard("{Escape}");
  expect(host.querySelector("dialog[open]")).toBeNull();
  expect(byId("title").value).toBe("Unsaved");
  await userEvent.click(button("Back"));
  await userEvent.click(button("Discard"));
  expect(onBack).toHaveBeenCalledTimes(2);
});

test("making the second language the main one swaps the two languages' title, text and alt text (Q141)", async () => {
  const both = { ...ITEM, lang_alt: "en" as const, title_alt: "The trip", body_alt: "Sea", published: null, status: "draft" as const,
    media: [{ ...ITEM.media[0], alt: "Bãi biển", alt_alt: "Beach" }] };
  serve({ "/api/owner/item/get": [ok({ item: both })], "/api/owner/item": [ok({ id: A, version: 5 })] });
  editor();
  await expect.poll(() => host.querySelector("#mainLanguage-en")).toBeTruthy();
  await userEvent.click(byId("mainLanguage-en"));
  expect(byId("language-vi").checked).toBe(true);
  expect(byId("title").value).toBe("The trip");
  expect(byId("secondTitle").value).toBe("Chuyến đi biển");
  expect(byId<HTMLTextAreaElement>(`alt-${P1}-en`).value).toBe("Beach");
  expect(byId<HTMLTextAreaElement>(`alt-${P1}-vi`).value).toBe("Bãi biển");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1].body).toMatchObject({ lang: "en", title: "The trip", body: "Sea", lang_alt: "vi", title_alt: "Chuyến đi biển", body_alt: "Biển",
    alts: [{ id: P1, alt: "Beach", alt_alt: "Bãi biển" }] });
});

// Review fixes (2026-11-20)

test("Try again repeats the action with what is on screen now, not what was there at the first click", async () => {
  serve({
    "/api/owner/item/get": [ok({ item: ITEM })],
    "/api/owner/item": [ok({ id: A, version: 5 }), { status: 503 }, ok({ id: A, version: 7 }), { status: 503 }, ok({ id: A, version: 8 })],
    "/api/owner/item/status": [{ status: 503 }, ok({ version: 6 }), ok({ version: 9 })],
  });
  editor();
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  // The save inside Publish went through; Try again only publishes, from the saved version (no false conflict).
  await userEvent.fill(byId("title"), "Edited");
  await userEvent.click(button("Publish"));
  await expect.poll(() => text()).toContain("Not saved. Your changes are still here.");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("status")).toContain("Published.");
  expect(calls.map((c) => c.url)).toEqual(["/api/owner/item/get", "/api/owner/item", "/api/owner/item/status", "/api/owner/item/status"]);
  expect(calls[3].body).toEqual({ id: A, expected_version: 5, status: "published" });
  // A failed save retried after more typing saves the newer text.
  await userEvent.fill(byId("title"), "First");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => text()).toContain("Not saved. Your changes are still here.");
  await userEvent.fill(byId("title"), "Second");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("status")).toContain("Draft saved.");
  expect(calls.at(-1)?.body).toMatchObject({ expected_version: 6, title: "Second" });
  // When the save inside Publish fails, Try again still publishes.
  await userEvent.fill(byId("title"), "Third");
  await userEvent.click(button("Publish"));
  await expect.poll(() => text()).toContain("Not saved. Your changes are still here.");
  await userEvent.click(button("Try again"));
  await expect.poll(() => region("status")).toContain("Published.");
  expect(calls.at(-1)).toEqual({ url: "/api/owner/item/status", body: { id: A, expected_version: 8, status: "published" } });
});

test("a write in progress says so on screen, not only to screen readers", async () => {
  let answer!: (reply: Reply) => void;
  serve({ "/api/owner/item/get": [ok({ item: ITEM })], "/api/owner/item": [new Promise<Reply>((resolve) => (answer = resolve))] });
  editor();
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  await userEvent.fill(byId("title"), "Slow");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => text().split("Saving…").length - 1).toBe(2); // the live region and the visible notice
  answer(ok({ id: A, version: 5 }));
  await expect.poll(() => region("status")).toContain("Draft saved.");
  root?.unmount();
  host.remove();

  let release!: (reply: Reply) => void;
  serve({ "/api/owner/items": [ok({ items: ROWS })], "/api/owner/item/status": [new Promise<Reply>((resolve) => (release = resolve))] });
  list();
  await expect.poll(() => host.querySelectorAll("article").length).toBe(2);
  await userEvent.click(button("Publish", host.querySelectorAll("article")[1]));
  await expect.poll(() => text().split("Updating status…").length - 1).toBe(2);
  release(ok({ version: 2 }));
  await expect.poll(() => region("status")).toContain("Status updated.");
});

test("a 409 whose re-read finds no item keeps the input on screen and blocks writing", async () => {
  serve({ "/api/owner/item/get": [ok({ item: ITEM }), { status: 404 }], "/api/owner/item": [{ status: 409 }] });
  const { onBack } = editor();
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  await userEvent.fill(byId("title"), "Mine");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => text()).toContain("This item is no longer available");
  expect(byId("title").value).toBe("Mine"); // still there to copy
  expect(button("Save draft").disabled).toBe(true);
  expect(button("Publish").disabled).toBe(true);
  expect(document.activeElement?.textContent).toContain("This item is no longer available");
  await userEvent.click(button("Back"));
  expect(host.querySelector("dialog[open]")?.textContent).toContain("Leave without saving?");
  await userEvent.click(button("Discard"));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("closing or reloading the tab with unsaved changes asks the browser to confirm", async () => {
  serve({ "/api/owner/item/get": [ok({ item: ITEM })] });
  editor();
  const leave = () => {
    const event = new Event("beforeunload", { cancelable: true });
    dispatchEvent(event);
    return event.defaultPrevented;
  };
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  expect(leave()).toBe(false);
  await userEvent.fill(byId("title"), "Unsaved");
  expect(leave()).toBe(true);
});

test("a result from the editor is announced once the list is on screen", async () => {
  serve({ "/api/owner/items": [ok({ items: ROWS })] });
  // A live region inserted with its text already in it is often not read: the text must arrive after the region.
  const spoken: string[] = [];
  const watch = new MutationObserver((changes) =>
    changes.forEach((change) => (change.target as Element).closest?.('[role="status"]') && spoken.push(change.target.textContent ?? "")),
  );
  watch.observe(document.body, { childList: true, subtree: true });
  try {
    list({ status: "content.deleted" });
    await expect.poll(() => spoken.join(" ")).toContain("Item deleted.");
    expect(text()).toContain("Item deleted.");
  } finally {
    watch.disconnect();
  }
});

test("Unpublish in the editor asks first; afterwards focus is on the page heading, not lost", async () => {
  serve({ "/api/owner/item/get": [ok({ item: ITEM })], "/api/owner/item/status": [ok({ version: 5 })] });
  editor();
  await expect.poll(() => button("Unpublish")).toBeTruthy();
  await userEvent.click(button("Unpublish"));
  expect(host.querySelector("dialog[open]")?.textContent).toContain("Unpublish this item?");
  await userEvent.click(button("Unpublish"));
  await expect.poll(() => region("status")).toContain("Unpublished.");
  expect(calls.at(-1)).toEqual({ url: "/api/owner/item/status", body: { id: A, expected_version: 4, status: "draft" } });
  expect(button("Unpublish")).toBeUndefined();
  expect(document.activeElement).toBe(host.querySelector("h1"));
});

test("coming back online does not repeat an earlier result", async () => {
  serve({ "/api/owner/item/get": [ok({ item: ITEM })], "/api/owner/item": [ok({ id: A, version: 5 })] });
  editor();
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  await userEvent.fill(byId("title"), "Saved");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("status")).toContain("Draft saved.");
  try {
    offline(true);
    await expect.poll(() => region("status")).toContain("You’re offline.");
  } finally {
    offline(false);
  }
  await expect.poll(() => region("status")).toBe("");
  root?.unmount();
  host.remove();

  serve({ "/api/owner/items": [ok({ items: ROWS })], "/api/owner/item/status": [ok({ version: 2 })] });
  list();
  await expect.poll(() => host.querySelectorAll("article").length).toBe(2);
  await userEvent.click(button("Publish", host.querySelectorAll("article")[1]));
  await expect.poll(() => region("status")).toContain("Status updated.");
  try {
    offline(true);
    await expect.poll(() => region("status")).toContain("You’re offline.");
  } finally {
    offline(false);
  }
  await expect.poll(() => region("status")).toBe("");
});

test("Keep mine keeps the alt text of a photo only the saved version has", async () => {
  const P2 = "00000000-0000-0000-0000-0000000000c2";
  const newer = { ...ITEM, version: 7, media: [...ITEM.media, { ...ITEM.media[0], id: P2, position: 1, alt: "Hoa", alt_alt: null }] };
  serve({ "/api/owner/item/get": [ok({ item: ITEM }), ok({ item: newer })], "/api/owner/item": [{ status: 409 }] });
  editor();
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  await userEvent.fill(byId("title"), "Mine");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => button("Keep mine")).toBeTruthy();
  await userEvent.click(button("Keep mine"));
  expect(byId<HTMLTextAreaElement>(`alt-${P2}-vi`).value).toBe("Hoa");
  expect(byId("title").value).toBe("Mine");
});

test("after a 409 the list says it was refreshed only when the new read succeeds", async () => {
  serve({ "/api/owner/items": [ok({ items: ROWS }), { status: 503 }], "/api/owner/item/status": [{ status: 409 }] });
  list();
  await expect.poll(() => host.querySelectorAll("article").length).toBe(2);
  await userEvent.click(button("Publish", host.querySelectorAll("article")[1]));
  await expect.poll(() => text()).toContain("Couldn’t load this. Try again.");
  expect(region("alert")).not.toContain("The list has been refreshed.");
});

test("a 409 re-read cut short by a section switch does not report a refresh in the other section", async () => {
  let release!: (reply: Reply) => void;
  serve({
    "/api/owner/items": [ok({ items: ROWS }), new Promise<Reply>((resolve) => (release = resolve)), ok({ items: TOGETHER })],
    "/api/owner/item/status": [{ status: 409 }],
  });
  list();
  await expect.poll(() => host.querySelectorAll("article").length).toBe(2);
  await userEvent.click(button("Publish", host.querySelectorAll("article")[1]));
  await expect.poll(() => calls.length).toBe(3); // the re-read is in flight
  await userEvent.click(button("Together"));
  await expect.poll(() => text()).toContain("First date");
  expect(region("alert")).not.toContain("The list has been refreshed.");
  release(ok({ items: ROWS }));
});

test("Keep mine does not send alt text for a photo the saved version no longer has", async () => {
  const newer = { ...ITEM, version: 7, media: [] };
  serve({ "/api/owner/item/get": [ok({ item: ITEM }), ok({ item: newer })], "/api/owner/item": [{ status: 409 }, ok({ id: A, version: 8 })] });
  editor();
  await expect.poll(() => host.querySelector("#title")).toBeTruthy();
  await userEvent.fill(byId("title"), "Mine");
  await userEvent.fill(byId(`alt-${P1}-vi`), "Gone");
  await userEvent.click(button("Save draft"));
  await expect.poll(() => button("Keep mine")).toBeTruthy();
  await userEvent.click(button("Keep mine"));
  await userEvent.click(button("Save draft"));
  await expect.poll(() => region("status")).toContain("Draft saved.");
  expect(calls.at(-1)?.body).toMatchObject({ expected_version: 7, title: "Mine", alts: null });
});
