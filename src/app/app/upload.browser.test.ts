import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { MediaError, processPhoto, processVideo } from "@/lib/media";
import { Upload } from "./upload";

// O6 Upload in a real browser (owner UI "O6 Upload for T2.3b"; Q139; T2.3b). Processing is replaced (media.ts has its
// own browser tests), the storage PUTs go through a fake XMLHttpRequest, and each owner route answers from a queue.
// Placeholder data only.
vi.mock(import("@/lib/media"), async (original) => ({ ...(await original()), processPhoto: vi.fn(), processVideo: vi.fn() }));

const ITEM_ID = "00000000-0000-0000-0000-0000000000a1";
const M1 = "00000000-0000-0000-0000-0000000000d1";
const M2 = "00000000-0000-0000-0000-0000000000d2";
const MIB = 1048576;
const photoMedia = (i: number) => ({ id: `00000000-0000-0000-0000-0000000001${String(i).padStart(2, "0")}`, kind: "photo", position: i, width: 4, height: 3, duration_ms: null, alt: null, alt_alt: null, preview_url: null });
const item = (media: object[] = []) => ({ item: { id: ITEM_ID, version: 3, kind: "memory", status: "draft", lang: "vi", title: "Chuyến đi biển", media } });
const page = (used = 612 * MIB, budget = 900 * MIB) => ({ page: { storage_used_bytes: used, storage_budget_bytes: budget }, drafts: {} });
const begun = (media_id: string) => ({
  media_id,
  write_until: "2026-11-20T12:05:00Z",
  files: [
    { variant: "thumb", bucket: "media-thumb", path: `p/${media_id}/thumb`, max_bytes: 307200, token: "t", url: `https://storage.example/${media_id}/thumb?token=t` },
    { variant: "display", bucket: "media-display", path: `p/${media_id}/display`, max_bytes: 2097152, token: "d", url: `https://storage.example/${media_id}/display?token=d` },
  ],
});
const PREPARED = { thumb: new Blob(["t"], { type: "image/webp" }), display: new Blob(["display"], { type: "image/webp" }), width: 1600, height: 1200 };

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
const posted = (url: string) => calls.filter((c) => c.url === url);

// The storage PUTs: answered 200 at once unless `hold` is set, in which case the test answers them.
class FakeXHR {
  static all: FakeXHR[] = [];
  static hold = false;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown = null;
  status = 0;
  aborted = false;
  upload: { onprogress: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  send(body: unknown) {
    this.body = body;
    FakeXHR.all.push(this);
    if (!FakeXHR.hold) queueMicrotask(() => this.answer(200));
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ loaded, total, lengthComputable: true });
  }
  answer(status: number) {
    this.status = status;
    this.onload?.();
  }
  fail() {
    this.onerror?.();
  }
}
const lastPut = () => FakeXHR.all.at(-1)!;

let root: Root | null = null;
let host: HTMLElement;
const spoken: string[] = [];
let watch: MutationObserver;
beforeEach(() => {
  FakeXHR.all = [];
  FakeXHR.hold = false;
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
  vi.mocked(processPhoto).mockReset().mockResolvedValue(PREPARED);
  vi.mocked(processVideo).mockReset();
  spoken.length = 0;
  // Every text the polite region receives, to check each stage is announced once and no percent ever is.
  watch = new MutationObserver(() => {
    const text = host?.querySelector('[role="status"]')?.textContent ?? "";
    if (text && text !== spoken.at(-1)) spoken.push(text);
  });
  watch.observe(document.body, { childList: true, subtree: true, characterData: true });
});
afterEach(() => {
  watch.disconnect();
  root?.unmount();
  root = null;
  host.remove();
  vi.unstubAllGlobals();
});
function screen(props: Partial<Parameters<typeof Upload>[0]> = {}) {
  const onBack = vi.fn();
  const onSignedOut = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(createElement(Upload, { id: ITEM_ID, onBack, onSignedOut, ...props }));
  return { onBack, onSignedOut };
}

