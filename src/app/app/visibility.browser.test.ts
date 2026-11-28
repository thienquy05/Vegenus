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

// O9 Visibility and the O2 Visibility row in a real browser (owner UI "O8 Share and O9 Visibility for T2.6" and "O9
// Published address and the O2 Visibility row for T3.1p"; PRD Q146, Q155-Q157; `.design/published/CHECKS.md`). fetch
// answers each route from a queue and records the bodies sent. Placeholder data.
const SHOWN = { version: 1, created_at: "2026-03-10T04:30:00.000Z", shown_at: "2026-03-10T04:31:00.000Z" };
const PAGE = {
  version: 2, theme: "a_dreamy", default_lang: "en", label_a: "[PARTNER_A]", label_b: "[PARTNER_B]",
  timezone: "Asia/Ho_Chi_Minh", visibility: "token_only", setup_completed: true, sections: ["home", "memories"],
  link: SHOWN as unknown, vanity_name: null as string | null, storage_used_bytes: 0, storage_budget_bytes: 1073741824,
};
const BASE = { visibility: "token_only", vanity_name: null, has_link: true };
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
      const reply = url === "/api/owner/home/get" ? ok({ home: null }) : await routes[url]?.shift();
      if (!reply || reply === "network") throw new TypeError(`no answer for ${url}`);
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status });
    }),
  );
}
const ok = (body: unknown): Reply => ({ status: 200, body });
const to = (url: string) => sent.filter((c) => c.url === url);
// A reply the test releases later, to hold a save in flight.
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
const described = (id: string) =>
  (byId(id).getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean).map((d) => byId(d)?.textContent ?? "").join(" ");
function offline(on: boolean) {
  if (on) Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  else delete (navigator as { onLine?: boolean }).onLine;
  dispatchEvent(new Event(on ? "offline" : "online"));
}
async function openVisibility() {
  await shown("visibility-change");
  await userEvent.click(byId("visibility-change"));
  await expect.poll(() => has("save-visibility") || has("visibility-retry") || has("visibility-setup") || has("visibility-signin")).toBe(true);
}

test("O2 Visibility row: the saved value and Change; O9 shows both panels from one read, Published offered, Home always on; Back returns focus", async () => {
  serve({ "/api/owner/page": [page(), page(), page()] });
  owner();
  await shown("visibility-change");
  expect(byId("visibility-card").textContent).toContain("Token-only");
  expect(byId("visibility-change").textContent).toContain("Change");
  await openVisibility();
  await focused("visibility-title");
  expect(byId("visibility-title").textContent).toContain("Visibility and sections");
  expect(checked("vis-token_only")).toBe(true);
  expect(checked("vis-private")).toBe(false);
  expect(byId<HTMLInputElement>("vis-published").disabled).toBe(false);
  expect(described("vis-published")).toContain("Anyone with the address can open the page, and search engines may list it.");
  expect(has("page-address")).toBe(false); // only while Published is selected
  expect(checked("section-home") && byId<HTMLInputElement>("section-home").disabled).toBe(true);
  expect(described("section-home")).toContain("Always on: every guest starts here");
  expect(checked("section-memories")).toBe(true);
  expect(checked("section-together")).toBe(false);
  expect(has("section-zodiac")).toBe(false);
  expect(byId("sections-help").textContent).toContain("nothing is deleted");
  expect(byId("save-visibility").getAttribute("aria-disabled")).toBe("true"); // nothing to save yet
  expect(has("visibility-create-first")).toBe(false); // a link exists
  await userEvent.click(byId("visibility-back"));
  await focused("visibility-change");
  expect(to("/api/owner/visibility")).toHaveLength(0);
});

