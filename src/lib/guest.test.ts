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
