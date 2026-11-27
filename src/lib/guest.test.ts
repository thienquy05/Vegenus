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