const text = () => host.textContent ?? "";
const region = (role: string) => host.querySelector(`[role="${role}"]`)?.textContent ?? "";
const button = (label: string, scope: ParentNode = host.querySelector("dialog[open]") ?? host) =>
  [...scope.querySelectorAll("button")].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;
const row = (name: string) => [...host.querySelectorAll("article")].find((a) => a.textContent?.includes(name)) as HTMLElement;
const picker = () => host.querySelector<HTMLInputElement>("#files")!;
const jpg = (name: string) => new File(["jpeg bytes"], name, { type: "image/jpeg" });
const mp4 = (name: string) => new File(["mp4 bytes"], name, { type: "video/mp4" });
async function ready() {
  await expect.poll(() => host.querySelector("#files")).toBeTruthy();
}
function offline(on: boolean) {
  if (on) Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  else delete (navigator as { onLine?: boolean }).onLine;
  dispatchEvent(new Event(on ? "offline" : "online"));
}

test("the screen reads the item and the page's storage: counts, server numbers and an empty queue", async () => {
  serve({ "/api/owner/item/get": [ok(item([photoMedia(0), photoMedia(1)]))], "/api/owner/page": [ok(page())] });
  screen();
  await ready();
  expect(posted("/api/owner/item/get")[0].body).toEqual({ id: ITEM_ID });
  expect(text()).toContain("Chuyến đi biển");
  expect(text()).toContain("Photos 2 of 24 · Video 0 of 1");
  expect(text()).toContain("612 MB of 900 MB used");
  expect(text()).toContain("No files yet. Choose photos or a video for this item.");
  expect(button("Start uploads").disabled).toBe(true);
  expect(document.activeElement).toBe(host.querySelector("h1"));
});

test("a photo goes from Waiting to Saved through the server, each stage announced once and no percent ever", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page()), ok(page(615 * MIB))],
    "/api/owner/upload/begin": [ok(begun(M1))],
    "/api/owner/upload/complete": [ok({ state: "ready" })],
  });
  FakeXHR.hold = true;
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  expect(row("photo-01.jpg").textContent).toContain("Waiting");
  expect(row("photo-01.jpg").textContent).toContain("Source size; prepared size appears after preparation.");
  expect(text()).toContain("Photos 1 of 24 · Video 0 of 1");
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => FakeXHR.all.length).toBe(1);
  expect(posted("/api/owner/upload/begin")[0].body).toEqual({ item_id: ITEM_ID, kind: "photo", variants: ["thumb", "display"] });
  expect(row("photo-01.jpg").textContent).toContain("Uploading");
  expect(row("photo-01.jpg").textContent).toContain("Location data removed");
  // Progress shows on the bar, named by the file; it is never announced.
  lastPut().progress(1, 2);
  await expect.poll(() => host.querySelector("progress")?.value).toBeGreaterThan(0);
  expect(host.querySelector("progress")?.getAttribute("aria-labelledby")).toBeTruthy();
  lastPut().answer(200);
  await expect.poll(() => FakeXHR.all.length).toBe(2);
  lastPut().answer(200);
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Saved");
  // Each file goes to its own signed URL, as a plain PUT with its type and an explicit cache lifetime.
  expect(FakeXHR.all.map((x) => [x.method, x.url])).toEqual([
    ["PUT", `https://storage.example/${M1}/thumb?token=t`],
    ["PUT", `https://storage.example/${M1}/display?token=d`],
  ]);
  expect(FakeXHR.all[1].body).toBe(PREPARED.display);
  expect(FakeXHR.all[1].headers).toEqual({ "content-type": "image/webp", "cache-control": "max-age=3600" });
  expect(posted("/api/owner/upload/complete")[0].body).toEqual({ media_id: M1, width: 1600, height: 1200, duration_ms: null });
  // The storage numbers are read again from the server, never estimated.
  await expect.poll(() => text()).toContain("615 MB of 900 MB used");
  expect(text()).toContain("All files are confirmed. Return to the item to continue editing.");
  expect(spoken.filter((s) => s.includes("photo-01.jpg"))).toEqual([
    "photo-01.jpg: Preparing photo… / Đang chuẩn bị ảnh…",
    "photo-01.jpg: Photo prepared / Đã chuẩn bị ảnh",
    "photo-01.jpg: Uploading / Đang tải lên",
    "photo-01.jpg: Confirming with the server… / Đang xác nhận với máy chủ…",
    "photo-01.jpg: Saved / Đã lưu",
  ]);
  expect(spoken.some((s) => s.includes("%"))).toBe(false);
});

