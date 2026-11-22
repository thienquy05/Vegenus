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

// O8 Share and the O2 Share entry in a real browser (owner UI "O8 Share and O9 Visibility for T2.6"; PRD Q146 10-44;
// design 1 §3.2). fetch answers each route from a queue and records the bodies sent. Placeholder data only.
const TOKEN = "T".repeat(43);
const LINK = `http://localhost:3000/g#${TOKEN}`;
const CREATED = "2026-03-10T04:30:00.000Z";
const SHOWN = { version: 1, created_at: CREATED, shown_at: "2026-03-10T04:31:00.000Z" };
const UNSHOWN = { version: 2, created_at: CREATED, shown_at: null };
const PAGE = {
  version: 2, theme: "a_dreamy", default_lang: "en", label_a: "[PARTNER_A]", label_b: "[PARTNER_B]",
  timezone: "Asia/Ho_Chi_Minh", visibility: "token_only", setup_completed: true, sections: ["home"], link: null as unknown,
};
const page = (fields: Partial<typeof PAGE> = {}) => ok({ page: { ...PAGE, ...fields }, drafts: null });

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
const issued = (version = 1) => ok({ link: LINK, version });
// A reply the test releases later, to hold a request in flight.
function later() {
  let release!: (reply: Reply) => void;
  const reply = new Promise<Reply>((resolve) => (release = resolve));
  return { reply, release };
}
const to = (url: string) => sent.filter((c) => c.url === url);

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
const text = () => host.textContent ?? "";
const status = () => host.querySelector('[role="status"]')?.textContent ?? "";
const byId = <T extends HTMLElement = HTMLElement>(id: string) => host.querySelector<T>(`#${CSS.escape(id)}`)!;
const has = (id: string) => !!host.querySelector(`#${CSS.escape(id)}`);
const shown = (id: string) => expect.poll(() => has(id)).toBe(true);
const focused = (id: string) => expect.poll(() => document.activeElement?.id).toBe(id);
function offline(on: boolean) {
  if (on) Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  else delete (navigator as { onLine?: boolean }).onLine;
  dispatchEvent(new Event(on ? "offline" : "online"));
}
const day = (iso: string) => new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "medium" }).format(new Date(iso));
const clock = (iso: string) => new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", timeStyle: "short" }).format(new Date(iso));
async function openShare(from = "share-entry") {
  await shown(from);
  await userEvent.click(byId(from));
  await focused("share-title");
  await expect.poll(() => has("share-create") || has("share-rotate") || has("share-retry")).toBe(true); // O8's own read
}
// Nothing but the reveal's own memory holds the link (Q146 13).
function noCredentialKept() {
  expect(location.href).not.toContain(TOKEN);
  expect(JSON.stringify({ ...localStorage })).not.toContain(TOKEN);
  expect(JSON.stringify({ ...sessionStorage })).not.toContain(TOKEN);
  for (const field of host.querySelectorAll<HTMLInputElement>("input, textarea")) expect(field.value).not.toContain(TOKEN);
}

test("O2 Share card: not created yet on a Token-only page, with the strong call to action; Share opens O8 and Back returns focus", async () => {
  serve({ "/api/owner/page": [page(), page(), page()] });
  owner();
  await shown("share-card");
  expect(byId("share-state").textContent).toContain("Guest link: not created yet");
  expect(byId("share-card").textContent).toContain("Guests can visit using your private link.");
  expect(byId("share-create-first").textContent).toContain("Create a guest link in Share first.");
  // The two actions never touch (seen at 1440 px): at least 8 px apart, side by side or stacked.
  const [a, b] = ["share-create-first", "share-entry"].map((id) => byId(id).getBoundingClientRect());
  expect(Math.max(b.top - a.bottom, b.left - a.right)).toBeGreaterThanOrEqual(8);
  await openShare("share-create-first");
  expect(text()).toContain("Create a guest link.");
  await userEvent.click(byId("share-back"));
  await focused("share-create-first");
});

