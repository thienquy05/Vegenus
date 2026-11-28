import { expect, test, vi } from "vitest";
import { GUEST_COOKIE, guestCookieOptions, isToken } from "./guest";

// Design 1 §3: 32 random bytes, base64url without padding = 43 characters.
test.each([
  ["A".repeat(43), true],
  ["abcXYZ019-_".padEnd(43, "x"), true],
  ["A".repeat(42), false],
  ["A".repeat(44), false],
  ["A".repeat(42) + "+", false],
  ["A".repeat(42) + "/", false],
  ["A".repeat(42) + "=", false],
  ["", false],
  [undefined, false],
  [43, false],
])("isToken(%j) is %s", (value, expected) => {
  expect(isToken(value)).toBe(expected);
});

// Privacy design §2 and Q34b: vegenus_g, HttpOnly, SameSite=Lax, 30 days; Secure on HTTPS.
test("the guest cookie options", () => {
  expect(GUEST_COOKIE).toBe("vegenus_g");
  expect(guestCookieOptions(true)).toEqual({ httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 30 * 24 * 60 * 60 });
  expect(guestCookieOptions(false).secure).toBe(false);
});

// T3.1a: guest media URLs. The database decides what qualifies; the secret key only signs those paths, 5 minutes (Q29).
test("guestMedia signs exactly the paths guest_media returns, per bucket, for 5 minutes", async () => {
  vi.resetModules();
  const rpc = vi.fn().mockResolvedValue({
    data: [
      { media_id: "m1", bucket: "media-thumb", path: "p/m1/thumb" },
      { media_id: "m2", bucket: "media-thumb", path: "p/m2/thumb" },
      { media_id: "m3", bucket: "media-video", path: "p/m3/video" },
    ],
    error: null,
  });
  vi.doMock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
  const signObjects = vi.fn(async (bucket: string, paths: string[]) =>
    paths.map((path) => ({ path, signedUrl: path === "p/m2/thumb" ? null : `https://s.example.test/${bucket}/${path}` })));
  vi.doMock("./storage-admin", () => ({ signObjects }));
  const { guestMedia } = await import("./guest");

  expect(await guestMedia("tok", ["m1", "m2", "m3", "m4"], "thumb")).toEqual({
    m1: "https://s.example.test/media-thumb/p/m1/thumb",
    m3: "https://s.example.test/media-video/p/m3/video",
  });
  expect(rpc).toHaveBeenCalledWith("guest_media", { token: "tok", ids: ["m1", "m2", "m3", "m4"], variant: "thumb" });
  expect(signObjects.mock.calls).toEqual([
    ["media-thumb", ["p/m1/thumb", "p/m2/thumb"], 300],
    ["media-video", ["p/m3/video"], 300],
  ]);
});

test("guestMedia throws on a database or storage failure, without the token in the message", async () => {
  vi.resetModules();
  const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
  vi.doMock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
  vi.doMock("./storage-admin", () => ({ signObjects: vi.fn().mockResolvedValue(null) }));
  const { guestMedia } = await import("./guest");
  await expect(guestMedia("secret-token", ["m1"], "thumb")).rejects.toThrow(/^guest_media failed$/);

  rpc.mockResolvedValue({ data: [{ media_id: "m1", bucket: "media-thumb", path: "p" }], error: null });
  await expect(guestMedia("secret-token", ["m1"], "thumb")).rejects.toThrow(/^signing failed$/);
});

test("guestList and guestWishes pass the cursor to the database and throw without the token on failure", async () => {
  vi.resetModules();
  const rpc = vi.fn().mockResolvedValue({ data: [{ id: "i1" }], error: null });
  vi.doMock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
  const { guestList, guestWishes } = await import("./guest");

  expect(await guestList("tok", "memories", null)).toEqual([{ id: "i1" }]);
  expect(rpc).toHaveBeenLastCalledWith("guest_list", { token: "tok", section: "memories", after_sort: null, after_id: null });
  await guestList("tok", "together", { sort: 3, id: "i1" });
  expect(rpc).toHaveBeenLastCalledWith("guest_list", { token: "tok", section: "together", after_sort: 3, after_id: "i1" });
  await guestWishes("tok", { created_at: "2026-11-20T10:00:00Z", id: "e1" });
  expect(rpc).toHaveBeenLastCalledWith("guest_guestbook_list", { token: "tok", after_created_at: "2026-11-20T10:00:00Z", after_id: "e1" });

  rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
  await expect(guestList("secret-token", "memories", null)).rejects.toThrow(/^guest_list failed$/);
  await expect(guestWishes("secret-token", null)).rejects.toThrow(/^guest_guestbook_list failed$/);
});