test("a video is prepared, uploaded with its poster and thumb, and confirmed with its length", async () => {
  vi.mocked(processVideo).mockResolvedValue({
    thumb: new Blob(["t"], { type: "image/webp" }),
    poster: new Blob(["p"], { type: "image/webp" }),
    video: new Blob(["v"], { type: "video/mp4" }),
    width: 1280,
    height: 720,
    duration_ms: 4200,
  });
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page()), ok(page())],
    "/api/owner/upload/begin": [
      ok({ ...begun(M1), files: [{ variant: "video", url: "https://storage.example/v" }, { variant: "poster", url: "https://storage.example/p" }, { variant: "thumb", url: "https://storage.example/t" }] }),
    ],
    "/api/owner/upload/complete": [ok({ state: "ready" })],
  });
  screen();
  await ready();
  await userEvent.upload(picker(), mp4("video-01.mp4"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => row("video-01.mp4").textContent).toContain("Saved");
  expect(posted("/api/owner/upload/begin")[0].body).toEqual({ item_id: ITEM_ID, kind: "video", variants: ["thumb", "poster", "video"] });
  expect(FakeXHR.all.map((x) => x.headers["content-type"])).toEqual(["video/mp4", "image/webp", "image/webp"]);
  expect(posted("/api/owner/upload/complete")[0].body).toEqual({ media_id: M1, width: 1280, height: 720, duration_ms: 4200 });
  expect(row("video-01.mp4").textContent).not.toContain("Location data removed"); // the note belongs to photos
});

test("the 25th photo and the 2nd video are refused by name; the rest are added", async () => {
  serve({ "/api/owner/item/get": [ok(item(Array.from({ length: 23 }, (_, i) => photoMedia(i))))], "/api/owner/page": [ok(page())] });
  screen();
  await ready();
  await userEvent.upload(picker(), [jpg("photo-24.jpg"), jpg("photo-25.jpg"), mp4("video-01.mp4"), mp4("video-02.mp4")]);
  expect(row("photo-24.jpg")).toBeTruthy();
  expect(row("video-01.mp4")).toBeTruthy();
  expect(row("photo-25.jpg")).toBeUndefined();
  expect(text()).toContain("photo-25.jpg: Not added: the 24-photo limit has been reached.");
  expect(text()).toContain("video-02.mp4: Not added: the 1-video limit has been reached.");
  expect(region("alert")).toContain("photo-25.jpg");
  expect(text()).toContain("Photos 24 of 24 · Video 1 of 1");
});

