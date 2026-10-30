import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { authUnavailable, supabaseAuth } from "./auth";

// Codex, audit-fix round 4: with an expired access token, getUser() refreshes first, and auth-js removes the
// session when the refresh fails with anything it does not retry, including Auth's rate limit (429) and an
// answer it cannot read. Neither proves the refresh token is dead, so the cookies must stay and the next try
// must work. Real @supabase/ssr and auth-js; only the network is stubbed.
const URL_ = "http://auth.invalid";
const COOKIE = "sb-auth-auth-token";
const b64 = (value: object | string) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);
const accessToken = (exp: number) => [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: "owner", exp, aud: "authenticated" }), "sig"].join(".");
const user = { id: "00000000-0000-0000-0000-0000000000f1", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const expiredSession = { access_token: accessToken(now() - 600), refresh_token: "placeholder-refresh", token_type: "bearer", expires_in: 3600, expires_at: now() - 600, user };

let jar: Map<string, string>;
let written: { name: string; maxAge?: number }[];
const client = () =>
  supabaseAuth(
    {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll(list) {
        for (const { name, value, options } of list) {
          written.push({ name, maxAge: options.maxAge });
          if (options.maxAge === 0) jar.delete(name);
          else jar.set(name, value);
        }
      },
    },
    false,
  );

// The refresh answers `refresh`; a later /user call answers the user.
const network = (refresh: () => Response) =>
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) =>
    String(input).includes("grant_type=refresh_token") ? refresh() : Response.json(user),
  );

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", URL_);
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "placeholder-key");
  jar = new Map([[COOKIE, `base64-${b64(expiredSession)}`]]);
  written = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test.each([
  ["a JSON 429", () => Response.json({ code: "over_request_rate_limit", msg: "Request rate limit reached" }, { status: 429 })],
  ["an HTML 429", () => new Response("<html>Too Many Requests</html>", { status: 429 })],
  ["an empty 429", () => new Response("", { status: 429 })],
  // Codex round 5: readable, but it does not reject the refresh token.
  ["a JSON 408", () => Response.json({ code: 408, error_code: "request_timeout", msg: "Request Timeout" }, { status: 408 })],
  // Codex round 7: a 200 that holds no session, and a 400 that does not reject the token.
  ["a 200 without a session", () => Response.json({})],
  // Codex round 8: partial bodies auth-js also reads as "no session" (its hasSession needs all three truthy).
  ["a 200 without expires_in", () => Response.json({ ...expiredSession, access_token: accessToken(now() + 3600), expires_in: undefined, expires_at: undefined })],
  ["a 200 with an empty access token", () => Response.json({ ...expiredSession, access_token: "" })],
  // Codex round 9: only a failed answer can reject; a 200 carrying a rejection code is still malformed.
  ["a 200 carrying a rejection code", () => Response.json({ code: 400, error_code: "validation_failed", msg: "Refresh token is not valid" })],
  // Codex round 10: with a current API-version header auth-js reads `code`, not `error_code`; so must we.
  ["a versioned 400 whose code is no rejection", () =>
    Response.json({ code: "unexpected_failure", error_code: "validation_failed", msg: "x" }, { status: 400, headers: { "x-supabase-api-version": "2024-01-01" } })],
  ["a JSON 400 that is no token rejection", () => Response.json({ code: 400, error_code: "unexpected_failure", msg: "Unexpected failure" }, { status: 400 })],
])("a refresh that gets %s keeps the session cookies, and the next try signs in", async (_, refresh) => {
  network(refresh);
  const { data, error } = await client().auth.getUser();
  expect(data.user).toBeNull();
  expect(authUnavailable(error)).toBe(true);
  expect(written).toEqual([]);
  expect(jar.has(COOKIE)).toBe(true);

  network(() => Response.json({ ...expiredSession, access_token: accessToken(now() + 3600), refresh_token: "placeholder-refresh-2", expires_at: now() + 3600 }));
  expect((await client().auth.getUser()).data.user?.id).toBe(user.id);
  expect(jar.has(COOKIE)).toBe(true);
});

test.each([
  ["unversioned", () => Response.json({ code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" }, { status: 400 })],
  ["versioned", () =>
    Response.json({ code: "refresh_token_not_found", error_code: "unexpected_failure", msg: "x" }, { status: 400, headers: { "x-supabase-api-version": "2024-01-01" } })],
])("a refresh token Auth rejects (%s answer) still clears the session cookies", async (_, refresh) => {
  network(refresh);
  const { data, error } = await client().auth.getUser();
  expect(data.user).toBeNull();
  expect(authUnavailable(error)).toBe(false);
  expect(written).toContainEqual({ name: COOKIE, maxAge: 0 });
  expect(jar.has(COOKIE)).toBe(false);
});

// Codex round 5: a server component cannot store a refreshed session, so a refresh there would rotate the
// refresh token while the browser keeps the old one, and the session dies once Auth sees the old one reused.
// The page client never refreshes; src/proxy.ts does, before the page, with cookies it can write.
test("a client that cannot write cookies never refreshes, and reports Auth as unavailable", async () => {
  let refreshes = 0;
  network(() => {
    refreshes++;
    return Response.json({ ...expiredSession, access_token: accessToken(now() + 3600), expires_at: now() + 3600 });
  });
  const { data, error } = await supabaseAuth({ getAll: () => [...jar].map(([name, value]) => ({ name, value })) }, false, false).auth.getUser();
  expect(refreshes).toBe(0);
  expect(data.user).toBeNull();
  expect(authUnavailable(error)).toBe(true);
  expect(jar.has(COOKIE)).toBe(true);
});

// Codex round 6: auth-js retries a 5xx refresh inside the same getUser() call. A retry that succeeds has
// rotated the refresh token, so its session must be written, whatever an earlier attempt answered.
test("a refresh that fails once with a 5xx and then succeeds in the same call stores the new session", async () => {
  const answers = [
    () => new Response("<html>Bad Gateway</html>", { status: 502 }),
    () => Response.json({ ...expiredSession, access_token: accessToken(now() + 3600), refresh_token: "placeholder-refresh-2", expires_at: now() + 3600 }),
  ];
  network(() => answers.shift()!());
  expect((await client().auth.getUser()).data.user?.id).toBe(user.id);
  expect(answers).toHaveLength(0);
  expect(written.some(({ name, maxAge }) => name.startsWith(COOKIE) && maxAge !== 0)).toBe(true);
  expect(Buffer.from(jar.get(COOKIE)!.replace("base64-", ""), "base64url").toString()).toContain("placeholder-refresh-2");
});
