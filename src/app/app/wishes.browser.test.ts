import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import Owner from "./owner";
import { Wishes } from "./wishes";

vi.mock("next/navigation", () => {
  const router = { push: () => {} };
  const useRouter = () => router;
  return { useRouter, default: { useRouter } };
});

// O7 wish moderation in a real browser (owner UI O7; T3.2): the queue oldest first, the approved and rejected
// histories, Approve and Reject that move a wish only once the server confirms. Placeholder data only.
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const wish = (n: number, status = "pending", more: object = {}) => ({
  id: id(n), display_name: `[GUEST_${n}]`, body: `[WISH_${n}]\n[LINE_2]`, lang: n % 2 ? "vi" : "en", status, author_kind: "visitor",
  token_version: null, created_at: `2026-11-2${n % 10}T10:00:00.000000+00:00`, moderated_at: null, ...more,
});

type Reply = { status: number; body?: unknown } | "network";
type Queued = Reply | Promise<Reply>;
let calls: { url: string; body: Record<string, unknown> | null }[] = [];
function serve(routes: Record<string, Queued[]>) {
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
const entries = (...rows: object[]) => ok({ entries: rows });

let root: Root | null = null;
let host: HTMLElement;
const onBack = vi.fn();
const onSignedOut = vi.fn();
function mount() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(createElement(Wishes, { onBack, onSignedOut }));
}
afterEach(() => {
  root?.unmount();
  root = null;
  host.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const text = () => host.textContent ?? "";
const region = (role: string) => host.querySelector(`[role="${role}"]`)?.textContent ?? "";
const button = (label: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
const cards = () => [...host.querySelectorAll("article")];
const moderate = () => calls.filter((c) => c.url === "/api/owner/wishes/moderate");

test("the queue: each wish in full with name, language and time; Approve moves it and focus goes to the next", async () => {
  serve({
    "/api/owner/wishes": [entries(wish(1), wish(2))],
    "/api/owner/wishes/moderate": [ok({ status: "approved" })],
  });
  mount();
  await expect.poll(() => cards().length).toBe(2);
  expect(calls[0].body).toEqual({ status: "pending" });
  expect(document.activeElement).toBe(host.querySelector("h1"));
  const [first] = cards();
  const words = first.querySelector("blockquote")!;
  expect([words.lang, words.textContent]).toEqual(["vi", "[WISH_1]\n[LINE_2]"]); // the guest's words, never rewritten
  expect(first.textContent).toContain("[GUEST_1]");
  expect(first.textContent).toContain("Tiếng Việt");
  expect(text()).toContain("Only approved wishes appear on the guest page.");
  await userEvent.click(button("Approve", first));
  await expect.poll(() => cards().length).toBe(1);
  expect(moderate()[0].body).toEqual({ id: id(1), status: "approved", expected: "pending" });
  expect(region("status")).toContain("Wish approved.");
  expect(document.activeElement).toBe(button("Approve", cards()[0]));
});

test("the last wish moderated leaves All caught up, focused; Reject sends rejected", async () => {
  serve({ "/api/owner/wishes": [entries(wish(1))], "/api/owner/wishes/moderate": [ok({ status: "rejected" })] });
  mount();
  await expect.poll(() => cards().length).toBe(1);
  await userEvent.click(button("Reject", cards()[0]));
  await expect.poll(() => text()).toContain("All caught up");
  expect(moderate()[0].body).toEqual({ id: id(1), status: "rejected", expected: "pending" });
  expect(document.activeElement).toBe(host.querySelector("h2#wishes-empty"));
  expect(region("status")).toContain("Wish rejected.");
});

test("a failure keeps the wish where it was and says so; focus stays on its button", async () => {
  serve({ "/api/owner/wishes": [entries(wish(1))], "/api/owner/wishes/moderate": [{ status: 503 }, "network"] });
  mount();
  await expect.poll(() => cards().length).toBe(1);
  for (let n = 0; n < 2; n++) {
    await userEvent.click(button("Approve", cards()[0]));
    await expect.poll(() => region("alert")).toContain("Not saved. The wish keeps its previous status.");
    expect(cards()).toHaveLength(1);
    expect(document.activeElement).toBe(button("Approve", cards()[0]));
  }
});

test("a wish decided elsewhere first (409) or gone (404) re-reads the list and says the list was refreshed", async () => {
  serve({
    "/api/owner/wishes": [entries(wish(1), wish(2)), entries(wish(2)), entries()],
    "/api/owner/wishes/moderate": [{ status: 409, body: { error: "changed" } }, { status: 404, body: { error: "not_found" } }],
  });
  mount();
  await expect.poll(() => cards().length).toBe(2);
  await userEvent.click(button("Approve", cards()[0]));
  await expect.poll(() => cards().length).toBe(1);
  await expect.poll(() => region("alert")).toContain("This wish changed elsewhere. The list has been refreshed.");
  await userEvent.click(button("Reject", cards()[0]));
  await expect.poll(() => text()).toContain("All caught up");
  expect(calls.filter((c) => c.url === "/api/owner/wishes")).toHaveLength(3);
});

test("the histories: approved newest first offers Reject only, rejected offers Approve only; empty says so", async () => {
  serve({
    "/api/owner/wishes": [entries(), entries(wish(3, "approved")), entries()],
    "/api/owner/wishes/moderate": [ok({ status: "rejected" })],
  });
  mount();
  await expect.poll(() => text()).toContain("All caught up");
  await userEvent.click(button("Approved"));
  await expect.poll(() => cards().length).toBe(1);
  expect(calls[1].body).toEqual({ status: "approved" });
  expect(button("Approved").getAttribute("aria-pressed")).toBe("true");
  expect(button("Approve", cards()[0])).toBeUndefined();
  await userEvent.click(button("Reject", cards()[0]));
  await expect.poll(() => text()).toContain("Nothing in this view.");
  expect(moderate()[0].body).toEqual({ id: id(3), status: "rejected", expected: "approved" });
  expect(text()).not.toContain("All caught up");
});

test("Load more after a full page asks for the rows after the last one", async () => {
  const page = Array.from({ length: 50 }, (_, i) => wish(i + 1));
  serve({ "/api/owner/wishes": [entries(...page), entries(wish(51))] });
  mount();
  await expect.poll(() => cards().length).toBe(50);
  await userEvent.click(button("Load more"));
  await expect.poll(() => cards().length).toBe(51);
  expect(calls[1].body).toEqual({ status: "pending", after: { created_at: page[49].created_at, id: page[49].id } });
  expect(button("Load more")).toBeUndefined();
});

test("read failure offers Try again; signed out and access lost go their own way; offline disables moderation", async () => {
  serve({ "/api/owner/wishes": [{ status: 503 }, entries(wish(1)), { status: 401 }] });
  mount();
  await expect.poll(() => text()).toContain("Couldn’t load");
  expect(text()).not.toContain("All caught up"); // a list never read is never shown as empty
  await userEvent.click(button("Try again"));
  await expect.poll(() => cards().length).toBe(1);
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  dispatchEvent(new Event("offline"));
  await expect.poll(() => button("Approve", cards()[0]).disabled).toBe(true);
  delete (navigator as { onLine?: boolean }).onLine;
  dispatchEvent(new Event("online"));
  await expect.poll(() => button("Approve", cards()[0]).disabled).toBe(false);
  await userEvent.click(button("Rejected"));
  await expect.poll(() => onSignedOut.mock.calls.length).toBe(1);
  await userEvent.click(button("Back"));
  expect(onBack).toHaveBeenCalled();
});

// Third review (T3.2): paging after moderation, focus after Load more and after a failed re-read, Back with no card.
test("moderating every wish of a full page reads the queue again instead of saying All caught up", async () => {
  const page = Array.from({ length: 50 }, (_, i) => wish(i + 1));
  serve({ "/api/owner/wishes": [entries(...page), entries(wish(51))], "/api/owner/wishes/moderate": page.map(() => ok({ status: "approved" })) });
  mount();
  await expect.poll(() => cards().length).toBe(50);
  for (let i = 0; i < 50; i++) {
    await expect.poll(() => button("Approve", cards()[0])?.disabled).toBe(false);
    button("Approve", cards()[0]).click();
    await expect.poll(() => moderate().length).toBe(i + 1);
  }
  await expect.poll(() => text()).toContain("[GUEST_51]");
  expect(text()).not.toContain("All caught up");
  await expect.poll(() => document.activeElement).toBe(button("Approve", cards()[0]));
  expect(calls.filter((c) => c.url === "/api/owner/wishes")[1].body).toEqual({ status: "pending" });
});

test("Load more says Loading, keeps focus on itself while it stays, and after a failed read", async () => {
  const first = Array.from({ length: 50 }, (_, i) => wish(i + 1));
  const second = Array.from({ length: 50 }, (_, i) => wish(i + 51));
  let release = () => {};
  const held = new Promise<Reply>((r) => (release = () => r(entries(...second))));
  serve({ "/api/owner/wishes": [entries(...first), { status: 503 }] });
  const plain = vi.mocked(fetch).getMockImplementation()!;
  let n = 0;
  vi.mocked(fetch).mockImplementation(async (url, init) => {
    if (url === "/api/owner/wishes" && ++n === 2) {
      calls.push({ url: String(url), body: JSON.parse(String(init!.body)) });
      const r = (await held) as { status: number; body: unknown };
      return new Response(JSON.stringify(r.body), { status: r.status });
    }
    return plain(url, init);
  });
  mount();
  await expect.poll(() => cards().length).toBe(50);
  await userEvent.click(button("Load more"));
  await expect.poll(() => region("status")).toBe("Loading… / Đang tải…");
  release();
  await expect.poll(() => cards().length).toBe(100);
  expect(document.activeElement).toBe(button("Load more"));
  await userEvent.click(button("Load more"));
  await expect.poll(() => region("alert")).not.toBe("");
  expect(document.activeElement).toBe(button("Load more"));
});

test("a re-read after a conflict that fails puts focus on Try again", async () => {
  serve({ "/api/owner/wishes": [entries(wish(1)), { status: 503 }], "/api/owner/wishes/moderate": [{ status: 409, body: { error: "changed" } }] });
  mount();
  await expect.poll(() => cards().length).toBe(1);
  await userEvent.click(button("Approve", cards()[0]));
  await expect.poll(() => button("Try again")).toBeTruthy();
  expect(document.activeElement).toBe(button("Try again"));
});

test("Back from O7 when the card is gone (Wishes off, nothing pending) still puts focus on O2", async () => {
  const page = { version: 2, theme: "a_dreamy", default_lang: "en", label_a: "[PARTNER_A]", label_b: "[PARTNER_B]", timezone: "UTC", visibility: "token_only", setup_completed: true, sections: [], vanity_name: null, link: null, storage_used_bytes: 0, storage_budget_bytes: 1 };
  serve({
    "/api/owner/page": [ok({ page: { ...page, pending_wishes: 1 }, drafts: null }), ok({ page: { ...page, pending_wishes: 0 }, drafts: null })],
    "/api/owner/home/get": [ok({ home: null }), ok({ home: null })],
    "/api/owner/wishes": [entries(wish(1))],
    "/api/owner/wishes/moderate": [ok({ status: "approved" })],
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(createElement(Owner));
  await expect.poll(() => button("Review wishes")).toBeTruthy();
  await userEvent.click(button("Review wishes"));
  await expect.poll(() => cards().length).toBe(1);
  await userEvent.click(button("Approve", cards()[0]));
  await expect.poll(() => text()).toContain("All caught up");
  await userEvent.click(button("Back"));
  await expect.poll(() => calls.filter((c) => c.url === "/api/owner/page").length).toBe(2);
  await expect.poll(() => host.querySelector("#wishes-card")).toBeNull();
  await expect.poll(() => document.activeElement?.tagName).toBe("H1");
});

// Fix re-review (T3.2): a re-read never takes focus the owner moved; no stale buttons while it runs; Try again.
const hold = () => {
  let release!: (r: Reply) => void;
  return { promise: new Promise<Reply>((r) => (release = r)), release };
};
const fullPage = () => Array.from({ length: 50 }, (_, i) => wish(i + 1));
async function emptyAll(n: number) {
  for (let i = 0; i < n; i++) {
    await expect.poll(() => button("Approve", cards()[0])?.disabled).toBe(false);
    button("Approve", cards()[0]).click();
    await expect.poll(() => moderate().length).toBe(i + 1);
  }
}

test("a slow re-read after the page was emptied leaves focus where the owner moved it", async () => {
  const later = hold();
  const page = fullPage();
  serve({ "/api/owner/wishes": [entries(...page), later.promise], "/api/owner/wishes/moderate": page.map(() => ok({ status: "approved" })) });
  mount();
  await expect.poll(() => cards().length).toBe(50);
  await emptyAll(50);
  await expect.poll(() => cards().length).toBe(0);
  button("Back").focus();
  later.release(entries(wish(51)));
  await expect.poll(() => cards().length).toBe(1);
  expect(document.activeElement).toBe(button("Back"));
});

test("an emptied page whose re-read finds nothing focuses All caught up; one that loses access focuses Log out", async () => {
  const page = fullPage();
  serve({ "/api/owner/wishes": [entries(...page), entries()], "/api/owner/wishes/moderate": page.map(() => ok({ status: "approved" })) });
  mount();
  await expect.poll(() => cards().length).toBe(50);
  await emptyAll(50);
  await expect.poll(() => document.activeElement?.id).toBe("wishes-empty");
  root?.unmount();
  host.remove();
  serve({ "/api/owner/wishes": [entries(wish(1)), { status: 403 }], "/api/owner/wishes/moderate": [{ status: 409, body: { error: "changed" } }] });
  mount();
  await expect.poll(() => cards().length).toBe(1);
  await userEvent.click(button("Approve", cards()[0]));
  await expect.poll(() => document.activeElement?.textContent).toMatch(/Log out/);
});

test("while a conflict re-read runs, the old wishes offer no buttons", async () => {
  const later = hold();
  serve({ "/api/owner/wishes": [entries(wish(1), wish(2)), later.promise], "/api/owner/wishes/moderate": [{ status: 409, body: { error: "changed" } }] });
  mount();
  await expect.poll(() => cards().length).toBe(2);
  await userEvent.click(button("Approve", cards()[0]));
  await expect.poll(() => moderate().length).toBe(1);
  await expect.poll(() => cards().length).toBe(0);
  later.release(entries(wish(2)));
  await expect.poll(() => cards().length).toBe(1);
  expect(document.activeElement).toBe(button("Approve", cards()[0]));
});

test("Try again after a failed read puts focus on the first wish once it loads", async () => {
  serve({ "/api/owner/wishes": [{ status: 503 }, entries(wish(1))] });
  mount();
  await expect.poll(() => button("Try again")).toBeTruthy();
  await userEvent.click(button("Try again"));
  await expect.poll(() => cards().length).toBe(1);
  await expect.poll(() => document.activeElement).toBe(button("Approve", cards()[0]));
});