test("Private asks first (focus on Cancel, Escape keeps the draft), then saves with a request id and says Saved", async () => {
  serve({ "/api/owner/page": [page(), page()], "/api/owner/visibility": [saved({ visibility: "private" })] });
  owner();
  await openVisibility();
  await userEvent.click(byId("vis-private"));
  expect(byId("visibility-status").textContent).toContain("Changes not saved");
  expect(byId("visibility-status").textContent).toContain("Saved: Token-only");
  await userEvent.click(byId("save-visibility"));
  await focused("dialog-cancel");
  expect(byId("visibility-dialog").textContent).toContain("Make the page private?");
  await userEvent.keyboard("{Escape}");
  await focused("save-visibility");
  expect(to("/api/owner/visibility")).toHaveLength(0);
  expect(checked("vis-private")).toBe(true);
  await userEvent.click(byId("save-visibility"));
  await userEvent.click(byId("dialog-act"));
  await expect.poll(status).toContain("Saved / Đã lưu"); // the announcement, not the "Saved: …" line
  const [save] = to("/api/owner/visibility");
  expect(save.body).toEqual({ visibility: "private", request_id: expect.stringMatching(UUID), confirm: true, base: BASE });
  expect(status()).toContain("Saved");
  expect(byId("visibility-status").textContent).not.toContain("Changes not saved");
  await focused("save-visibility");
});

test("Token-only saves without a confirm", async () => {
  serve({ "/api/owner/page": [page({ visibility: "private" }), page({ visibility: "private" })], "/api/owner/visibility": [saved()] });
  owner();
  await openVisibility();
  await userEvent.click(byId("vis-token_only"));
  await userEvent.click(byId("save-visibility"));
  await expect.poll(() => to("/api/owner/visibility")).toHaveLength(1);
  expect(to("/api/owner/visibility")[0].body).toEqual({
    visibility: "token_only", request_id: expect.stringMatching(UUID), base: { ...BASE, visibility: "private" },
  });
  await expect.poll(status).toContain("Saved");
});

test("Sections send the flags the draft was based on and the new flags", async () => {
  serve({ "/api/owner/page": [page(), page()], "/api/owner/sections": [saved({ sections: ["home", "memories", "together"] })] });
  owner();
  await openVisibility();
  await userEvent.click(byId("section-together"));
  expect(byId("sections-status").textContent).toContain("Changes not saved");
  expect(byId("sections-status").textContent).toContain("Saved sections: Home, Memories");
  await userEvent.click(byId("save-sections"));
  await expect.poll(status).toContain("Sections saved.");
  const [save] = to("/api/owner/sections");
  expect(save.body.request_id).toMatch(UUID);
  expect([...(save.body.base_sections as string[])].sort()).toEqual(["home", "memories"]);
  expect([...(save.body.sections as string[])].sort()).toEqual(["home", "memories", "together"]);
  expect(checked("section-together")).toBe(true);
});

test("a sections conflict offers Reload, which clears only the section edits and holds the checkboxes until the read", async () => {
  const reread = later();
  serve({
    "/api/owner/page": [page(), page(), reread.reply],
    "/api/owner/sections": [{ status: 409, body: { error: "conflict" } }],
  });
  owner();
  await openVisibility();
  await userEvent.click(byId("vis-private")); // the other panel's draft survives
  await userEvent.click(byId("section-together"));
  await userEvent.click(byId("save-sections"));
  await focused("sections-reload");
  expect(byId("sections-status").textContent).toContain("This page changed in another tab or session.");
  expect(byId("sections-reload").textContent).toContain("Reload (clears your unsaved section changes)");
  await userEvent.click(byId("sections-reload"));
  await expect.poll(() => byId("section-memories").getAttribute("aria-disabled")).toBe("true");
  expect(described("section-memories")).toContain("Reloading the saved sections…");
  byId("section-memories").click(); // a held checkbox does not change
  expect(checked("section-memories")).toBe(true);
  reread.release(page({ sections: ["home", "guestbook"] }));
  await expect.poll(() => checked("section-guestbook")).toBe(true);
  expect(checked("section-together")).toBe(false);
  expect(checked("section-memories")).toBe(false);
  expect(byId("section-memories").getAttribute("aria-disabled")).toBeNull();
  expect(checked("vis-private")).toBe(true);
  expect(byId("visibility-status").textContent).toContain("Changes not saved");
});

