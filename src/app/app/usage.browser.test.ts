import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { usageDate, type Usage } from "@/lib/usage";
import Owner from "./owner";

vi.mock("next/navigation", () => {
  const router = { push: () => {} };
  const useRouter = () => router;
  return { useRouter, default: { useRouter } };
});

// O10 Usage and the O2 attention line in a real browser (owner UI "O10 Usage and the O2 attention line for T2.5";
// PRD Q145 9, 13-16; E23, E24). fetch answers each route from a queue. Placeholder data only.
const MIB = 1048576;
const READ_AT = "2026-03-10T12:00:00.000Z";
const ago = (hours: number) => new Date(Date.parse(READ_AT) - hours * 3600000).toISOString();
const USAGE: Usage = {
  total_bytes: 120 * MIB, budget_bytes: 900 * MIB, uploading_bytes: 0, deleting_bytes: 0, read_at: READ_AT,
  page_created_at: "2025-01-01T03:00:00+00:00", timezone: "UTC", last_attempt_at: ago(9), last_attempt_result: "200",
  last_success_at: ago(9), last_success_corrections: 0, has_run: true,
};
const MISSED = { last_attempt_at: ago(30), last_success_at: ago(30) };
const PAGE = { version: 2, theme: "a_dreamy", default_lang: "en", label_a: "[PARTNER_A]", label_b: "[PARTNER_B]", timezone: "UTC", visibility: "token_only", setup_completed: true, sections: [], vanity_name: null, link: null, storage_used_bytes: 0, storage_budget_bytes: 1 };

type Reply = { status: number; body?: unknown } | "network";
let calls: string[] = [];
let routes: Record<string, (Reply | Promise<Reply>)[]> = {};
function serve(usage: (Reply | Promise<Reply>)[]) {
  calls = [];
  routes = { "/api/owner/page": [ok({ page: PAGE, drafts: null })], "/api/owner/usage": usage };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      const reply = url === "/api/owner/home/get" ? ok({ home: null }) : await routes[url]?.shift();
      if (!reply || reply === "network") throw new TypeError(`no answer for ${url}`);
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status });
    }),
  );
}
const ok = (body: unknown): Reply => ({ status: 200, body });
const usage = (fields: Partial<Usage> = {}) => ok({ usage: { ...USAGE, ...fields } });
const reads = () => calls.filter((c) => c === "/api/owner/usage").length;
const held = () => {
  let release!: (r: Reply) => void;
  return { promise: new Promise<Reply>((r) => (release = r)), release };
};