test("a file the browser cannot read, a HEIC and an oversize video each say why, and offer Remove only", async () => {
  vi.mocked(processPhoto).mockRejectedValueOnce(new MediaError("unsupported")).mockRejectedValueOnce(new MediaError("unsupported"));
  vi.mocked(processVideo).mockRejectedValue(new MediaError("too_large"));
  serve({ "/api/owner/item/get": [ok(item())], "/api/owner/page": [ok(page())] });
  screen();
  await ready();
  await userEvent.upload(picker(), [jpg("broken.jpg"), new File(["heic"], "photo-01.heic", { type: "image/heic" }), mp4("long.mp4")]);
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => row("long.mp4").textContent).toContain("Video is over 50 MB after compression. Trim it or pick a shorter clip.");
  expect(row("broken.jpg").textContent).toContain("Can’t read this file. Save as JPEG/PNG or MP4, or try another browser.");
  expect(row("photo-01.heic").textContent).toContain("Can’t read this HEIC file. Save as JPEG/PNG, or try another browser.");
  for (const name of ["broken.jpg", "photo-01.heic", "long.mp4"]) {
    expect(button("Remove", row(name)), name).toBeTruthy();
    expect(button("Try again", row(name)), name).toBeUndefined();
  }
  expect(posted("/api/owner/upload/begin")).toHaveLength(0);
});

test("an interrupted upload: Try again cancels the old reservation and uploads the prepared file again", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page()), ok(page()), ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1)), ok(begun(M2))],
    "/api/owner/upload/cancel": [ok()],
    "/api/owner/upload/complete": [ok({ state: "ready" })],
  });
  FakeXHR.hold = true;
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => FakeXHR.all.length).toBe(1);
  lastPut().fail();
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Upload interrupted or expired. Try again to restart the upload.");
  expect(document.activeElement).not.toBe(button("Try again", row("photo-01.jpg"))); // a failing row never takes focus
  FakeXHR.hold = false;
  await userEvent.click(button("Try again", row("photo-01.jpg")));
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Saved");
  expect(posted("/api/owner/upload/cancel")[0].body).toEqual({ media_id: M1 });
  expect(posted("/api/owner/upload/complete")[0].body).toMatchObject({ media_id: M2 });
  expect(processPhoto).toHaveBeenCalledTimes(1);
});

test("Cancel during an upload stops it, tells the server, says when space is freed, and keeps focus on the row", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page()), ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1))],
    "/api/owner/upload/cancel": [ok()],
  });
  FakeXHR.hold = true;
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => FakeXHR.all.length).toBe(1);
  await userEvent.click(button("Cancel", row("photo-01.jpg")));
  expect(lastPut().aborted).toBe(true);
  await expect.poll(() => posted("/api/owner/upload/cancel").length).toBe(1);
  expect(posted("/api/owner/upload/cancel")[0].body).toEqual({ media_id: M1 });
  expect(row("photo-01.jpg").textContent).toContain("Canceled. Space is freed after cleanup.");
  // Cancel is gone; focus moves to the same row's next action.
  expect(document.activeElement).toBe(button("Try again", row("photo-01.jpg")));
});

test("not saved: Try again asks the server to confirm again rather than uploading the file twice", async () => {
  serve({
    "/api/owner/item/get": [ok(item()), ok(item([{ ...photoMedia(0), id: M1 }]))],
    "/api/owner/page": [ok(page()), ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1))],
    "/api/owner/upload/complete": [{ status: 503 }, { status: 404 }],
  });
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Not saved. The server or network could not confirm this file. Try again.");
  expect(button("Remove", row("photo-01.jpg"))).toBeUndefined();
  // Leaving would drop a file Try again may still confirm, so Back asks first.
  await userEvent.click(button("Back"));
  expect(host.querySelector("dialog[open]")?.textContent).toContain("Leave uploads?");
  await userEvent.keyboard("{Escape}");
  // The first confirmation went through after all: the reservation is gone (404) and the item holds the file.
  await userEvent.click(button("Try again", row("photo-01.jpg")));
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Saved");
  expect(posted("/api/owner/upload/begin")).toHaveLength(1);
  expect(FakeXHR.all).toHaveLength(2);
});

