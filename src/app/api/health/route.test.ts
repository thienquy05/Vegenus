import { expect, test, vi } from "vitest";

// T2.5a (PRD Q145 6; E23): the public health route for the scheduled GitHub check. 200 when the daily job succeeded in
// the last 26 hours, 503 otherwise, a database outage included. It answers no data: an empty body, never cached.
const db = vi.hoisted(() => ({ healthOk: vi.fn() }));
vi.mock("@/lib/server-db", () => db);
const { GET } = await import("./route");

const check = async () => {
  const res = await GET();
  return { status: res.status, body: await res.text(), cache: res.headers.get("cache-control") };
};

test("a recent success answers 200 with no body and no-store", async () => {
  db.healthOk.mockResolvedValue(true);
  expect(await check()).toEqual({ status: 200, body: "", cache: "no-store" });
});

test("a missed job answers 503 with no body", async () => {
  db.healthOk.mockResolvedValue(false);
  expect(await check()).toEqual({ status: 503, body: "", cache: "no-store" });
});

test("a database outage answers 503 with no body and leaks no error", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  db.healthOk.mockRejectedValue(new Error("password authentication failed for user vegenus_server"));
  expect(await check()).toEqual({ status: 503, body: "", cache: "no-store" });
  log.mockRestore();
});