test("O2 Share card: the created date in the page time zone, and display not confirmed", async () => {
  serve({ "/api/owner/page": [page({ link: SHOWN })] });
  owner();
  await shown("share-card");
  expect(byId("share-state").textContent).toContain(`Guest link created ${day(CREATED)}`);
  expect(has("share-create-first")).toBe(false);
  root!.unmount();
  host.remove();
  serve({ "/api/owner/page": [page({ link: UNSHOWN, visibility: "private" })] });
  owner();
  await shown("share-card");
  expect(byId("share-state").textContent).toContain("New link: display not confirmed. Open Share to rotate again.");
  expect(byId("share-card").textContent).toContain("Guests can't open the page, even with a link.");
});

test("Create: one request with no expected link; the reveal shows the link once, its QR, the tag steps, and acknowledges that version", async () => {
  serve({ "/api/owner/page": [page(), page()], "/api/owner/token": [issued(1)], "/api/owner/token/shown": [ok({ shown: true })] });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("reveal-title");
  const [create] = to("/api/owner/token");
  expect(create.body.expected_version).toBeNull();
  expect(create.body.request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(byId("reveal-title").textContent).toContain("Guest link created");
  expect(status()).toContain("Guest link created");
  expect(byId("reveal-link").textContent).toBe(LINK);
  expect(text()).toContain("This is the only time this link is shown.");
  expect(text()).toContain("Don't lock the tag.");
  // The QR never replaces the text link; it is named by its visible label.
  const qr = byId("share-qr");
  expect(qr.getAttribute("role")).toBe("img");
  expect(byId(qr.getAttribute("aria-labelledby")!).textContent).toContain("QR code for your guest link");
  await expect.poll(() => to("/api/owner/token/shown").map((c) => c.body)).toEqual([{ version: 1 }]);
  noCredentialKept();
  // Leaving is asked about while the link shows (Q146 14).
  const leaving = new Event("beforeunload", { cancelable: true });
  dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(true);
});

test("Rotate asks first with focus on Cancel; Escape returns to Rotate; confirming names the shown version and reveals the new link", async () => {
  serve({ "/api/owner/page": [page({ link: SHOWN }), page({ link: SHOWN })], "/api/owner/token": [issued(2)], "/api/owner/token/shown": [ok({ shown: true })] });
  owner();
  await openShare();
  expect(text()).toContain(`Guest link created ${day(CREATED)} ${clock(CREATED)}, shown on this screen once.`);
  expect(text()).toContain("If the tag still works, you can read the link with an NFC app.");
  await userEvent.click(byId("share-rotate"));
  await focused("dialog-cancel");
  expect(byId("share-dialog").textContent).toContain("Rotate the guest link?");
  await userEvent.keyboard("{Escape}");
  await focused("share-rotate");
  expect(to("/api/owner/token")).toHaveLength(0);
  await userEvent.click(byId("share-rotate"));
  await userEvent.click(byId("dialog-act"));
  await focused("reveal-title");
  expect(to("/api/owner/token")[0].body.expected_version).toBe(1);
  expect(byId("reveal-title").textContent).toContain("Guest link rotated");
});

test("an unknown outcome offers Try again, which repeats the same request; a lost answer then reads 'not shown yet' with Rotate again", async () => {
  const held = later();
  serve({
    "/api/owner/page": [page(), page(), page({ link: UNSHOWN })],
    "/api/owner/token": ["network", held.reply],
  });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("share-retry");
  expect(text()).toContain("We couldn't confirm whether a new link was made.");
  expect(text()).not.toContain("Nothing changed");
  await userEvent.click(byId("share-retry"));
  await focused("share-create"); // the pressed Try again is gone: focus goes to the busy action, never the page
  held.release({ status: 409, body: { error: "already_rotated" } });
  await expect.poll(text).toContain("A new guest link was made, but this screen couldn't confirm it was shown.");
  const [first, retry] = to("/api/owner/token");
  expect(retry.body).toEqual(first.body);
  expect(byId("share-rotate").textContent).toContain("Rotate again");
  expect(text()).not.toContain(TOKEN);
});

test("'changed' says nothing was created here; Reload reads the latest link", async () => {
  serve({
    "/api/owner/page": [page({ link: SHOWN }), page({ link: SHOWN }), page({ link: { ...SHOWN, version: 3 } })],
    "/api/owner/token": [{ status: 409, body: { error: "changed" } }],
  });
  owner();
  await openShare();
  await userEvent.click(byId("share-rotate"));
  await userEvent.click(byId("dialog-act"));
  await focused("share-reload");
  expect(text()).toContain("The guest link changed in another tab or session. Nothing was created here.");
  await userEvent.click(byId("share-reload"));
  await shown("share-rotate");
  await userEvent.click(byId("share-rotate"));
  await userEvent.click(byId("dialog-act"));
  await expect.poll(() => to("/api/owner/token").at(-1)?.body.expected_version).toBe(3);
});

test("a confirmed rejection says nothing changed; an expired session signs in in a new tab and Try again repeats the request; access lost offers Log out", async () => {
  serve({
    "/api/owner/page": [page(), page(), page()],
    "/api/owner/token": [{ status: 400 }, { status: 401 }, { status: 403 }],
  });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("share-reload"); // focus table: rejected goes to Reload
  expect(text()).toContain("The request was rejected. Nothing changed.");
  await userEvent.click(byId("share-reload"));
  await shown("share-create");
  await userEvent.click(byId("share-create"));
  await focused("share-signin");
  expect(text()).toContain("Your session expired.");
  expect(byId<HTMLAnchorElement>("share-signin").target).toBe("_blank");
  await userEvent.click(byId("share-retry"));
  await focused("share-logout");
  expect(text()).toContain("Access is no longer available.");
  const [, expired, retry] = to("/api/owner/token");
  expect(retry.body).toEqual(expired.body);
});

test("Done and Back ask before the link goes; Stay keeps it; leaving clears it and focuses Rotate, or the O2 opener", async () => {
  serve({
    "/api/owner/page": [page(), page(), page({ link: SHOWN }), page({ link: SHOWN })],
    "/api/owner/token": [issued(1)],
    "/api/owner/token/shown": [ok({ shown: true })],
  });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("reveal-title");
  await userEvent.click(byId("share-done"));
  await focused("dialog-cancel");
  expect(byId("share-dialog").textContent).toContain("Have you saved the link or the QR?");
  await userEvent.click(byId("dialog-cancel"));
  await focused("share-done");
  expect(byId("reveal-link").textContent).toBe(LINK);
  await userEvent.click(byId("share-done"));
  await userEvent.click(byId("dialog-act"));
  await focused("share-rotate");
  expect(text()).not.toContain(TOKEN);
  // The return read shows the link made here before focus goes back to the opener.
  await userEvent.click(byId("share-back"));
  await focused("share-entry");
  expect(byId("share-state").textContent).toContain(`Guest link created ${day(CREATED)}`);
});

test("Back from the reveal asks too, and lands on the O2 opener", async () => {
  serve({ "/api/owner/page": [page(), page(), page({ link: UNSHOWN })], "/api/owner/token": [issued(1)], "/api/owner/token/shown": [ok({ shown: true })] });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("reveal-title");
  await userEvent.click(byId("share-back"));
  await focused("dialog-cancel");
  await userEvent.click(byId("dialog-act"));
  await focused("share-entry");
  expect(text()).not.toContain(TOKEN);
});

test("Copy announces each time; a refused clipboard selects the link with Select link and its hint", async () => {
  serve({ "/api/owner/page": [page(), page()], "/api/owner/token": [issued(1)], "/api/owner/token/shown": [ok({ shown: true })] });
  const write = vi.fn(async () => {});
  vi.spyOn(navigator.clipboard, "writeText").mockImplementation(write);
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("reveal-title");
  await userEvent.click(byId("share-copy"));
  await expect.poll(status).toContain("Link copied");
  expect(write).toHaveBeenCalledWith(LINK);
  await userEvent.click(byId("share-copy"));
  await expect.poll(() => write.mock.calls.length).toBe(2);
  await expect.poll(status).toContain("Link copied");
  write.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
  await userEvent.click(byId("share-copy"));
  await focused("reveal-link");
  expect(text()).toContain("Select the link and copy it");
  expect(getSelection()?.toString()).toBe(LINK);
  await userEvent.click(byId("share-select"));
  await focused("reveal-link");
  expect(getSelection()?.toString()).toBe(LINK);
});

test("Download saves guest-link-qr.png from the QR and frees its object URL when the reveal ends", async () => {
  serve({ "/api/owner/page": [page(), page(), page({ link: SHOWN })], "/api/owner/token": [issued(1)], "/api/owner/token/shown": [ok({ shown: true })] });
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const saved: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download);
  });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("reveal-title");
  byId("share-download").click();
  await expect.poll(() => saved, { timeout: 5000 }).toEqual(["guest-link-qr.png"]); // PNG encoding is slow under load
  await expect.poll(status).toContain("QR downloaded");
  expect(revoke).not.toHaveBeenCalled();
  await userEvent.click(byId("share-done"));
  await userEvent.click(byId("dialog-act"));
  await focused("share-rotate");
  expect(revoke).toHaveBeenCalledTimes(1);
});