test("storage at 80 % warns; storage full refuses the upload, adds nothing and blocks adding", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page(720 * MIB))],
    "/api/owner/upload/begin": [{ status: 409, body: { error: "storage_full" } }],
  });
  screen();
  await ready();
  expect(text()).toContain("Storage is at 80%. Check page usage before adding more.");
  expect(text()).toContain("720 MB of 900 MB used");
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => region("alert")).toContain("Storage is full. Nothing was added.");
  expect(row("photo-01.jpg").textContent).toContain("Waiting");
  expect(picker().disabled).toBe(true);
  expect(button("Start uploads").disabled).toBe(true);
  expect(host.querySelector('a[href="#usage"]')?.textContent).toContain("View usage");
  // Reconnecting never lifts a storage block.
  offline(true);
  offline(false);
  expect(picker().disabled).toBe(true);
});

test("session expired: the queue is kept, uploads pause, sign-in opens a new tab, and Try again resumes", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page())],
    "/api/owner/upload/begin": [{ status: 401 }],
  });
  const { onSignedOut } = screen();
  await ready();
  await userEvent.upload(picker(), [jpg("photo-01.jpg"), jpg("photo-02.jpg")]);
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => region("alert")).toContain("Session expired.");
  expect(row("photo-01.jpg").textContent).not.toContain("Saved");
  expect(row("photo-02.jpg").textContent).toContain("Waiting");
  expect(picker().disabled).toBe(true);
  const signin = [...host.querySelectorAll("a")].find((a) => a.textContent?.includes("Sign in again"))!;
  expect([signin.getAttribute("href"), signin.target]).toEqual(["/login?next=%2Fapp", "_blank"]);
  expect(onSignedOut).not.toHaveBeenCalled();
  offline(true);
  offline(false);
  expect(picker().disabled).toBe(true); // reconnecting never lifts a session block
  serve({
    "/api/owner/page": [ok(page()), ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1)), ok(begun(M2))],
    "/api/owner/upload/complete": [ok({ state: "ready" }), ok({ state: "ready" })],
  });
  await userEvent.click(button("Try again", host.querySelector("#notice")!));
  await expect.poll(() => row("photo-02.jpg").textContent).toContain("Saved");
  expect(row("photo-01.jpg").textContent).toContain("Saved");
});

test("access lost offers Log out; a read failure offers Try again and reads again", async () => {
  serve({ "/api/owner/item/get": [{ status: 403 }], "/api/owner/page": [ok(page())] });
  screen();
  await expect.poll(() => text()).toContain("Access is no longer available.");
  expect(button("Log out")).toBeTruthy();
  expect(host.querySelector("#files")).toBeNull();
  root?.unmount();
  host.remove();

  serve({ "/api/owner/item/get": [{ status: 503 }, ok(item())], "/api/owner/page": [ok(page()), ok(page())] });
  screen();
  await expect.poll(() => text()).toContain("Couldn’t load this. Try again.");
  await userEvent.click(button("Try again"));
  await ready();
  expect(document.activeElement).not.toBe(document.body); // the recovery button's redraw does not drop focus
});

test("offline: the queue is kept, new uploads pause, and an interrupted upload resumes on reconnect", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page()), ok(page()), ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1)), ok(begun(M2))],
    "/api/owner/upload/cancel": [ok()],
    "/api/owner/upload/complete": [ok({ state: "ready" })],
  });
  FakeXHR.hold = true;
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => FakeXHR.all.length).toBe(1);
  try {
    offline(true);
    lastPut().fail();
    await expect.poll(() => text()).toContain("Queue kept. New uploads are paused; uploads resume when you reconnect.");
    expect(picker().disabled).toBe(true);
    expect(row("photo-01.jpg").textContent).toContain("Upload interrupted or expired.");
    FakeXHR.hold = false;
  } finally {
    offline(false);
  }
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Saved");
  expect(posted("/api/owner/upload/cancel")[0].body).toEqual({ media_id: M1 });
  // The interruption happened while offline and was never read out; reconnecting does not read it out late.
  expect(spoken.some((s) => s.includes("interrupted"))).toBe(false);
});