test("an unconfirmed save locks the other Save and Try again repeats the same request", async () => {
  const retried = later();
  serve({
    "/api/owner/page": [page(), page()],
    "/api/owner/sections": ["network", retried.reply],
  });
  owner();
  await openVisibility();
  await userEvent.click(byId("section-together"));
  await userEvent.click(byId("vis-private"));
  await userEvent.click(byId("save-sections"));
  await focused("retry-sections");
  expect(byId("sections-status").textContent).toContain("We couldn't confirm the save. Try again to finish it; it won't be applied twice.");
  expect(byId("save-visibility").getAttribute("aria-disabled")).toBe("true");
  expect(described("save-visibility")).toContain("Wait for the other save to finish.");
  byId("save-visibility").click();
  expect(has("visibility-dialog") && (byId<HTMLDialogElement>("visibility-dialog").open)).toBe(false);
  await userEvent.click(byId("retry-sections"));
  await focused("save-sections"); // the pressed Try again is gone: focus goes to the busy Save, never the page
  retried.release(saved({ sections: ["home", "memories", "together"] }));
  await expect.poll(status).toContain("Sections saved.");
  const [first, again] = to("/api/owner/sections");
  expect(again.body).toEqual(first.body);
  expect(byId("save-visibility").getAttribute("aria-disabled")).toBeNull();
  expect(checked("vis-private")).toBe(true);
});

test("one save at a time: edits made while a save is in flight stay", async () => {
  const pending = later();
  serve({ "/api/owner/page": [page(), page()], "/api/owner/visibility": [pending.reply] });
  owner();
  await openVisibility();
  await userEvent.click(byId("vis-private"));
  await userEvent.click(byId("save-visibility"));
  await userEvent.click(byId("dialog-act"));
  await expect.poll(() => byId("save-visibility").textContent).toContain("Saving…");
  expect(byId("save-visibility").getAttribute("aria-disabled")).toBe("true");
  await userEvent.click(byId("section-guestbook"));
  expect(byId("save-sections").getAttribute("aria-disabled")).toBe("true");
  expect(described("save-sections")).toContain("Wait for the other save to finish.");
  pending.release(saved({ visibility: "private" }));
  await expect.poll(status).toContain("Saved / Đã lưu"); // the announcement, not the "Saved: …" line
  expect(checked("section-guestbook")).toBe(true);
  expect(byId("sections-status").textContent).toContain("Changes not saved");
  expect(byId("save-sections").getAttribute("aria-disabled")).toBeNull();
});

test("a save that another tab changed again says so and shows the saved values", async () => {
  serve({ "/api/owner/page": [page(), page()], "/api/owner/sections": [saved({ sections: ["home"] })] });
  owner();
  await openVisibility();
  await userEvent.click(byId("section-together"));
  await userEvent.click(byId("save-sections"));
  await expect.poll(status).toContain("Your save went through, but these settings were changed again in another tab or session.");
  // The panel shows what is saved now (the board's rule), so nothing reads as unsaved or as plain Saved.
  expect(checked("section-together")).toBe(false);
  expect(checked("section-memories")).toBe(false);
  expect(byId("sections-status").textContent).not.toContain("Changes not saved");
  expect(byId("sections-status").textContent).not.toMatch(/^Saved/);
});

