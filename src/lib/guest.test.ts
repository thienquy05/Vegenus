import { expect, test } from "vitest";
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
