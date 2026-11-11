import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, test, vi } from "vitest";

// T2.3c: the daily storage job (design 3 §3.4; design 7 §3 machine callers; Q134). Vercel cron calls it with
// "Authorization: Bearer <CRON_SECRET>" (Vercel docs, read through context7). It expires overdue uploads, reconciles
// the buckets, deletes the due files through the Storage API and marks a deletion done only when the database confirms
// the object is gone. Anything without the secret gets one refusal and does no work.
const db = vi.hoisted(() => ({
  expireUploads: vi.fn(),
  reconcile: vi.fn(),
  dueDeletions: vi.fn(),
  deletionDone: vi.fn(),
}));
const storage = vi.hoisted(() => ({ removeObjects: vi.fn() }));
vi.mock("@/lib/server-db", () => db);
vi.mock("@/lib/storage-admin", () => storage);
const { GET } = await import("./route");

const run = (authorization?: string) =>
  GET(new Request("http://localhost:3000/api/cron/storage", { headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  process.env.CRON_SECRET = "cron-test-secret";
  db.expireUploads.mockReset().mockResolvedValue(1);
  db.reconcile.mockReset().mockResolvedValue({ orphans: 0, resized: 0 });
  db.dueDeletions.mockReset().mockResolvedValue([
    { id: "1", bucket: "media-thumb", path: "pages/p/media/m/thumb" },
    { id: "2", bucket: "media-display", path: "pages/p/media/m/display" },
    { id: "3", bucket: "media-thumb", path: "pages/p/media/n/thumb" },
  ]);
  db.deletionDone.mockReset().mockResolvedValue(true);
  storage.removeObjects.mockReset().mockResolvedValue(true);
});

const noWork = () => {
  expect(db.expireUploads).not.toHaveBeenCalled();
  expect(db.dueDeletions).not.toHaveBeenCalled();
  expect(storage.removeObjects).not.toHaveBeenCalled();
};

test("without the secret, with a wrong one, or with no secret configured, it refuses and does nothing", async () => {
  for (const header of [undefined, "Bearer wrong", "cron-test-secret", "Bearer cron-test-secretX"]) {
    const res = await run(header);
    expect(res.status, String(header)).toBe(403);
  }
  delete process.env.CRON_SECRET;
  expect((await run("Bearer undefined")).status).toBe(403);
  expect((await run("Bearer ")).status).toBe(403);
  noWork();
});

test("with the secret it expires, reconciles, deletes per bucket and marks each confirmed deletion done", async () => {
  const res = await run("Bearer cron-test-secret");
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ expired: 1, orphans: 0, resized: 0, deleted: 3, failed: 0 });
  expect(storage.removeObjects).toHaveBeenCalledWith("media-thumb", ["pages/p/media/m/thumb", "pages/p/media/n/thumb"]);
  expect(storage.removeObjects).toHaveBeenCalledWith("media-display", ["pages/p/media/m/display"]);
  expect(db.deletionDone.mock.calls.map((c) => c[0]).sort()).toEqual(["1", "2", "3"]);
  // Reconcile runs before the due list, so orphans it queues are deleted the same day.
  expect(db.reconcile.mock.invocationCallOrder[0]).toBeLessThan(db.dueDeletions.mock.invocationCallOrder[0]);
});

test("a bucket whose delete fails keeps its charges, and each of its rows is still checked by the database", async () => {
  const alert = vi.spyOn(console, "error").mockImplementation(() => {});
  storage.removeObjects.mockImplementation(async (bucket: string) => bucket !== "media-thumb");
  // The thumb files are still there, so the database does not confirm them (and counts an attempt).
  db.deletionDone.mockImplementation(async (id: string) => id === "2");
  const res = await run("Bearer cron-test-secret");
  expect(await res.json()).toMatchObject({ deleted: 1, failed: 2 });
  expect(db.deletionDone.mock.calls.map((c) => c[0]).sort()).toEqual(["1", "2", "3"]);
  expect(alert).toHaveBeenCalled();
  alert.mockRestore();
});

test("a bucket whose delete throws (network error) counts as failed and the other buckets still run", async () => {
  const alert = vi.spyOn(console, "error").mockImplementation(() => {});
  storage.removeObjects.mockImplementation(async (bucket: string) => {
    if (bucket === "media-thumb") throw new Error("fetch failed");
    return true;
  });
  db.deletionDone.mockImplementation(async (id: string) => id === "2");
  const res = await run("Bearer cron-test-secret");
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ deleted: 1, failed: 2 });
  alert.mockRestore();
});

test("a bucket whose delete never answers is given up after 5 seconds; its rows are still checked and others progress", async () => {
  vi.useFakeTimers();
  const alert = vi.spyOn(console, "error").mockImplementation(() => {});
  storage.removeObjects.mockImplementation((bucket: string) => (bucket === "media-thumb" ? new Promise(() => {}) : Promise.resolve(true)));
  db.deletionDone.mockImplementation(async (id: string) => id === "2");
  const pending = run("Bearer cron-test-secret");
  await vi.advanceTimersByTimeAsync(5_000);
  const res = await pending;
  expect(await res.json()).toMatchObject({ deleted: 1, failed: 2 });
  expect(db.deletionDone.mock.calls.map((c) => c[0]).sort()).toEqual(["1", "2", "3"]);
  alert.mockRestore();
  vi.useRealTimers();
});

test("a deletion the database does not confirm (the object is still there) counts as failed and is reported", async () => {
  const alert = vi.spyOn(console, "error").mockImplementation(() => {});
  db.deletionDone.mockResolvedValueOnce(false);
  expect(await (await run("Bearer cron-test-secret")).json()).toMatchObject({ deleted: 2, failed: 1 });
  expect(alert).toHaveBeenCalled();
  alert.mockRestore();
});

test("reconcile findings are reported as an alert", async () => {
  const alert = vi.spyOn(console, "error").mockImplementation(() => {});
  db.reconcile.mockResolvedValue({ orphans: 2, resized: 1 });
  expect(await (await run("Bearer cron-test-secret")).json()).toMatchObject({ orphans: 2, resized: 1 });
  expect(alert).toHaveBeenCalled();
  alert.mockRestore();
});

test("a database outage answers 503", async () => {
  const alert = vi.spyOn(console, "error").mockImplementation(() => {});
  db.expireUploads.mockRejectedValue(new Error("connection refused"));
  expect((await run("Bearer cron-test-secret")).status).toBe(503);
  alert.mockRestore();
});

// The Supabase secret key bypasses every policy: only this route may use it (design 7 §3).
test("only the storage cron route imports storage-admin", () => {
  const files = readdirSync("src", { recursive: true, encoding: "utf8" })
    .map((f) => join("src", f))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") && f !== join("src", "lib", "storage-admin.ts"));
  const importers = files.filter((f) => /from\s+["'][^"']*storage-admin["']/.test(readFileSync(f, "utf8")));
  expect(importers).toEqual([join("src", "app", "api", "cron", "storage", "route.ts")]);
});