test("a refused save keeps the draft; 401 keeps it and Try again revalidates, the next Save a new request; 403 offers Log out", async () => {
  serve({
    "/api/owner/page": [page(), page(), page()],
    "/api/owner/sections": [{ status: 400 }, { status: 401 }, saved({ sections: ["home", "memories", "together"] })],
  });
  owner();
  await openVisibility();
  await userEvent.click(byId("section-together"));
  await userEvent.click(byId("save-sections"));
  await expect.poll(() => byId("sections-status").textContent).toContain("Not saved. Your changes are still here.");
  expect(checked("section-together")).toBe(true);
  await focused("save-sections");
  await userEvent.click(byId("save-sections"));
  await focused("visibility-signin");
  expect(byId("visibility-signin").getAttribute("target")).toBe("_blank");
  await userEvent.click(byId("visibility-retry"));
  await shown("save-sections");
  expect(checked("section-together")).toBe(true); // the draft survives sign-in
  await userEvent.click(byId("save-sections"));
  await expect.poll(status).toContain("Sections saved.");
  const [, unauthorized, again] = to("/api/owner/sections");
  expect(again.body.sections).toEqual(unauthorized.body.sections);
  expect(again.body.request_id).not.toBe(unauthorized.body.request_id);

  root!.unmount();
  host.remove();
  serve({ "/api/owner/page": [page(), page()], "/api/owner/visibility": [{ status: 403 }] });
  owner();
  await openVisibility();
  await userEvent.click(byId("vis-private"));
  await userEvent.click(byId("save-visibility"));
  await userEvent.click(byId("dialog-act"));
  await focused("visibility-logout");
  expect(host.textContent).toContain("Access is no longer available.");
  expect(has("save-visibility")).toBe(false);
});

test("before setup is finished O9 says so with a setup link; a save refused for unpublished wording says the same", async () => {
  serve({ "/api/owner/page": [page(), page({ setup_completed: false })] });
  owner();
  await openVisibility();
  expect(byId("visibility-setup-message").textContent).toContain("Finish setup first.");
  expect(byId("visibility-setup").textContent).toContain("Open setup");
  expect(has("save-visibility")).toBe(false);

  root!.unmount();
  host.remove();
  serve({ "/api/owner/page": [page(), page()], "/api/owner/visibility": [{ status: 409, body: { error: "wording_not_published" } }] });
  owner();
  await openVisibility();
  await userEvent.click(byId("vis-private"));
  await userEvent.click(byId("save-visibility"));
  await userEvent.click(byId("dialog-act"));
  await focused("visibility-setup");
});

test("offline: edits still work, Save says why and sends nothing, and reconnecting keeps the draft", async () => {
  serve({ "/api/owner/page": [page(), page()] });
  owner();
  await openVisibility();
  offline(true);
  await shown("visibility-offline-reason");
  expect(byId("visibility-offline-reason").textContent).toContain("Reconnect to save changes.");
  await userEvent.click(byId("vis-private"));
  expect(checked("vis-private")).toBe(true);
  expect(byId("save-visibility").getAttribute("aria-disabled")).toBe("true");
  expect(described("save-visibility")).toContain("Reconnect to save changes.");
  byId("save-visibility").click();
  expect(to("/api/owner/visibility")).toHaveLength(0);
  offline(false);
  await expect.poll(() => has("visibility-offline-reason")).toBe(false);
  expect(checked("vis-private")).toBe(true);
  expect(byId("save-visibility").getAttribute("aria-disabled")).toBeNull();
});

test("a failed O9 read offers Try again; 401 offers Sign in", async () => {
  serve({ "/api/owner/page": [page(), "network", page(), { status: 401 }] });
  owner();
  await openVisibility();
  await focused("visibility-retry");
  expect(byId("visibility-error").textContent).toContain("Couldn’t load this.");
  await userEvent.click(byId("visibility-retry"));
  await shown("save-visibility");
  root!.unmount();
  host.remove();
  serve({ "/api/owner/page": [page(), { status: 401 }] });
  owner();
  await openVisibility();
  await focused("visibility-signin");
});

test("unsaved changes: Back asks to discard (Stay keeps them); the Share shortcut asks too, and O8 Back returns to O9", async () => {
  serve({ "/api/owner/page": [page({ link: null }), page({ link: null }), page({ link: null }), page({ link: null }), page({ link: null })] });
  owner();
  await openVisibility();
  expect(byId("visibility-create-first").textContent).toContain("Create a guest link in Share first.");
  await userEvent.click(byId("section-together"));
  await userEvent.click(byId("visibility-back"));
  await focused("dialog-cancel");
  expect(byId("visibility-dialog").textContent).toContain("Discard unsaved changes?");
  await userEvent.click(byId("dialog-cancel"));
  await focused("visibility-back");
  expect(checked("section-together")).toBe(true);
  await userEvent.click(byId("visibility-create-first"));
  await focused("dialog-cancel");
  await userEvent.click(byId("dialog-act"));
  await focused("share-title");
  await shown("share-create");
  await userEvent.click(byId("share-back"));
  await focused("visibility-create-first");
  expect(checked("section-together")).toBe(false); // discarded
});