test("offline: Create stays focusable, says why and sends nothing", async () => {
  serve({ "/api/owner/page": [page(), page()] });
  owner();
  await openShare();
  offline(true);
  await expect.poll(() => byId("share-create").getAttribute("aria-disabled")).toBe("true");
  expect(byId(byId("share-create").getAttribute("aria-describedby")!).textContent).toContain("Reconnect to create or rotate a guest link.");
  byId("share-create").click(); // a blocked press only repeats the reason
  await expect.poll(status).toContain("Reconnect to create or rotate a guest link.");
  expect(to("/api/owner/token")).toHaveLength(0);
});

test("a read after reconnecting that shows another version clears the reveal and says it was replaced", async () => {
  serve({
    "/api/owner/page": [page(), page(), page({ link: { ...UNSHOWN, version: 5 } })],
    "/api/owner/token": [issued(1)],
    "/api/owner/token/shown": [ok({ shown: true })],
  });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("reveal-title");
  offline(true);
  await expect.poll(() => has("share-offline-reason")).toBe(true);
  offline(false);
  await expect.poll(status).toContain("This link was replaced in another tab and no longer works.");
  expect(has("reveal-link")).toBe(false);
  expect(text()).not.toContain(TOKEN);
  await focused("share-rotate");
});

test("a failed O8 read offers Try again; a Private page says so on O8", async () => {
  serve({ "/api/owner/page": [page({ visibility: "private" }), "network", page({ visibility: "private" })] });
  owner();
  await shown("share-entry");
  await userEvent.click(byId("share-entry"));
  await focused("share-retry");
  expect(text()).toContain("Couldn’t load this. Try again.");
  await userEvent.click(byId("share-retry"));
  await shown("share-private");
  expect(byId("share-private").textContent).toContain("Your page is Private.");
  expect(byId("share-private").textContent).toContain("Guests can't open the page, even with a link.");
});