// Re-review, T3.1b: a section turned off mid-visit is not-available too, not "nothing yet" (token flow §6, E5).
test("stillOpen: the token opens the page and, when asked, the section is still enabled", async () => {
  vi.resetModules();
  const rpc = vi.fn().mockResolvedValue({ data: { sections: ["home", "memories"] }, error: null });
  vi.doMock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
  const { stillOpen } = await import("./guest");
  expect(await stillOpen("tok")).toBe(true);
  expect(await stillOpen("tok", "memories")).toBe(true);
  expect(await stillOpen("tok", "guestbook")).toBe(false);
  rpc.mockResolvedValue({ data: null, error: null });
  expect(await stillOpen("tok", "memories")).toBe(false);
});

// T3.1c: G3 reads one item through guest_item; none is null; a failure throws without the token.
test("guestItem returns the one row or null, and throws without the token", async () => {
  vi.resetModules();
  const rpc = vi.fn().mockResolvedValue({ data: [{ id: "i1" }], error: null });
  vi.doMock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
  const { guestItem } = await import("./guest");
  expect(await guestItem("tok", "i1")).toEqual({ id: "i1" });
  expect(rpc).toHaveBeenCalledWith("guest_item", { token: "tok", item_id: "i1" });
  rpc.mockResolvedValue({ data: [], error: null });
  expect(await guestItem("tok", "i1")).toBeNull();
  rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
  await expect(guestItem("tok", "i1")).rejects.toThrow(/^guest_item failed$/);
});

// T3.1pc (Q155): a visitor at /p/<name> reads a Published page by its name through the public_* functions, with the
// same arguments as the guest_* ones; no token is involved.
test("a Published page's name reads through the public_* functions", async () => {
  vi.resetModules();
  const rpc = vi.fn(async (name: string) => ({ data: name === "public_open" ? { sections: ["home"] } : name === "public_media" ? [] : [{ id: "i1" }], error: null }));
  vi.doMock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
  vi.doMock("./storage-admin", () => ({ signObjects: vi.fn() }));
  const { guestOpen, guestList, guestWishes, guestItem, guestMedia } = await import("./guest");
  const page = { page: "our-page" };
  expect(await guestOpen(page)).toEqual({ sections: ["home"] });
  await guestList(page, "memories", { sort: 1, id: "i0" });
  await guestWishes(page, null);
  expect(await guestItem(page, "i1")).toEqual({ id: "i1" });
  expect(await guestMedia(page, ["m1"], "thumb")).toEqual({});
  expect(rpc.mock.calls).toEqual([
    ["public_open", { page_selector: "our-page" }],
    ["public_list", { page_selector: "our-page", section: "memories", after_sort: 1, after_id: "i0" }],
    ["public_guestbook_list", { page_selector: "our-page", after_created_at: null, after_id: null }],
    ["public_item", { page_selector: "our-page", item_id: "i1" }],
    ["public_media", { page_selector: "our-page", ids: ["m1"], variant: "thumb" }],
  ]);
});

test("requireVisitor: a Published page by its exact name, else the ordinary not-found without asking the database", async () => {
  vi.resetModules();
  const rpc = vi.fn(async (_: string, args: { page_selector: string }) => ({ data: args.page_selector === "our-page" ? { sections: ["home"] } : null, error: null }));
  vi.doMock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
  const { requireVisitor } = await import("./guest");
  expect(await requireVisitor("our-page")).toEqual({ sections: ["home"] });
  await expect(requireVisitor("not-published")).rejects.toThrow();
  for (const name of ["Our-Page", "a b", "x", "-our-page"]) await expect(requireVisitor(name)).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(2);
});