test("O8's Private notice opens O9, and O9 Back returns to the notice", async () => {
  serve({ "/api/owner/page": [page({ visibility: "private" }), page({ visibility: "private" }), page({ visibility: "private" }), page({ visibility: "private" }), page({ visibility: "private" })] });
  owner();
  await shown("share-entry");
  await userEvent.click(byId("share-entry"));
  await shown("share-visibility");
  await userEvent.click(byId("share-visibility"));
  await focused("visibility-title");
  await shown("save-visibility");
  expect(checked("vis-private")).toBe(true);
  await userEvent.click(byId("visibility-back"));
  await focused("share-visibility");
  // Only the return read moves focus there; a later reconnect read leaves it where the owner put it.
  byId("share-back").focus();
  offline(true);
  await shown("share-offline-reason");
  offline(false);
  await expect.poll(() => to("/api/owner/page").length).toBe(5);
  await new Promise((r) => setTimeout(r, 100));
  expect(document.activeElement?.id).toBe("share-back");
});

test("an Unconfirmed retry that meets 401 resends the same request after signing in", async () => {
  serve({
    "/api/owner/page": [page(), page()],
    "/api/owner/sections": ["network", { status: 401 }, saved({ sections: ["home", "memories", "together"] })],
  });
  owner();
  await openVisibility();
  await userEvent.click(byId("section-together"));
  await userEvent.click(byId("save-sections"));
  await focused("retry-sections");
  await userEvent.click(byId("retry-sections"));
  await focused("visibility-signin");
  await userEvent.click(byId("visibility-retry"));
  await focused("retry-sections");
  expect(has("check-sections")).toBe(true); // Check saved settings, if the retry cannot be sent
  await userEvent.click(byId("retry-sections"));
  await expect.poll(status).toContain("Sections saved.");
  const [first, , last] = to("/api/owner/sections");
  expect(last.body).toEqual(first.body);
});

// T3.1p: Published with its address (owner UI "O9 Published address"; Q155-Q157).
test("Published: the address field echoes the normalized address, the confirm names it, and the save sends it with the base", async () => {
  const live = { visibility: "published", vanity_name: "our-page" };
  serve({ "/api/owner/page": [page(), page()], "/api/owner/visibility": [saved(live)] });
  owner();
  await openVisibility();
  await userEvent.click(byId("vis-published"));
  await shown("page-address");
  expect(byId("address-prefix").textContent).toBe(`${location.host}/p/`);
  expect(described("page-address")).toContain("avoid full names or dates");
  await userEvent.type(byId("page-address"), " Our-Page");
  expect(byId("address-echo").textContent).toBe(`${location.host}/p/our-page`);
  await userEvent.click(byId("save-visibility"));
  await focused("dialog-cancel");
  expect(byId("visibility-dialog-title").textContent).toContain("Make the page public?");
  expect(byId("visibility-dialog-body").textContent).toContain(`Anyone with the address ${location.host}/p/our-page can open the page`);
  expect(byId("visibility-dialog-body").textContent).toContain("Your guest link keeps working.");
  await userEvent.click(byId("dialog-act"));
  await expect.poll(status).toContain("Saved / Đã lưu");
  expect(to("/api/owner/visibility")[0].body).toEqual({
    visibility: "published", vanity_name: "our-page", confirm: true, base: BASE, request_id: expect.stringMatching(UUID),
  });
  await focused("save-visibility");
  expect(byId("saved-address").textContent).toBe(`${location.origin}/p/our-page`);
  const open = byId<HTMLAnchorElement>("open-page");
  expect([open.href, open.target, open.rel]).toEqual([`${location.origin}/p/our-page`, "_blank", "noopener"]);
  expect(open.textContent).toContain("(new tab)");
  expect(has("address-echo")).toBe(false); // the saved address is shown, not echoed again
  const write = vi.fn(async () => {});
  vi.spyOn(navigator.clipboard, "writeText").mockImplementation(write);
  await userEvent.click(byId("copy-address"));
  await expect.poll(status).toContain("Address copied.");
  expect(write).toHaveBeenCalledWith(`${location.origin}/p/our-page`);
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("refused"));
  await userEvent.click(byId("copy-address"));
  await shown("select-address");
  await focused("saved-address");
  expect(status()).toContain("Select the link and copy it");
});