test("a read that finds access lost while the link shows clears the reveal and any dialog", async () => {
  serve({ "/api/owner/page": [page(), page(), { status: 403 }], "/api/owner/token": [issued(1)], "/api/owner/token/shown": [ok({ shown: true })] });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("reveal-title");
  await userEvent.click(byId("share-done"));
  await focused("dialog-cancel");
  offline(true);
  await shown("share-offline-reason");
  offline(false);
  await focused("share-logout");
  expect(has("reveal-link")).toBe(false);
  expect(byId<HTMLDialogElement>("share-dialog").open).toBe(false);
  expect(text()).not.toContain(TOKEN);
});

test("a replacing read closes an open leave dialog before focusing the main action", async () => {
  serve({
    "/api/owner/page": [page(), page(), page({ link: { ...UNSHOWN, version: 5 } })],
    "/api/owner/token": [issued(1)],
    "/api/owner/token/shown": [ok({ shown: true })],
  });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("reveal-title");
  await userEvent.click(byId("share-done"));
  await focused("dialog-cancel");
  offline(true);
  await shown("share-offline-reason");
  offline(false);
  await focused("share-rotate");
  expect(byId<HTMLDialogElement>("share-dialog").open).toBe(false);
});

test("on a Private page the reveal keeps the Private notice; its Visibility link asks first, then opens O9", async () => {
  serve({
    "/api/owner/page": [page({ visibility: "private" }), page({ visibility: "private" }), page({ visibility: "private", link: SHOWN })],
    "/api/owner/token": [issued(1)],
    "/api/owner/token/shown": [ok({ shown: true })],
  });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("reveal-title");
  expect(byId("share-private").textContent).toContain("Your page is Private.");
  await userEvent.click(byId("share-visibility"));
  await focused("dialog-cancel");
  await userEvent.click(byId("dialog-cancel"));
  await focused("share-visibility");
  await userEvent.click(byId("share-visibility"));
  await userEvent.click(byId("dialog-act"));
  await focused("visibility-title");
  expect(text()).not.toContain(TOKEN);
});

