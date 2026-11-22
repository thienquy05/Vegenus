import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

// T2.6: O9's sections save for a finished page (Q146 20, 21, 35). The draft's base flags are the precondition
// ("conflict" when the saved flags differ); a request id makes a retry of a committed save apply nothing; every
// success answers the owner_page() snapshot. Zodiac is not offered until T3.9 (Q118).
const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requestAuth: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));
const { POST } = await import("./route");

const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const BODY = { base_sections: ["home", "memories"], sections: ["home", "together", "guestbook"], request_id: REQUEST_ID };
const SNAPSHOT = { visibility: "token_only", sections: ["home", "together", "guestbook"], link: null };
const save = (body: unknown, origin = "http://localhost:3000") =>
  POST(
    new NextRequest("http://localhost:3000/api/owner/sections", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "00000000-0000-0000-0000-0000000000f1" } } });
  rpc.mockReset().mockResolvedValue({ data: SNAPSHOT, error: null });
});

test("a save answers the snapshot, with no-store", async () => {
  const res = await save(BODY);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ page: SNAPSHOT });
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(rpc).toHaveBeenCalledWith("owner_save_sections", BODY);
});

test("saved flags that differ from the base are a conflict", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  const res = await save(BODY);
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "conflict" });
});

test("before Finish the wizard owns the sections", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "55000" } });
  const res = await save(BODY);
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "setup_not_finished" });
});

test("malformed bodies are refused before the database", async () => {
  for (const body of [
    null,
    {},
    { ...BODY, request_id: "x" },
    { ...BODY, request_id: undefined },
    { ...BODY, base_sections: undefined },
    { ...BODY, sections: "home" },
    { ...BODY, sections: ["home", "zodiac"] },
    { ...BODY, base_sections: ["home", "unknown"] },
    { ...BODY, sections: [1] },
  ]) {
    expect((await save(body)).status, JSON.stringify(body)).toBe(400);
  }
  expect(rpc).not.toHaveBeenCalled();
});

test("zodiac may be in the base: it keeps its saved flag", async () => {
  expect((await save({ ...BODY, base_sections: ["home", "zodiac"] })).status).toBe(200);
});

test("a foreign origin or no session is refused without calling the database", async () => {
  expect((await save(BODY, "https://other.site")).status).toBe(403);
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await save(BODY)).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});

test("not the owner is 403, bad input the database refuses 400, a database failure 503", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  expect((await save(BODY)).status).toBe(403);
  rpc.mockResolvedValue({ data: null, error: { code: "22023" } });
  expect((await save(BODY)).status).toBe(400);
  rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
  expect((await save(BODY)).status).toBe(503);
});
