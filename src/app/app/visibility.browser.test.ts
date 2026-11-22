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

// O9 Visibility and the O2 Visibility row in a real browser (owner UI "O8 Share and O9 Visibility for T2.6"; PRD Q146
// 10-44; `.design/share/CHECKS.md`). fetch answers each route from a queue and records the bodies sent. Placeholder data.
const SHOWN = { version: 1, created_at: "2026-03-10T04:30:00.000Z", shown_at: "2026-03-10T04:31:00.000Z" };
const PAGE = {
  version: 2, theme: "a_dreamy", default_lang: "en", label_a: "[PARTNER_A]", label_b: "[PARTNER_B]",
  timezone: "Asia/Ho_Chi_Minh", visibility: "token_only", setup_completed: true, sections: ["home", "memories"],
  link: SHOWN as unknown,
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

test("O2 Visibility row: the saved value and Change; O9 shows both panels from one read, Published disabled, Home always on; Back returns focus", async () => {
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
  expect(byId<HTMLInputElement>("vis-published").disabled).toBe(true);
  expect(described("vis-published")).toContain("Available once the page can open without a link (coming later)");
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
  expect(save.body).toEqual({ visibility: "private", request_id: expect.stringMatching(UUID), confirm: true });
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
  expect(to("/api/owner/visibility")[0].body).toEqual({ visibility: "token_only", request_id: expect.stringMatching(UUID) });
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
  await expect.poll(status).toContain("Saved / Đã lưu");
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
  await expect.poll(status).toContain("Saved / Đã lưu");
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

test("a refused save keeps the draft; 401 keeps it and Try again after signing in repeats the request; 403 offers Log out", async () => {
  serve({
    "/api/owner/page": [page(), page()],
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
  await userEvent.click(byId("retry-sections"));
  await focused("save-sections");
  await expect.poll(status).toContain("Saved / Đã lưu");
  const [, unauthorized, retried] = to("/api/owner/sections");
  expect(retried.body).toEqual(unauthorized.body);

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
