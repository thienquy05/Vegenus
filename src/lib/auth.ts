// Owner authentication (design 1 §7, §9 layer 2; T1.4). Only the server talks to Supabase Auth, so the
// session cookie is HttpOnly (design 1 §10.1); the library's default cookie is readable by page scripts.
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { isAuthApiError, isAuthSessionMissingError, type AuthError, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Session cookies (owner, 2026-10-29): a persistent login cookie needs the user's consent, so the
// 400-day lifetime the library forces on every write is dropped until "Keep me signed in" exists.
// Removals keep maxAge 0.
// A refresh answer that is neither a session nor a rejection (REJECT_CODES) proves nothing about the refresh
// token, yet auth-js removes the session for most of them; this client then writes no cookies, so the next try
// can still refresh (Codex, audit-fix rounds 4-7).
// canRefresh false: a client that cannot store a refreshed session (a server component) never refreshes. Its
// refresh would rotate the refresh token while the browser keeps the old one, and Auth ends the session once
// the old one is reused; src/proxy.ts refreshes before the page instead (Codex, audit-fix round 5).
export function supabaseAuth(cookieMethods: CookieMethodsServer, secure: boolean, canRefresh = true) {
  let refreshUnanswered = false;
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure, path: "/" },
    global: {
      fetch: async (input, init) => {
        const refresh = String(input instanceof Request ? input.url : input).includes("grant_type=refresh_token");
        // Unreadable, so auth-js does not retry it (a 5xx would be retried for up to 30 s): AuthUnknownError.
        const res = refresh && !canRefresh ? new Response("refresh only in src/proxy.ts", { status: 409 }) : await fetch(input, init);
        // The latest refresh answer decides: auth-js retries a 5xx in the same call, and a retry that succeeds
        // has rotated the refresh token, so its session must be written (Codex, audit-fix round 6).
        if (refresh) {
          const body = await res.clone().json().catch(() => null);
          // auth-js's own test for a session (hasSession in lib/fetch.js), so the two never disagree (Codex, round 8).
          const session = res.ok && !!body?.access_token && !!body?.refresh_token && !!body?.expires_in;
          // The code as auth-js picks it (handleError in lib/fetch.js), so the two never disagree (Codex, round 10).
          const version = res.headers.get("x-supabase-api-version") ?? "";
          const code = /^\d{4}-\d{2}-\d{2}$/.test(version) && version >= "2024-01-01" && typeof body?.code === "string" ? body.code : body?.error_code;
          // Only a failed answer can reject; a 200 without a session is malformed whatever it carries (round 9).
          refreshUnanswered = !session && !(!res.ok && rejects(code));
          // auth-js would read a 200 without a session as "signed out" (AuthSessionMissingError).
          if (res.ok && !session) return new Response("refresh answered without a session", { status: 409 });
        }
        return res;
      },
    },
    cookies: {
      getAll: cookieMethods.getAll,
      setAll(list, headers) {
        if (refreshUnanswered) return;
        const session = list.map(({ name, value, options }) => {
          if (options.maxAge === 0) return { name, value, options };
          const rest = { ...options };
          delete rest.maxAge;
          delete rest.expires;
          return { name, value, options: rest };
        });
        return cookieMethods.setAll?.(session, headers);
      },
    },
  });
}

// Through next/headers, for route handlers, which can write cookies. Owner pages use requireOwner.
export async function requestAuth(secure: boolean) {
  const jar = await cookies();
  return supabaseAuth(
    {
      getAll: () => jar.getAll(),
      setAll(list) {
        for (const { name, value, options } of list) jar.set(name, value, options);
      },
    },
    secure,
  );
}

// The only answers that settle a session: Auth read it and turned it down, by one of these codes, or there is
// no session at all. Anything else, a network failure, a 5xx, a rate limit (429), a timeout (408), another
// error code or a body the client cannot read, leaves it unknown (Codex, audit-fix rounds 2-7). auth-js's
// token and session codes, checked against the local Auth server (2026-10-30): a revoked refresh token is
// refresh_token_not_found, a malformed one validation_failed, a revoked session session_not_found.
// shortcut: a rejection code missing here shows the retryable error page instead of login (the owner can still
// open /login); add it when Auth answers with a new one.
const REJECT_CODES = ["bad_jwt", "session_not_found", "session_expired", "refresh_token_not_found", "refresh_token_already_used", "user_not_found", "user_banned", "validation_failed"];
const rejects = (code: unknown) => typeof code === "string" && REJECT_CODES.includes(code);
export const authUnavailable = (error: AuthError | null) =>
  !!error && !isAuthSessionMissingError(error) && !(isAuthApiError(error) && rejects(error.code));

// Every owner page starts with this. getUser() asks the Auth server, so a signed-out or revoked
// session fails here even if its cookie is still present. An Auth outage is thrown, not sent to login
// (audit 2026-10-30): the form would then say "Check your details" as if the password were wrong.
// ponytail: owner = any validated session (closed registration, owner 2026-10-29); T3.6 adds "and not a
// Member" when guest_accounts exists
export async function requireOwner(path: string): Promise<User> {
  const jar = await cookies();
  const { data, error } = await supabaseAuth({ getAll: () => jar.getAll() }, true, false).auth.getUser();
  if (authUnavailable(error)) throw error;
  if (!data.user) redirect(`/login?next=${encodeURIComponent(path)}`);
  return data.user;
}

// Login and logout are form posts from our own pages; anything else is refused (CSRF, design 1 §1).
export const sameOrigin = (request: Request) => request.headers.get("origin") === new URL(request.url).origin;