test("an invalid address is refused on Save without a request; a taken one stays with its slug", async () => {
  serve({ "/api/owner/page": [page(), page()], "/api/owner/visibility": [{ status: 409, body: { error: "name_taken" } }] });
  owner();
  await openVisibility();
  await userEvent.click(byId("vis-published"));
  await userEvent.type(byId("page-address"), "ab");
  expect(has("address-echo")).toBe(false);
  await userEvent.click(byId("save-visibility"));
  await focused("page-address");
  expect(byId("address-error").textContent).toContain("Use at least 3 characters.");
  expect(byId("page-address").getAttribute("aria-invalid")).toBe("true");
  expect(byId("visibility-status").textContent).toContain("Check the page address.");
  await expect.poll(status).toContain("Check the page address.");
  expect(to("/api/owner/visibility")).toHaveLength(0);
  await userEvent.clear(byId("page-address"));
  await userEvent.type(byId("page-address"), "taken-page");
  await userEvent.click(byId("save-visibility"));
  await userEvent.click(byId("dialog-act"));
  await focused("page-address");
  expect(byId("address-error").textContent).toContain("This address is already taken. Try another.");
  await userEvent.click(byId("vis-token_only"));
  expect(has("page-address")).toBe(false);
  await userEvent.click(byId("vis-published"));
  expect(byId("address-error").textContent).toContain("This address is already taken.");
  expect(has("address-echo")).toBe(false);
  await userEvent.type(byId("page-address"), "-2");
  expect(has("address-error")).toBe(false);
  expect(byId("address-echo").textContent).toBe(`${location.host}/p/taken-page-2`);
});

test("leaving Published says the address stops opening, saves without it, and then says it is kept", async () => {
  const live = snapshot({ visibility: "published", vanity_name: "our-page" });
  serve({
    "/api/owner/page": [ok({ page: live, drafts: null }), ok({ page: live, drafts: null })],
    "/api/owner/visibility": [saved({ visibility: "token_only", vanity_name: "our-page" })],
  });
  owner();
  await openVisibility();
  await userEvent.click(byId("vis-token_only"));
  expect(host.textContent).toContain(`When you save, ${location.host}/p/our-page stops opening. The name stays reserved for this page.`);
  await userEvent.click(byId("save-visibility"));
  await expect.poll(status).toContain("Saved / Đã lưu");
  expect(to("/api/owner/visibility")[0].body).toEqual({
    visibility: "token_only", request_id: expect.stringMatching(UUID), base: { visibility: "published", vanity_name: "our-page", has_link: true },
  });
  expect(byId("address-kept").textContent).toContain("Your page address our-page is kept for when you publish again.");
  expect(has("saved-address")).toBe(false);
});

test("renaming a published address asks first and names both addresses", async () => {
  const live = snapshot({ visibility: "published", vanity_name: "our-page" });
  serve({ "/api/owner/page": [ok({ page: live, drafts: null }), ok({ page: live, drafts: null })] });
  owner();
  await openVisibility();
  await userEvent.clear(byId("page-address"));
  await userEvent.type(byId("page-address"), "new-page");
  await userEvent.click(byId("save-visibility"));
  await focused("dialog-cancel");
  expect(byId("visibility-dialog-title").textContent).toContain("Change the page address?");
  const body = byId("visibility-dialog-body").textContent;
  expect(body).toContain(`${location.host}/p/our-page stops working at once and stays reserved for this page.`);
  expect(body).toContain(`New address / Địa chỉ mới · ${location.host}/p/new-page`);
  await userEvent.keyboard("{Escape}");
  await focused("save-visibility");
  expect(to("/api/owner/visibility")).toHaveLength(0);
});