test("Back to O2 when its read fails focuses O2's recovery, not the page", async () => {
  serve({ "/api/owner/page": [page(), page()] });
  owner();
  await openShare();
  offline(true);
  await shown("share-offline-reason");
  await userEvent.click(byId("share-back"));
  await expect.poll(() => document.activeElement?.textContent ?? "").toContain("Couldn’t load this.");
});

test("a QR finished after the reveal ended is neither saved nor reported as failed", async () => {
  serve({ "/api/owner/page": [page(), page(), page({ link: SHOWN })], "/api/owner/token": [issued(1)], "/api/owner/token/shown": [ok({ shown: true })] });
  let finish: ((blob: Blob | null) => void) | null = null;
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => (finish = cb));
  const saves = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("reveal-title");
  byId("share-download").click();
  await userEvent.click(byId("share-done"));
  await userEvent.click(byId("dialog-act"));
  await focused("share-rotate");
  finish!(new Blob(["x"], { type: "image/png" }));
  await new Promise((r) => setTimeout(r, 50));
  expect(saves).not.toHaveBeenCalled();
  expect(text()).not.toContain("The QR couldn't be saved");
});

test("hiding the page clears the link; a back-forward restore and a refused acknowledgement read the metadata again", async () => {
  serve({
    "/api/owner/page": [page(), page(), page({ link: { ...SHOWN, version: 2 } }), page({ link: { ...SHOWN, version: 2 } })],
    "/api/owner/token": [issued(1)],
    "/api/owner/token/shown": [ok({ shown: false })],
  });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await expect.poll(() => to("/api/owner/page").length).toBe(3); // the refused acknowledgement's read
  await shown("share-rotate"); // that read showed another version: the reveal ended
  dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  await expect.poll(() => to("/api/owner/page").length).toBe(4);

  root!.unmount();
  host.remove();
  serve({ "/api/owner/page": [page(), page()], "/api/owner/token": [issued(1)], "/api/owner/token/shown": [ok({ shown: true })] });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("reveal-title");
  dispatchEvent(new PageTransitionEvent("pagehide"));
  await expect.poll(() => has("reveal-link")).toBe(false);
  expect(text()).not.toContain(TOKEN);
});

test("an acknowledgement refused for lost access reads again, which clears the reveal", async () => {
  serve({ "/api/owner/page": [page(), page(), { status: 403 }], "/api/owner/token": [issued(1)], "/api/owner/token/shown": [{ status: 403 }] });
  owner();
  await openShare();
  await userEvent.click(byId("share-create"));
  await focused("share-logout");
  expect(has("reveal-link")).toBe(false);
  expect(text()).not.toContain(TOKEN);
});