test("removing a saved file asks first and deletes it on the server; removing a waiting file just drops it", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page()), ok(page()), ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1))],
    "/api/owner/upload/complete": [ok({ state: "ready" })],
    "/api/owner/upload/delete": [ok()],
  });
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Saved");
  await userEvent.upload(picker(), [jpg("photo-02.jpg"), jpg("photo-03.jpg")]);
  await userEvent.click(button("Remove", row("photo-02.jpg")));
  expect(row("photo-02.jpg")).toBeUndefined();
  expect(host.querySelector("dialog[open]")).toBeNull();
  // The removed row took the focused button with it: focus goes to the selected file.
  expect(document.activeElement?.closest("article")).toBeTruthy();

  await userEvent.click(button("Remove", row("photo-01.jpg")));
  const dialog = host.querySelector("dialog[open]")!;
  expect(dialog.textContent).toContain("Remove this saved file?");
  expect(dialog.textContent).toContain("The file will be removed from this item. Space is freed after cleanup.");
  await userEvent.keyboard("{Escape}");
  expect(row("photo-01.jpg")).toBeTruthy();
  await expect.poll(() => document.activeElement).toBe(button("Remove", row("photo-01.jpg"))); // back on the opener
  await userEvent.click(button("Remove", row("photo-01.jpg")));
  await userEvent.click(button("Remove"));
  await expect.poll(() => row("photo-01.jpg")).toBeUndefined();
  expect(posted("/api/owner/upload/delete")[0].body).toEqual({ media_id: M1 });
});

test("Back while uploading asks; Esc stays, Leave and cancel cancels unfinished uploads; with nothing unfinished Back leaves", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1))],
    "/api/owner/upload/cancel": [ok()],
  });
  FakeXHR.hold = true;
  const { onBack } = screen();
  await ready();
  await userEvent.upload(picker(), [jpg("photo-01.jpg"), jpg("photo-02.jpg")]);
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => FakeXHR.all.length).toBe(1);
  const leave = () => {
    const event = new Event("beforeunload", { cancelable: true });
    dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(leave()).toBe(true);
  await userEvent.click(button("Back"));
  expect(host.querySelector("dialog[open]")?.textContent).toContain("Leave uploads?");
  expect(host.querySelector("dialog[open]")?.textContent).toContain("Leaving cancels unfinished uploads. Confirmed files stay on the item.");
  await userEvent.keyboard("{Escape}");
  expect(onBack).not.toHaveBeenCalled();
  await userEvent.click(button("Done"));
  await userEvent.click(button("Leave and cancel"));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(lastPut().aborted).toBe(true);
  await expect.poll(() => posted("/api/owner/upload/cancel").length).toBe(1);
  root?.unmount();
  host.remove();

  serve({ "/api/owner/item/get": [ok(item())], "/api/owner/page": [ok(page())] });
  const second = screen();
  await ready();
  expect(leave()).toBe(false);
  await userEvent.click(button("Back"));
  expect(second.onBack).toHaveBeenCalledTimes(1);
});

test("Cancel while a video is being prepared stops the preparation and lets the next file start", async () => {
  let signal: AbortSignal | undefined;
  vi.mocked(processVideo).mockImplementation((_file, stop) => ((signal = stop), new Promise(() => {})));
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page()), ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1))],
    "/api/owner/upload/complete": [ok({ state: "ready" })],
  });
  screen();
  await ready();
  await userEvent.upload(picker(), [mp4("video-01.mp4"), jpg("photo-01.jpg")]);
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => row("video-01.mp4").textContent).toContain("Preparing video…");
  await userEvent.click(button("Cancel", row("video-01.mp4")));
  expect(signal?.aborted).toBe(true);
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Saved");
  expect(posted("/api/owner/upload/begin")[0].body).toMatchObject({ kind: "photo" });
});