// Carried from the final design review (owner UI O9): Conflict, Reload, the read fails or needs sign-in, then Try again
// succeeds and focus moves from the page heading to that panel's Save.
test("Conflict, Reload, a failed or signed-out read, then Try again: focus lands on the panel's Save", async () => {
  for (const failure of ["network", { status: 401 }] as Reply[]) {
    serve({
      "/api/owner/page": [page(), page(), failure, page({ visibility: "private" })],
      "/api/owner/visibility": [{ status: 409, body: { error: "conflict" } }],
    });
    owner();
    await openVisibility();
    await userEvent.click(byId("vis-private"));
    await userEvent.click(byId("save-visibility"));
    await userEvent.click(byId("dialog-act"));
    await focused("visibility-reload");
    expect(byId("visibility-status").textContent).toContain("This page changed in another tab or session.");
    await userEvent.click(byId("visibility-reload"));
    await focused(failure === "network" ? "visibility-retry" : "visibility-signin");
    await userEvent.click(byId("visibility-retry"));
    await focused("save-visibility");
    expect(checked("vis-private")).toBe(true);
    expect(byId("save-visibility").getAttribute("aria-disabled")).toBe("true"); // the reloaded values, nothing unsaved
    root!.unmount();
    host.remove();
  }
  root = null;
  host = document.createElement("div");
});

// T3.1p O2 (owner UI "O2 Visibility row"): Published with its wrapping address; Change named with its row; the same page
// validator as O9, so a malformed page reads as an error rather than as a page.
test("O2 shows Published with its address and names Change with its row; a malformed page is a read error", async () => {
  serve({ "/api/owner/page": [page({ visibility: "published", vanity_name: "our-page" })] });
  owner();
  await shown("visibility-change");
  expect(byId("visibility-card").textContent).toContain("Published");
  expect(byId("visibility-address").textContent).toBe(`${location.host}/p/our-page`);
  const name = (byId("visibility-change").getAttribute("aria-labelledby") ?? "").split(" ").map((id) => byId(id).textContent).join(" ");
  expect(name).toContain("Visibility");
  expect(name).toContain("Change");
  root!.unmount();
  host.remove();
  serve({ "/api/owner/page": [page({ visibility: "published", vanity_name: null })] });
  owner();
  await expect.poll(() => host.textContent).toContain("Couldn’t load this.");
  expect(has("visibility-change")).toBe(false);
});

// Review fixes (T3.1pb): focus after a dialog closes for recovery; focus the owner moved stays; offline confirm says why.
test("a save that meets 401 while the discard dialog is open closes it and focuses Sign in", async () => {
  const pending = later();
  serve({ "/api/owner/page": [page(), page()], "/api/owner/sections": [pending.reply] });
  owner();
  await openVisibility();
  await userEvent.click(byId("section-together"));
  await userEvent.click(byId("save-sections"));
  await userEvent.click(byId("visibility-back"));
  await focused("dialog-cancel");
  pending.release({ status: 401 });
  await focused("visibility-signin");
  expect(byId<HTMLDialogElement>("visibility-dialog").open).toBe(false);
});

test("a completed save leaves focus where the owner moved it", async () => {
  const pending = later();
  serve({ "/api/owner/page": [page(), page()], "/api/owner/visibility": [saved({ visibility: "private" })], "/api/owner/sections": [pending.reply] });
  owner();
  await openVisibility();
  await userEvent.click(byId("vis-private"));
  await userEvent.click(byId("save-visibility"));
  await userEvent.click(byId("dialog-act"));
  await expect.poll(status).toContain("Saved / Đã lưu");
  await focused("save-visibility"); // the screen placed focus here
  await userEvent.click(byId("section-together"));
  await userEvent.click(byId("save-sections"));
  byId("save-visibility").focus(); // the owner moves back while the sections save runs
  pending.release(saved({ visibility: "private", sections: ["home", "memories", "together"] }));
  await expect.poll(status).toContain("Sections saved.");
  expect(document.activeElement?.id).toBe("save-visibility");
});

