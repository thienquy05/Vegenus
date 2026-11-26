import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import Owner from "./owner";

vi.mock("next/navigation", () => {
  const router = { push: () => {} };
  const useRouter = () => router;
  return { useRouter, default: { useRouter } };
});

// O19 Page settings and the O2 Settings card in a real browser (owner UI "O19 Page settings"; PRD Q115;
// `.design/settings/CHECKS.md`). fetch answers each route from a queue and records the bodies sent. Placeholder data.
const PAGE = {
  version: 2, theme: "a_dreamy" as string | null, default_lang: "en", label_a: "[PARTNER_A]", label_b: "[PARTNER_B]",
  timezone: "Asia/Ho_Chi_Minh", visibility: "token_only", setup_completed: true, sections: ["home", "memories"],
  link: null, storage_used_bytes: 0, storage_budget_bytes: 1000,
};
type Fields = Partial<typeof PAGE>;
const snapshot = (fields: Fields = {}) => ({ ...PAGE, ...fields });
const page = (fields: Fields = {}) => ok({ page: snapshot(fields), drafts: null });
const saved = (fields: Fields = {}) => ok({ page: snapshot(fields) });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Reply = { status: number; body?: unknown } | "network";
let sent: { url: string; body: Record<string, unknown> }[] = [];
let routes: Record<string, (Reply | Promise<Reply>)[]> = {};
function serve(more: Record<string, (Reply | Promise<Reply>)[]>) {
  sent = [];
  routes = { "/api/owner/usage": [], ...more };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      sent.push({ url, body: init?.body ? JSON.parse(String(init.body)) : {} });
      const reply = await (url === "/api/owner/home/get" ? (routes[url]?.shift() ?? ok({ home: null })) : routes[url]?.shift());
      if (!reply || reply === "network") throw new TypeError(`no answer for ${url}`);
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status });
    }),
  );
}
const ok = (body: unknown): Reply => ({ status: 200, body });
const to = (url: string) => sent.filter((c) => c.url === url);
function later() {
  let release!: (reply: Reply) => void;
  const reply = new Promise<Reply>((resolve) => (release = resolve));
  return { reply, release };
}

let root: Root | null = null;
let host: HTMLElement;
afterEach(() => {
  root?.unmount();
  root = null;
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (navigator as { onLine?: boolean }).onLine;
});
function owner() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(createElement(Owner));
}
const status = () => host.querySelector('[role="status"]')?.textContent ?? "";
const byId = <T extends HTMLElement = HTMLElement>(id: string) => host.querySelector<T>(`#${CSS.escape(id)}`)!;
const has = (id: string) => !!host.querySelector(`#${CSS.escape(id)}`);
const shown = (id: string) => expect.poll(() => has(id)).toBe(true);
const focused = (id: string) => expect.poll(() => document.activeElement?.id).toBe(id);
const checked = (id: string) => byId<HTMLInputElement>(id).checked;
const value = (id: string) => byId<HTMLInputElement | HTMLSelectElement>(id).value;
const text = (id: string) => byId(id).textContent ?? "";
const described = (id: string) =>
  (byId(id).getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean).map((d) => byId(d)?.textContent ?? "").join(" ");