test("a control that disappears on its own keeps focus in the same row", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page()), ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1))],
    "/api/owner/upload/complete": [ok({ state: "ready" })],
  });
  FakeXHR.hold = true;
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => FakeXHR.all.length).toBe(1);
  button("Cancel", row("photo-01.jpg")).focus();
  lastPut().answer(200);
  await expect.poll(() => FakeXHR.all.length).toBe(2);
  lastPut().answer(200);
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Saved");
  // While the server confirms, the row has no action, so focus goes to the file itself (owner UI O6 accessibility).
  expect(document.activeElement).toBe(row("photo-01.jpg").querySelector("h3"));
});

test("a Begin lost to the network while offline restarts on reconnect", async () => {
  let prepared: (value: typeof PREPARED) => void = () => {};
  vi.mocked(processPhoto).mockImplementation(() => new Promise((resolve) => (prepared = resolve)));
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page()), ok(page())],
    "/api/owner/upload/begin": ["network", ok(begun(M1))],
    "/api/owner/upload/complete": [ok({ state: "ready" })],
  });
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Preparing photo…");
  try {
    offline(true);
    prepared(PREPARED);
    await expect.poll(() => row("photo-01.jpg").textContent).toContain("Upload interrupted or expired.");
  } finally {
    offline(false);
  }
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Saved");
});

test("a refused file is announced once, not again when a later block clears", async () => {
  serve({
    "/api/owner/item/get": [ok(item(Array.from({ length: 23 }, (_, i) => photoMedia(i))))],
    "/api/owner/page": [ok(page())],
    "/api/owner/upload/begin": [{ status: 401 }],
  });
  screen();
  await ready();
  await userEvent.upload(picker(), [jpg("photo-24.jpg"), jpg("photo-25.jpg")]);
  expect(region("alert")).toContain("photo-25.jpg");
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => region("alert")).toContain("Session expired.");
  serve({ "/api/owner/page": [ok(page())], "/api/owner/upload/begin": [ok(begun(M1))], "/api/owner/upload/complete": [ok({ state: "ready" })] });
  await userEvent.click(button("Try again", host.querySelector("#notice")!));
  await expect.poll(() => row("photo-24.jpg").textContent).toContain("Saved");
  expect(region("alert")).not.toContain("photo-25.jpg");
});

test("files with the same name are each refused and listed (phone pickers name every photo image.jpg)", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    serve({ "/api/owner/item/get": [ok(item(Array.from({ length: 23 }, (_, i) => photoMedia(i))))], "/api/owner/page": [ok(page())] });
    screen();
    await ready();
    await userEvent.upload(picker(), [jpg("image.jpg"), jpg("image.jpg"), jpg("image.jpg")]);
    expect(host.querySelectorAll("ul li")).toHaveLength(2);
    expect(errors.mock.calls.flat().join(" ")).not.toContain("same key");
  } finally {
    errors.mockRestore();
  }
});

test("Try again starts the new upload's progress bar from zero", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1)), ok(begun(M2))],
    "/api/owner/upload/cancel": [ok()],
  });
  FakeXHR.hold = true;
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => FakeXHR.all.length).toBe(1);
  lastPut().progress(1, 1);
  await expect.poll(() => host.querySelector("progress")?.value).toBeGreaterThan(0);
  lastPut().fail();
  await expect.poll(() => button("Try again", row("photo-01.jpg"))).toBeTruthy();
  await userEvent.click(button("Try again", row("photo-01.jpg")));
  await expect.poll(() => FakeXHR.all.length).toBe(2);
  expect(host.querySelector("progress")?.value).toBe(0);
});

test("Complete refusing an incomplete upload offers a restart; refusing a size cancels the reservation", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1)), ok(begun(M2))],
    "/api/owner/upload/complete": [{ status: 409 }, { status: 422 }],
    "/api/owner/upload/cancel": [ok(), ok()],
  });
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Upload interrupted or expired.");
  await userEvent.click(button("Try again", row("photo-01.jpg")));
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Video is over 50 MB");
  expect(posted("/api/owner/upload/cancel").map((c) => c.body)).toEqual([{ media_id: M1 }, { media_id: M2 }]);
});