test("an open confirm says why it cannot act while offline", async () => {
  serve({ "/api/owner/page": [page(), page()] });
  owner();
  await openVisibility();
  await userEvent.click(byId("vis-private"));
  await userEvent.click(byId("save-visibility"));
  await focused("dialog-cancel");
  offline(true);
  await expect.poll(() => byId("dialog-act").getAttribute("aria-disabled")).toBe("true");
  expect(described("dialog-act")).toContain("Reconnect to save changes.");
  offline(false);
});

// T3.1p O2 return read (owner UI line 581, CHECKS "Back from O9" and "Back from O8"): the kept snapshot says Last known
// on the Visibility row and the Share card while the read runs and beside Try again when it fails; Change is blocked.
test("Back from O9: Last known while the return read runs and beside Try again when it fails; Change blocked until it settles", async () => {
  const pending = later();
  serve({ "/api/owner/page": [page(), page(), pending.reply, page({ visibility: "published", vanity_name: "our-page" })] });
  owner();
  await openVisibility();
  await userEvent.click(byId("visibility-back"));
  await shown("visibility-change");
  expect(byId("visibility-card").textContent).toContain("Last known");
  expect(byId("share-card").textContent).toContain("Last known");
  expect(byId("visibility-change").getAttribute("aria-disabled")).toBe("true");
  byId("visibility-change").click();
  expect(has("save-visibility") || has("visibility-retry")).toBe(false); // still on O2
  pending.release("network");
  await focused("dashboard-retry");
  expect(described("dashboard-retry")).toContain("Couldn’t load this.");
  expect(byId("visibility-card").textContent).toContain("Token-only");
  expect(byId("visibility-card").textContent).toContain("Last known");
  expect(byId("visibility-change").getAttribute("aria-disabled")).toBe("true");
  await userEvent.click(byId("dashboard-retry"));
  await focused("visibility-change");
  expect(byId("visibility-card").textContent).toContain("Published");
  expect(byId("visibility-card").textContent).not.toContain("Last known");
  expect(byId("share-card").textContent).not.toContain("Last known");
  expect(byId("visibility-change").getAttribute("aria-disabled")).toBeNull();
  expect(has("dashboard-retry")).toBe(false);
});

test("a back-forward cache restore of O2 revalidates it with the same Last known rule", async () => {
  const pending = later();
  serve({ "/api/owner/page": [page(), pending.reply] });
  owner();
  await shown("visibility-change");
  dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  await expect.poll(() => byId("visibility-card").textContent).toContain("Last known");
  expect(to("/api/owner/page")).toHaveLength(2);
  pending.release(page({ visibility: "private" }));
  await expect.poll(() => byId("visibility-card").textContent).toContain("Private");
  expect(byId("visibility-card").textContent).not.toContain("Last known");
});

// Review fixes (O2 return read): an older return read answering last is ignored; a 401 draws no page data.
test("an older return read that answers after a newer one is ignored", async () => {
  const first = later();
  serve({ "/api/owner/page": [page(), page(), first.reply, page({ visibility: "private" })] });
  owner();
  await openVisibility();
  await userEvent.click(byId("visibility-back"));
  await shown("visibility-change");
  dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  await expect.poll(() => byId("visibility-card").textContent).toContain("Private");
  first.release(page());
  await new Promise((r) => setTimeout(r, 50));
  expect(byId("visibility-card").textContent).toContain("Private");
  expect(byId("visibility-card").textContent).not.toContain("Last known");
});

test("a return read answering 401 draws no page data while sign-in takes over", async () => {
  serve({ "/api/owner/page": [page(), page(), { status: 401 }] });
  owner();
  await openVisibility();
  await userEvent.click(byId("visibility-back"));
  await expect.poll(() => has("visibility-card") || has("visibility-back")).toBe(false);
  expect(host.textContent).not.toContain("[PARTNER_A]");
});
