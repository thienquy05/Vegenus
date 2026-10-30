import { AuthApiError, AuthRetryableFetchError, createClient } from "@supabase/supabase-js";
import { beforeEach, expect, test, vi } from "vitest";

// Audit 2026-10-30: an Auth outage is not "signed out". Sending the owner to the login form then
// ends in "Check your details", as if the password were wrong; the page fails as retryable instead.
const getUser = vi.fn();
const redirect = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set() {} }) }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser } }) }));
const { authUnavailable, requireOwner } = await import("./auth");

beforeEach(() => {
  redirect.mockClear();
  getUser.mockReset();
});

test("no session goes to the login form, with the page to return to", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(requireOwner("/app")).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/login?next=%2Fapp");
});

// Codex, audit-fix round 2: the client returns Auth's own rate limit (429) as an AuthApiError, not as
// AuthRetryableFetchError; the session may still be valid, so it is an outage too.
test.each([
  ["unreachable", new AuthRetryableFetchError("Auth unreachable", 0)],
  ["rate-limited", new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit")],
])("an Auth outage (%s) throws instead of redirecting to login", async (_, outage) => {
  getUser.mockResolvedValue({ data: { user: null }, error: outage });
  await expect(requireOwner("/app")).rejects.toBe(outage);
  expect(redirect).not.toHaveBeenCalled();
});

// Codex, audit-fix round 3: the classification against the real auth-js parser, not hand-built errors.
// A body Auth's client cannot read (an HTML or empty 429 from a proxy) loses its status, so it must still
// count as "Auth could not answer"; a readable "bad token" answer is a confirmed sign-out.
const authAnswer = async (status: number, body: string) => {
  const client = createClient("http://auth.invalid", "placeholder-key", {
    global: { fetch: async () => new Response(body, { status, headers: { "content-type": "text/html" } }) },
  });
  return (await client.auth.getUser("placeholder-jwt")).error;
};

test.each([
  [429, '{"code":"over_request_rate_limit","msg":"Request rate limit reached"}'],
  [429, "<html>Too Many Requests</html>"],
  [429, ""],
  [503, "<html>Service Unavailable</html>"],
  // Codex round 5: a readable answer that does not reject the token (a proxy timeout) proves nothing either.
  [408, '{"code":408,"error_code":"request_timeout","msg":"Request Timeout"}'],
  // Codex round 7: a status Auth also uses for rejections, but not a rejection of the token or session.
  [400, '{"code":400,"error_code":"unexpected_failure","msg":"Unexpected failure"}'],
])("Auth answering %i %j is unavailable, not signed out", async (status, body) => {
  expect(authUnavailable(await authAnswer(status, body))).toBe(true);
});

// Bodies as the local Auth server sends them (probed 2026-10-30: bad JWT, revoked session, revoked or
// malformed refresh token).
test.each([
  [403, '{"code":403,"error_code":"bad_jwt","msg":"invalid JWT"}'],
  [403, '{"code":403,"error_code":"session_not_found","msg":"Session from session_id claim in JWT does not exist"}'],
  [400, '{"code":400,"error_code":"refresh_token_not_found","msg":"Invalid Refresh Token: Refresh Token Not Found"}'],
  [400, '{"code":400,"error_code":"validation_failed","msg":"Refresh token is not valid"}'],
])("Auth answering %i %j is a confirmed sign-out", async (status, body) => {
  expect(authUnavailable(await authAnswer(status, body))).toBe(false);
});