function offline(on: boolean) {
  if (on) Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  else delete (navigator as { onLine?: boolean }).onLine;
  dispatchEvent(new Event(on ? "offline" : "online"));
}
async function openSettings() {
  await shown("settings-change");
  await userEvent.click(byId("settings-change"));
  await expect.poll(() => has("save-names") || has("settings-retry") || has("settings-setup") || has("settings-signin")).toBe(true);
}
async function rename(id: string, name: string) {
  await userEvent.clear(byId(id));
  if (name) await userEvent.type(byId(id), name.replace(/[[{]/g, "$&$&")); // "[" and "{" start key names in type()
}

test("O2 Settings card: names, language, zone and theme with Change; O19 draws three panels from one read; Back returns focus", async () => {
  serve({ "/api/owner/page": [page(), page(), page()] });
  owner();
  await shown("settings-change");
  const card = text("settings-card");
  for (const part of ["[PARTNER_A]", "[PARTNER_B]", "English", "Asia/Ho_Chi_Minh", "A Dreamy"]) expect(card).toContain(part);
  expect(text("settings-change")).toContain("Change settings");
  await openSettings();
  await focused("settings-title");
  expect(text("settings-title")).toContain("Page settings");
  expect(value("settings-label_a")).toBe("[PARTNER_A]");
  expect(byId("settings-label_a").getAttribute("dir")).toBe("auto");
  expect(checked("settings-lang-en")).toBe(true);
  expect(value("settings-timezone")).toBe("Asia/Ho_Chi_Minh");
  expect(checked("settings-theme-a_dreamy")).toBe(true);
  expect(has("settings-theme-none")).toBe(true);
  for (const panel of ["names", "timezone", "theme"]) expect(byId(`save-${panel}`).getAttribute("aria-disabled")).toBe("true");
  expect(text("settings-zone-note")).toContain("Dates you entered stay as entered.");
  await userEvent.click(byId("settings-back"));
  await focused("settings-change");
  expect(to("/api/owner/settings")).toHaveLength(0);
});

test("a panel sends only its touched fields with the saved values they were edited against, then says Saved", async () => {
  serve({
    "/api/owner/page": [page(), page()],
    "/api/owner/settings": [saved({ label_b: "[PARTNER_C]", default_lang: "vi" })],
  });
  owner();
  await openSettings();
  await rename("settings-label_b", "  [PARTNER_C] ");
  await userEvent.click(byId("settings-lang-vi"));
  expect(text("names-status")).toContain("Changes not saved");
  expect(byId("save-timezone").getAttribute("aria-disabled")).toBe("true"); // the other panels stay clean
  await userEvent.click(byId("save-names"));
  await expect.poll(status).toContain("Saved / Đã lưu");
  expect(to("/api/owner/settings")[0].body).toEqual({
    panel: "names",
    base: { label_b: "[PARTNER_B]", default_lang: "en" },
    fields: { label_b: "[PARTNER_C]", default_lang: "vi" },
    request_id: expect.stringMatching(UUID),
  });
  expect(text("names-status")).not.toContain("Changes not saved");
  expect(byId("save-names").getAttribute("aria-disabled")).toBe("true");
});

test("a name the shared rule refuses shows its error on the field and sends nothing", async () => {
  serve({ "/api/owner/page": [page(), page()] });
  owner();
  await openSettings();
  await rename("settings-label_a", "");
  await userEvent.click(byId("save-names"));
  await focused("settings-label_a");
  expect(described("settings-label_a")).toContain("Enter a name.");
  expect(byId("settings-label_a").getAttribute("aria-invalid")).toBe("true");
  expect(to("/api/owner/settings")).toHaveLength(0);
});

test("the server's refusals land on their fields: names, zone and default language", async () => {
  serve({
    "/api/owner/page": [page(), page()],
    "/api/owner/settings": [
      { status: 400, body: { error: "invalid_name", fields: { label_a: "characters" } } },
      { status: 400, body: { error: "invalid_timezone" } },
      { status: 400, body: { error: "wording_incomplete" } },
    ],
  });
  owner();
  await openSettings();
  await rename("settings-label_a", "[PARTNER_X]");
  await userEvent.click(byId("save-names"));
  await focused("settings-label_a");
  expect(described("settings-label_a")).toContain("Remove control or bidirectional characters.");
  expect(value("settings-label_a")).toBe("[PARTNER_X]"); // the draft stays

  await userEvent.selectOptions(byId("settings-timezone"), "Europe/Paris");
  await userEvent.click(byId("save-timezone"));
  await focused("settings-timezone");
  expect(described("settings-timezone")).toContain("The server refused this time zone. Choose another time zone.");

  await rename("settings-label_a", "[PARTNER_A]");
  await userEvent.click(byId("settings-lang-vi"));
  await userEvent.click(byId("save-names"));
  await focused("settings-lang-vi");
  expect(described("settings-lang-vi")).toContain("Complete and publish the wording in this language");
  expect(checked("settings-lang-vi")).toBe(true);
});

test("No suggestion sends null; a reply showing another value says the save was superseded", async () => {
  serve({ "/api/owner/page": [page(), page()], "/api/owner/settings": [saved({ theme: "c_cozy" })] });
  owner();
  await openSettings();
  await userEvent.click(byId("settings-theme-none"));
  await userEvent.click(byId("save-theme"));
  await expect.poll(status).toContain("Your save went through, but these settings were changed again");
  expect(to("/api/owner/settings")[0].body).toMatchObject({ panel: "theme", base: { theme: "a_dreamy" }, fields: { theme: null } });
  expect(checked("settings-theme-c_cozy")).toBe(true);
});

test("a conflict offers Reload, which clears only that panel's edits and keeps another panel's draft", async () => {
  const reread = later();
  serve({
    "/api/owner/page": [page(), page(), reread.reply],
    "/api/owner/settings": [{ status: 409, body: { error: "conflict" } }],
  });
  owner();
  await openSettings();
  await userEvent.click(byId("settings-theme-d_elegant")); // the other panel's draft survives
  await rename("settings-label_a", "[PARTNER_X]");
  await userEvent.click(byId("save-names"));
  await focused("reload-names");
  expect(text("names-status")).toContain("This page changed in another tab or session.");
  expect(described("reload-names")).toContain("Reload clears unsaved changes in this panel.");
  expect(has("save-names")).toBe(false);
  await userEvent.click(byId("reload-names"));
  await expect.poll(() => text("reload-names")).toContain("Reloading the saved settings…");
  reread.release(page({ label_a: "[PARTNER_E]" }));
  await expect.poll(() => value("settings-label_a")).toBe("[PARTNER_E]");
  await expect.poll(status).toContain("Saved settings reloaded.");
  await focused("settings-label_a");
  expect(checked("settings-theme-d_elegant")).toBe(true);
  expect(text("theme-status")).toContain("Changes not saved");
});

test("an unconfirmed save locks the other panels' Save and Try again repeats the same request", async () => {
  const retried = later();
  serve({ "/api/owner/page": [page(), page()], "/api/owner/settings": ["network", retried.reply] });
  owner();
  await openSettings();
  await userEvent.selectOptions(byId("settings-timezone"), "Europe/Paris");
  await userEvent.click(byId("settings-theme-none"));
  await userEvent.click(byId("save-timezone"));
  await focused("retry-timezone");
  expect(text("timezone-status")).toContain("We couldn't confirm the save.");
  expect(byId("save-theme").getAttribute("aria-disabled")).toBe("true");
  expect(described("save-theme")).toContain("Wait for the other save to finish.");
  await userEvent.click(byId("retry-timezone"));
  retried.release(saved({ timezone: "Europe/Paris" }));
  await expect.poll(status).toContain("Saved / Đã lưu");
  const [first, second] = to("/api/owner/settings");
  expect(second.body).toEqual(first.body);
});

test("401 keeps the save and repeats it after signing in; 403 drops the drafts and offers Log out", async () => {
  serve({
    "/api/owner/page": [page(), page()],
    "/api/owner/settings": [{ status: 401 }, saved({ label_a: "[PARTNER_X]" }), { status: 403 }],
  });
  owner();
  await openSettings();
  await rename("settings-label_a", "[PARTNER_X]");
  await userEvent.click(byId("save-names"));
  await shown("settings-signin");
  expect(byId("settings-signin").getAttribute("href")).toBe("/login?next=%2Fapp");
  await userEvent.click(byId("retry-names"));
  await expect.poll(status).toContain("Saved / Đã lưu");
  await focused("save-names"); // the sign-in screen's Try again is gone (re-review 1)
  const [first, second] = to("/api/owner/settings");
  expect(second.body).toEqual(first.body);

  await userEvent.click(byId("settings-theme-none"));
  await userEvent.click(byId("save-theme"));
  await focused("settings-logout");
  expect(text("settings-error")).toContain("Access is no longer available.");
});

test("a page whose setup is not finished offers Open setup", async () => {
  serve({ "/api/owner/page": [page(), page({ setup_completed: false })] });
  owner();
  await openSettings();
  await focused("settings-setup");
  expect(text("settings-setup-message")).toContain("Finish setup first.");
});

test("a saved zone the browser rejects shows as saved and unavailable beside the empty option", async () => {
  serve({ "/api/owner/page": [page({ timezone: "Not/A_Zone" }), page({ timezone: "Not/A_Zone" })] });
  owner();
  await openSettings();
  expect(value("settings-timezone")).toBe("");
  expect(text("settings-zone-saved")).toContain("Saved: Not/A_Zone (not available)");
  expect(described("settings-timezone")).toContain("Saved zone is unavailable. Choose a time zone.");
  expect(byId("save-timezone").getAttribute("aria-disabled")).toBe("true");
});

test("Back with unsaved edits asks first (Stay focused, Escape returns to Back); a pending save warns it may still apply", async () => {
  const held = later();
  serve({ "/api/owner/page": [page(), page()], "/api/owner/settings": [held.reply] });
  owner();
  await openSettings();
  await userEvent.click(byId("settings-theme-b_cosmic"));
  await userEvent.click(byId("settings-back"));
  await focused("dialog-cancel");
  expect(text("settings-dialog")).toContain("Discard unsaved changes?");
  await userEvent.keyboard("{Escape}");
  await focused("settings-back");
  await userEvent.click(byId("save-theme"));
  await userEvent.click(byId("settings-back"));
  await focused("dialog-cancel");
  expect(text("settings-dialog")).toContain("Leave while a save is pending?");
  expect(text("settings-dialog")).toContain("The save already sent may still take effect.");
  held.release(saved({ theme: "b_cosmic" }));
  await expect.poll(() => text("settings-dialog")).toContain("Your changes were saved.");
  expect(text("settings-dialog")).toContain("Leave Settings?"); // nothing is left to discard (review 6)
  expect(text("dialog-act")).toContain("Leave");
});

// Review round 1 (fresh-context reviewer): the state rules of CHECKS "Build contract" and the focus table.
test("an edit made while its save runs stays a draft against the new saved value", async () => {
  const held = later();
  serve({ "/api/owner/page": [page(), page()], "/api/owner/settings": [held.reply] });
  owner();
  await openSettings();
  await userEvent.click(byId("settings-theme-b_cosmic"));
  await userEvent.click(byId("save-theme"));
  await userEvent.click(byId("settings-theme-a_dreamy")); // back to the old saved value while B is on its way
  held.release(saved({ theme: "b_cosmic" }));
  await expect.poll(status).toContain("Saved / Đã lưu");
  expect(checked("settings-theme-a_dreamy")).toBe(true);
  expect(text("theme-status")).toContain("Changes not saved");
  expect(byId("save-theme").getAttribute("aria-disabled")).toBeNull();
});

test("a space typed after a saved name stays in the field", async () => {
  serve({ "/api/owner/page": [page(), page()] });
  owner();
  await openSettings();
  await userEvent.type(byId("settings-label_a"), " Lee");
  expect(value("settings-label_a")).toBe("[PARTNER_A] Lee");
});

test("a save that shows another panel changed elsewhere puts it in Conflict; choosing the new saved name clears it", async () => {
  serve({
    "/api/owner/page": [page(), page()],
    "/api/owner/settings": [saved({ theme: "c_cozy", label_a: "[PARTNER_Z]" }), saved({ default_lang: "vi", label_a: "[PARTNER_Z]" })],
  });
  owner();
  await openSettings();
  await rename("settings-label_a", "[PARTNER_X]");
  await userEvent.click(byId("settings-lang-vi"));
  await userEvent.click(byId("settings-theme-c_cozy"));
  await userEvent.click(byId("save-theme"));
  await expect.poll(status).toContain("Suggested theme / Chủ đề gợi ý");
  expect(status()).toContain("Saved / Đã lưu");
  expect(status()).toContain("This page changed in another tab or session."); // the newly conflicted panel is announced
  expect(has("reload-names")).toBe(true);
  expect(has("save-names")).toBe(false);
  await rename("settings-label_a", "[PARTNER_Z]");
  await shown("save-names");
  await userEvent.click(byId("save-names"));
  await expect.poll(() => to("/api/owner/settings")).toHaveLength(2);
  expect(to("/api/owner/settings")[1].body).toMatchObject({ panel: "names", base: { default_lang: "en" }, fields: { default_lang: "vi" } });
});

test("a refusal that does not match the panel or its fields, or a 200 without a complete finished page, stays unconfirmed", async () => {
  const noVersion: Record<string, unknown> = snapshot({ label_a: "[PARTNER_X]" });
  delete noVersion.version;
  serve({
    "/api/owner/page": [page(), page()],
    "/api/owner/settings": [
      { status: 400, body: { error: "invalid_timezone" } },
      { status: 400, body: { error: "invalid_name", fields: { label_b: "characters" } } },
      ok({ page: snapshot({ label_a: "[PARTNER_X]", setup_completed: false }) }),
      ok({ page: noVersion }),
    ],
  });
  owner();
  await openSettings();
  await rename("settings-label_a", "[PARTNER_X]");
  await userEvent.click(byId("save-names"));
  for (let n = 1; n <= 4; n++) {
    await focused(`retry-names`);
    await expect.poll(() => to("/api/owner/settings")).toHaveLength(n);
    await expect.poll(() => text("names-status")).toContain("We couldn't confirm the save.");
    if (n < 4) await userEvent.click(byId("retry-names"));
  }
  expect(value("settings-label_a")).toBe("[PARTNER_X]");
});

test("a save answered setup-not-finished offers Open setup", async () => {
  serve({ "/api/owner/page": [page(), page()], "/api/owner/settings": [{ status: 409, body: { error: "setup_not_finished" } }] });
  owner();
  await openSettings();
  await userEvent.click(byId("settings-theme-none"));
  await userEvent.click(byId("save-theme"));
  await focused("settings-setup");
});

test("a result for one panel keeps focus where the owner is working in another and is announced", async () => {
  const held = later();
  serve({ "/api/owner/page": [page(), page()], "/api/owner/settings": [held.reply] });
  owner();
  await openSettings();
  await userEvent.click(byId("settings-theme-none"));
  await userEvent.click(byId("save-theme"));
  await userEvent.click(byId("settings-label_a"));
  held.release("network");
  await expect.poll(status).toContain("We couldn't confirm the save.");
  expect(document.activeElement?.id).toBe("settings-label_a");
});

test("a failed Reload keeps a Try again in its panel that reads the saved values again", async () => {
  serve({
    "/api/owner/page": [page(), page(), { status: 503 }, page({ label_a: "[PARTNER_E]" })],
    "/api/owner/settings": [{ status: 409, body: { error: "conflict" } }],
  });
  owner();
  await openSettings();
  await rename("settings-label_a", "[PARTNER_X]");
  await userEvent.click(byId("save-names"));
  await focused("reload-names");
  await userEvent.click(byId("reload-names"));
  await expect.poll(() => text("reload-names")).toContain("Try again");
  expect(described("reload-names")).toContain("Try again reads the saved values again.");
  expect(has("save-timezone")).toBe(true); // the other panels stay
  await focused("reload-names");
  await userEvent.click(byId("reload-names"));
  await expect.poll(() => value("settings-label_a")).toBe("[PARTNER_E]");
});

test("going offline during Reload releases it; reconnecting reads that panel again", async () => {
  const abandoned = later();
  serve({
    "/api/owner/page": [page(), page(), abandoned.reply, page({ label_a: "[PARTNER_E]" })],
    "/api/owner/settings": [{ status: 409, body: { error: "conflict" } }],
  });
  owner();
  await openSettings();
  await rename("settings-label_a", "[PARTNER_X]");
  await userEvent.click(byId("save-names"));
  await focused("reload-names");
  await userEvent.click(byId("reload-names"));
  offline(true);
  await expect.poll(() => text("reload-names")).toContain("Try again");
  abandoned.release(page({ label_a: "[PARTNER_OLD]" })); // the released read's answer is stale
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(value("settings-label_a")).toBe("[PARTNER_X]");
  expect(text("reload-names")).toContain("Try again");
  offline(false);
  await expect.poll(() => value("settings-label_a")).toBe("[PARTNER_E]");
});

test("Try again before signing in keeps focus and says to sign in first", async () => {
  serve({ "/api/owner/page": [page(), page()], "/api/owner/settings": [{ status: 401 }, { status: 401 }] });
  owner();
  await openSettings();
  await rename("settings-label_a", "[PARTNER_X]");
  await userEvent.click(byId("save-names"));
  await shown("retry-names");
  await userEvent.click(byId("retry-names"));
  await expect.poll(status).toContain("Sign in again first.");
  await focused("retry-names");
});

test("a wording refusal shows again when the refused language is chosen again", async () => {
  serve({ "/api/owner/page": [page(), page()], "/api/owner/settings": [{ status: 400, body: { error: "wording_incomplete" } }] });
  owner();
  await openSettings();
  await userEvent.click(byId("settings-lang-vi"));
  await userEvent.click(byId("save-names"));
  await focused("settings-lang-vi");
  await userEvent.click(byId("settings-lang-en"));
  expect(described("settings-lang-en")).not.toContain("Complete and publish");
  await userEvent.click(byId("settings-lang-vi"));
  expect(described("settings-lang-vi")).toContain("Complete and publish the wording in this language");
});

test("the saved-values echo isolates each name", async () => {
  serve({ "/api/owner/page": [page(), page()] });
  owner();
  await openSettings();
  await userEvent.click(byId("settings-lang-vi"));
  const isolate = (name: string) => String.fromCharCode(0x2068) + name + String.fromCharCode(0x2069);
  expect(text("names-status")).toContain(`${isolate("[PARTNER_A]")}, ${isolate("[PARTNER_B]")}`);
});

test("O2's Change is named Change settings; Back offline shows the accepted settings as Last known", async () => {
  serve({ "/api/owner/page": [page(), page()], "/api/owner/settings": [saved({ theme: "c_cozy" })] });
  owner();
  await shown("settings-change");
  expect(text("settings-change").replace(/\s+/g, " ").trim()).toBe("Change settings / Đổi cài đặt");
  await openSettings();
  await userEvent.click(byId("settings-theme-c_cozy"));
  await userEvent.click(byId("save-theme"));
  await expect.poll(status).toContain("Saved / Đã lưu");
  offline(true);
  await userEvent.click(byId("settings-back"));
  await shown("settings-card");
  await focused("settings-card-title"); // Change is disabled offline (re-review 3)
  expect(text("settings-card")).toContain("C Cozy");
  expect(text("settings-card")).toContain("Last known");
});

test("offline: Save waits for the connection", async () => {
  serve({ "/api/owner/page": [page(), page()] });
  owner();
  await openSettings();
  await userEvent.click(byId("settings-theme-c_cozy"));
  offline(true);
  await expect.poll(() => byId("save-theme").getAttribute("aria-disabled")).toBe("true");
  expect(described("save-theme")).toContain("Reconnect to save changes.");
});

test("a rejected saved zone counts the O2 Home card in UTC and says so", async () => {
  serve({
    "/api/owner/page": [page({ timezone: "Not/A_Zone" })],
    "/api/owner/home/get": [ok({ home: { timezone: "Not/A_Zone", published: { start_date: "2020-01-01" }, unpublished_changes: false } })],
  });
  owner();
  await expect.poll(() => text("home-card")).toMatch(/Day \d+ together \(UTC\)/);
});

test("a second press on the sign-in screen's Try again sends nothing while the repeat runs", async () => {
  const held = later();
  serve({ "/api/owner/page": [page(), page()], "/api/owner/settings": [{ status: 401 }, held.reply] });
  owner();
  await openSettings();
  await rename("settings-label_a", "[PARTNER_X]");
  await userEvent.click(byId("save-names"));
  await shown("retry-names");
  await userEvent.click(byId("retry-names"));
  expect(byId("retry-names").getAttribute("aria-disabled")).toBe("true");
  byId("retry-names").click(); // a DOM click: Playwright itself refuses an aria-disabled control
  expect(to("/api/owner/settings")).toHaveLength(2);
  held.release(saved({ label_a: "[PARTNER_X]" }));
  await expect.poll(status).toContain("Saved / Đã lưu");
  expect(to("/api/owner/settings")).toHaveLength(2);
});

test("a Reload that meets a 401 reads that panel again after signing in", async () => {
  serve({
    "/api/owner/page": [page(), page(), { status: 401 }, page({ label_a: "[PARTNER_E]" })],
    "/api/owner/settings": [{ status: 409, body: { error: "conflict" } }],
  });
  owner();
  await openSettings();
  await rename("settings-label_a", "[PARTNER_X]");
  await userEvent.click(byId("save-names"));
  await focused("reload-names");
  await userEvent.click(byId("reload-names"));
  await focused("settings-signin");
  await userEvent.click(byId("settings-retry"));
  await expect.poll(() => value("settings-label_a")).toBe("[PARTNER_E]");
  await focused("settings-label_a");
});

test("a Reload answered with no page after an accepted one is access lost", async () => {
  serve({
    "/api/owner/page": [page(), page(), ok({ page: null, drafts: null })],
    "/api/owner/settings": [{ status: 409, body: { error: "conflict" } }],
  });
  owner();
  await openSettings();
  await rename("settings-label_a", "[PARTNER_X]");
  await userEvent.click(byId("save-names"));
  await focused("reload-names");
  await userEvent.click(byId("reload-names"));
  await focused("settings-logout");
  expect(text("settings-error")).toContain("Access is no longer available.");
});