test("Complete refusing the file's content says it cannot be read, offers no retry, and forgets the cancelled upload", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1))],
    "/api/owner/upload/complete": [{ status: 409, body: { error: "invalid_file" } }],
  });
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => row("photo-01.jpg").textContent).toContain("Can’t read this file.");
  expect(row("photo-01.jpg").querySelectorAll("button")).not.toContain(button("Try again", row("photo-01.jpg")));
  expect(posted("/api/owner/upload/cancel")).toEqual([]); // the server already cancelled it
});

test("access lost during an upload offers Log out and stays blocked after reconnecting", async () => {
  serve({ "/api/owner/item/get": [ok(item())], "/api/owner/page": [ok(page())], "/api/owner/upload/begin": [{ status: 403 }] });
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => region("alert")).toContain("Access is no longer available.");
  expect(button("Log out", host.querySelector("#notice")!)).toBeTruthy();
  offline(true);
  offline(false);
  expect(picker().disabled).toBe(true);
});

test("leaving the screen without Back or Done still stops the upload and gives back its reservation", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1))],
    "/api/owner/upload/cancel": [ok()],
  });
  FakeXHR.hold = true;
  screen();
  await ready();
  await userEvent.upload(picker(), jpg("photo-01.jpg"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => FakeXHR.all.length).toBe(1);
  root?.unmount();
  root = null;
  expect(lastPut().aborted).toBe(true);
  await expect.poll(() => posted("/api/owner/upload/cancel").map((c) => c.body)).toEqual([{ media_id: M1 }]);
});

test("focus recovery follows the row focus is in, not the row last clicked", async () => {
  serve({
    "/api/owner/item/get": [ok(item())],
    "/api/owner/page": [ok(page()), ok(page())],
    "/api/owner/upload/begin": [ok(begun(M1)), ok(begun(M2))],
    "/api/owner/upload/cancel": [ok()],
    "/api/owner/upload/complete": [ok({ state: "ready" })],
  });
  FakeXHR.hold = true;
  screen();
  await ready();
  await userEvent.upload(picker(), [jpg("photo-01.jpg"), jpg("photo-02.jpg")]);
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => FakeXHR.all.length).toBe(1);
  await userEvent.click(button("Cancel", row("photo-01.jpg"))); // the last click is in the first row
  await expect.poll(() => FakeXHR.all.length).toBe(2);
  button("Cancel", row("photo-02.jpg")).focus();
  lastPut().answer(200);
  await expect.poll(() => FakeXHR.all.length).toBe(3);
  lastPut().answer(200);
  await expect.poll(() => row("photo-02.jpg").textContent).toContain("Saved");
  expect(row("photo-02.jpg").contains(document.activeElement)).toBe(true);
});

test("Leave and unmount during a preparation stop it too", async () => {
  const signals: AbortSignal[] = [];
  vi.mocked(processVideo).mockImplementation((_file, stop) => (signals.push(stop!), new Promise(() => {})));
  serve({ "/api/owner/item/get": [ok(item()), ok(item())], "/api/owner/page": [ok(page()), ok(page())] });
  const { onBack } = screen();
  await ready();
  await userEvent.upload(picker(), mp4("video-01.mp4"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => signals.length).toBe(1);
  await userEvent.click(button("Back"));
  await userEvent.click(button("Leave and cancel"));
  expect(onBack).toHaveBeenCalled();
  expect(signals[0].aborted).toBe(true);
  root?.unmount();
  host.remove();

  screen();
  await ready();
  await userEvent.upload(picker(), mp4("video-01.mp4"));
  await userEvent.click(button("Start uploads"));
  await expect.poll(() => signals.length).toBe(2);
  root?.unmount();
  root = null;
  expect(signals[1].aborted).toBe(true);
});