let root: Root | null = null;
let host: HTMLElement;
afterEach(() => {
  root?.unmount();
  root = null;
  host.remove();
  vi.unstubAllGlobals();
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
function offline(on: boolean) {
  if (on) Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  else delete (navigator as { onLine?: boolean }).onLine;
  dispatchEvent(new Event(on ? "offline" : "online"));
}
async function openUsage(from = "usage-entry-link") {
  await shown(from);
  await userEvent.click(byId(from));
  await shown("usage-title");
}

test("O2 shows Storage used of budget and no attention line; View usage opens O10 on its heading, Back returns focus", async () => {
  serve([usage(), usage()]);
  owner();
  await expect.poll(text).toContain("Storage 120 MB of 900 MB");
  expect(has("usage-attention")).toBe(false);
  await openUsage();
  expect(document.activeElement).toBe(byId("usage-title"));
  // O2's kept figures show (as last known) before O10's own read: wait for that read, not just the figures.
  await expect.poll(text).toContain(`Updated ${usageDate(READ_AT, "UTC", "en")}`);
  expect(text()).toContain("120 MB of 900 MB used");
  expect(byId("storage-amount").textContent).toMatch(/\(13%\)$/);
  expect(byId("usage-meter").getAttribute("aria-valuenow")).toBe("13");
  expect(text()).toContain("Completed successfully.");
  expect(text()).toContain(`Last successful run: ${usageDate(ago(9), "UTC", "en")} (page time zone)`);
  // Egress is never measured: the quota and a link out (Q145 1, 17).
  const link = byId<HTMLAnchorElement>("usage-supabase");
  expect(link.href).toBe("https://supabase.com/dashboard/org/_/usage");
  expect(link.target).toBe("_blank");
  expect(link.textContent).toContain("opens in a new tab");
  expect(text()).toContain("Free monthly quota: 5\u00a0GB (whole Supabase organisation)");
  expect(host.querySelectorAll('[role="status"]')).toHaveLength(1);
  await userEvent.click(byId("usage-back"));
  await shown("usage-entry-link");
  expect(document.activeElement).toBe(byId("usage-entry-link"));
});

test("the attention line shows only the highest condition; O10 puts a missed job first with what to do", async () => {
  serve([usage({ total_bytes: 720 * MIB, ...MISSED }), usage({ total_bytes: 720 * MIB, ...MISSED })]);
  owner();
  await shown("usage-attention");
  expect(byId("usage-attention").textContent).toContain("No successful daily job in the last 26\u00a0hours.");
  expect(byId("usage-attention").textContent).not.toContain("80%");
  // Static on load, not a live alert (Q145 15).
  expect(byId("usage-attention").closest('[role="alert"], [role="status"], [aria-live]')).toBeNull();
  await openUsage("usage-attention-link");
  await expect.poll(text).toContain("What to do");
  const panels = [...host.querySelectorAll("#usage-body h2")].map((h) => h.id);
  expect(panels).toEqual(["job-title", "storage-title", "egress-title"]);
  expect(text()).toContain("Storage is at 80%."); // exactly 80 %: O6's line, as the boards (over 80 % reads "over")
  expect(text()).toContain("Open your Vercel project’s cron log.");
  await userEvent.click(byId("usage-back"));
  await shown("usage-attention-link");
  expect(document.activeElement).toBe(byId("usage-attention-link"));
  expect(byId("usage-attention").textContent).toContain("No successful daily job");
});

test("a failed O2 read says Usage unavailable with its own Try again, never a zero; Try again announces Usage updated", async () => {
  serve(["network", usage()]);
  owner();
  await shown("usage-retry");
  expect(byId("usage-card").textContent).toContain("Usage unavailable");
  expect(byId("usage-card").textContent).not.toContain("0 MB");
  expect(has("home-action")).toBe(true); // the Home card is independent
  await userEvent.click(byId("usage-retry"));
  await expect.poll(text).toContain("Storage 120 MB of 900 MB");
  expect(status()).toContain("Usage updated");
});

test("Refresh on O10 announces once with a higher attention; focus stays on Refresh", async () => {
  serve([usage(), usage(), usage({ last_attempt_at: ago(1), last_attempt_result: "503" })]);
  owner();
  await openUsage();
  await expect.poll(text).toContain("Completed successfully.");
  byId("usage-refresh").focus();
  await userEvent.click(byId("usage-refresh"));
  await expect.poll(status).toContain("Usage updated");
  expect(status()).toContain("Higher-priority attention: The last daily job failed.");
  expect(document.activeElement).toBe(byId("usage-refresh"));
  expect(text()).toContain("The last daily job failed. Files may wait longer to be deleted.");
});

test("an expired session: no figures, sign in in a new tab, then Try again resumes", async () => {
  serve([usage(), { status: 401 }, usage()]);
  owner();
  await openUsage();
  await shown("usage-signin");
  expect(text()).toContain("Your session expired. Sign in again in a new tab");
  expect(text()).not.toContain("MB");
  const signin = byId<HTMLAnchorElement>("usage-signin");
  expect(signin.target).toBe("_blank");
  expect(signin.getAttribute("href")).toBe("/login?next=%2Fapp");
  await userEvent.click(byId("usage-retry"));
  await expect.poll(text).toContain("120 MB of 900 MB used");
});

test("access lost: no figures on O10 or back on O2 until an authorized read; Log out is offered", async () => {
  serve([usage({ total_bytes: 720 * MIB }), { status: 403 }, { status: 403 }]);
  owner();
  await shown("usage-attention");
  await openUsage();
  await shown("usage-logout");
  expect(text()).toContain("Access is no longer available.");
  expect(text()).not.toContain("MB");
  await userEvent.click(byId("usage-back"));
  await shown("usage-entry-link");
  await expect.poll(reads).toBe(3);
  expect(has("usage-attention")).toBe(false);
  expect(byId("usage-card").textContent).not.toContain("MB");
});

test("offline keeps the numbers with their time; Refresh stays focusable, says why, and sends nothing", async () => {
  serve([usage(), usage()]);
  owner();
  await openUsage();
  await expect.poll(text).toContain("120 MB of 900 MB used");
  offline(true);
  await expect.poll(text).toContain(`Offline, numbers from ${usageDate(READ_AT, "UTC", "en")}`);
  const refresh = byId<HTMLButtonElement>("usage-refresh");
  expect(refresh.disabled).toBe(false);
  expect(refresh.getAttribute("aria-disabled")).toBe("true");
  expect(byId(refresh.getAttribute("aria-describedby")!).textContent).toContain("Reconnect to refresh.");
  refresh.click(); // Playwright will not press an aria-disabled control; a keyboard or screen-reader user can
  expect(reads()).toBe(2);
  await expect.poll(status).toContain("Reconnect to refresh.");
  expect(text()).toContain("120 MB of 900 MB used");
});

test("a read cut short by going offline is dropped", async () => {
  const late = held();
  serve([usage(), usage(), late.promise]);
  owner();
  await openUsage();
  await expect.poll(text).toContain("120 MB of 900 MB used");
  await userEvent.click(byId("usage-refresh"));
  offline(true);
  late.release(usage({ total_bytes: 800 * MIB }));
  await new Promise((r) => setTimeout(r, 50));
  expect(text()).toContain("120 MB of 900 MB used");
  expect(text()).not.toContain("800 MB");
});

test("storage full links to Content; no allowance has its own message and no Content link", async () => {
  serve([usage({ total_bytes: 900 * MIB }), usage({ total_bytes: 900 * MIB })]);
  owner();
  await expect.poll(() => byId("usage-attention")?.textContent).toContain("Storage is full.");
  await openUsage();
  await expect.poll(text).toContain("Removed files still count until the daily job deletes them.");
  await userEvent.click(byId("usage-content"));
  await expect.poll(() => has("usage-title")).toBe(false);
  root!.unmount();
  host.remove();

  serve([usage({ budget_bytes: 0, total_bytes: 0 }), usage({ budget_bytes: 0, total_bytes: 0 })]);
  owner();
  await expect.poll(() => byId("usage-attention")?.textContent).toContain("This page has no storage allowance.");
  await openUsage();
  await expect.poll(text).toContain("Uploads are unavailable.");
  expect(has("usage-content")).toBe(false);
});

test("held amounts show separately and are said to be included in the total; tiny amounts read <1 MB", async () => {
  serve([usage({ uploading_bytes: 18 * MIB, deleting_bytes: 1000 }), usage({ uploading_bytes: 18 * MIB, deleting_bytes: 1000 })]);
  owner();
  await openUsage();
  await expect.poll(text).toContain("Uploading: 18 MB");
  expect(text()).toContain("Waiting to be deleted: <1 MB");
  expect(text()).toContain("included in the total above");
});

// Review fixes (reviewer, T2.5b).

test("opening O10 offline keeps the shared figures labelled offline: no read, no error, Refresh still focusable", async () => {
  serve([usage()]);
  owner();
  await expect.poll(text).toContain("Storage 120 MB of 900 MB");
  offline(true);
  await openUsage();
  expect(reads()).toBe(1);
  await expect.poll(text).toContain(`Offline, numbers from ${usageDate(READ_AT, "UTC", "en")}`);
  expect(text()).not.toContain("Usage unavailable");
  expect(byId("usage-refresh").getAttribute("aria-disabled")).toBe("true");
});

test("offline before any read: O10 shows the offline reason without figures, and reconnecting starts the first read", async () => {
  const first = held();
  serve([first.promise, usage()]);
  owner();
  await shown("usage-entry-link").catch(() => {}); // View usage waits for the first read (Q145 boards)
  offline(true);
  first.release(usage());
  await shown("usage-entry-link");
  await openUsage();
  await expect.poll(text).toContain("You’re offline.");
  expect(text()).not.toContain("Usage unavailable");
  offline(false);
  await expect.poll(text).toContain("120 MB of 900 MB used");
  expect(reads()).toBe(2);
});

test("View usage waits for the first read; opening O10 while O2 reads sends one more read only", async () => {
  const first = held();
  serve([first.promise, usage()]);
  owner();
  await expect.poll(text).toContain("Loading…");
  expect(has("usage-entry-link")).toBe(false);
  first.release(usage());
  await openUsage();
  await expect.poll(text).toContain("120 MB of 900 MB used");
  await new Promise((r) => setTimeout(r, 50));
  expect(reads()).toBe(2);
});

test("a second press of a blocked control repeats its reason", async () => {
  serve([usage(), usage()]);
  owner();
  await openUsage();
  await expect.poll(text).toContain("120 MB of 900 MB used");
  offline(true);
  await expect.poll(text).toContain("Offline, numbers from");
  const said: string[] = [];
  new MutationObserver(() => said.push(status())).observe(host.querySelector('[role="status"]')!, { childList: true, subtree: true, characterData: true });
  byId("usage-refresh").click();
  await expect.poll(status).toContain("Reconnect to refresh.");
  byId("usage-refresh").click();
  await expect.poll(() => said.filter((s) => s.includes("Reconnect to refresh.")).length).toBe(2);
});

test("an expired session stays one through a failed Try again; reconnecting says the connection is back and the session still needs sign-in", async () => {
  serve([usage(), { status: 401 }, "network"]);
  owner();
  await openUsage();
  await shown("usage-signin");
  await userEvent.click(byId("usage-retry"));
  await expect.poll(reads).toBe(3);
  await new Promise((r) => setTimeout(r, 50));
  expect(text()).toContain("Your session expired.");
  expect(has("usage-signin")).toBe(true);
  offline(true);
  // Offline, the link keeps its href; a press (Enter or tap) only repeats the reason.
  await expect.poll(() => byId("usage-signin").getAttribute("aria-disabled")).toBe("true");
  const link = byId<HTMLAnchorElement>("usage-signin");
  expect(link.getAttribute("href")).toBe("/login?next=%2Fapp");
  link.focus();
  await userEvent.keyboard("{Enter}");
  await expect.poll(status).toContain("Reconnect to sign in.");
  offline(false);
  await expect.poll(status).toContain("Connection restored.");
  expect(status()).toContain("Your session expired.");
});

test("Try again on O10 keeps the recovery panel while it runs; a failed read keeps figures marked last known", async () => {
  const retry = held();
  serve([usage(), usage(), "network", retry.promise]);
  owner();
  await openUsage();
  await expect.poll(text).toContain("Completed successfully.");
  await userEvent.click(byId("usage-refresh"));
  await shown("usage-retry");
  expect(text()).toContain(`Last known numbers from ${usageDate(READ_AT, "UTC", "en")}`);
  expect(text()).not.toContain("Updated ");
  await userEvent.click(byId("usage-retry"));
  expect(has("usage-retry")).toBe(true);
  expect(document.activeElement).toBe(byId("usage-retry"));
  retry.release(usage());
  await expect.poll(() => has("usage-retry")).toBe(false);
});

test("on phones the panels read in the order they show: storage, egress, then the daily job", async () => {
  serve([usage(), usage()]);
  owner();
  await openUsage();
  await expect.poll(() => host.querySelectorAll("#usage-body h2").length).toBe(3);
  expect([...host.querySelectorAll("#usage-body h2")].map((h) => h.id)).toEqual(["storage-title", "egress-title", "job-title"]);
});

test("O2: reconnecting with figures does not re-read; a usage message is not read again with the Home card's", async () => {
  serve(["network", usage()]);
  owner();
  await shown("usage-retry");
  await userEvent.click(byId("usage-retry"));
  await expect.poll(status).toContain("Usage updated");
  offline(true);
  await new Promise((r) => setTimeout(r, 50));
  offline(false);
  await new Promise((r) => setTimeout(r, 50));
  expect(reads()).toBe(2);
  expect(status()).not.toContain("Usage updated");
});

test("O2: reconnecting after a failed read keeps Try again and its focus; a return read that clears the line moves focus to the card", async () => {
  serve(["network"]);
  owner();
  await shown("usage-retry");
  offline(true);
  byId("usage-retry").focus();
  await new Promise((r) => setTimeout(r, 50));
  offline(false);
  await new Promise((r) => setTimeout(r, 50));
  expect(reads()).toBe(1);
  expect(document.activeElement).toBe(byId("usage-retry"));
  root!.unmount();
  host.remove();

  const back = held();
  serve([usage({ total_bytes: 720 * MIB }), usage({ total_bytes: 720 * MIB }), back.promise]);
  owner();
  await openUsage("usage-attention-link");
  await expect.poll(text).toContain("120 MB".replace("120", "720"));
  await userEvent.click(byId("usage-back"));
  await shown("usage-attention-link");
  expect(document.activeElement).toBe(byId("usage-attention-link"));
  back.release(usage());
  await expect.poll(() => has("usage-attention")).toBe(false);
  await expect.poll(() => document.activeElement?.id).toBe("usage-entry-link");
});

// Re-review fixes (reviewer, T2.5b).

test("after a reconnect the kept figures stay labelled last known until a fresh read, on the card and the attention line", async () => {
  serve([usage({ total_bytes: 720 * MIB })]);
  owner();
  await shown("usage-attention");
  offline(true);
  await new Promise((r) => setTimeout(r, 50));
  offline(false);
  await new Promise((r) => setTimeout(r, 50));
  expect(byId("usage-card").textContent).toContain(`Last known numbers from ${usageDate(READ_AT, "UTC", "en")}`);
  expect(byId("usage-attention").textContent).toContain("Last known: Storage has reached 80%.");
});

test("a second press of Try again while the first runs keeps the recovery panel and its focus", async () => {
  const first = held();
  const second = held();
  serve([usage(), "network", first.promise, second.promise]);
  owner();
  await openUsage();
  await shown("usage-retry");
  await userEvent.click(byId("usage-retry"));
  await userEvent.click(byId("usage-retry"));
  expect(has("usage-retry")).toBe(true);
  expect(document.activeElement).toBe(byId("usage-retry"));
  second.release(usage());
  await expect.poll(() => has("usage-retry")).toBe(false);
});

test("a blocked press just before Back is not announced on O2", async () => {
  serve([usage(), usage()]);
  owner();
  await openUsage();
  await expect.poll(text).toContain("120 MB of 900 MB used");
  offline(true);
  await expect.poll(text).toContain("Offline, numbers from");
  byId("usage-refresh").click();
  byId("usage-back").click();
  await shown("usage-entry-link");
  await new Promise((r) => setTimeout(r, 100));
  expect(status()).not.toContain("Reconnect to refresh.");
});
