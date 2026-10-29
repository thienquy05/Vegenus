// Owner authentication (design 1 §7, §9 layer 2; T1.4). Only the server talks to Supabase Auth, so the
// session cookie is HttpOnly (design 1 §10.1); the library's default cookie is readable by page scripts.
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Session cookies (owner, 2026-10-29): a persistent login cookie needs the user's consent, so the
// 400-day lifetime the library forces on every write is dropped until "Keep me signed in" exists.
// Removals keep maxAge 0.
export function supabaseAuth(cookieMethods: CookieMethodsServer, secure: boolean) {
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure, path: "/" },
    cookies: {
      getAll: cookieMethods.getAll,
      setAll(list, headers) {
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

// Through next/headers: route handlers write the cookies; server components cannot, so the write is
// skipped there and src/proxy.ts refreshes the session before an owner page renders.
export async function requestAuth(secure: boolean) {
  const jar = await cookies();
  return supabaseAuth(
    {
      getAll: () => jar.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {}
      },
    },
    secure,
  );
}

// Every owner page starts with this. getUser() asks the Auth server, so a signed-out or revoked
// session fails here even if its cookie is still present.
// ponytail: owner = any validated session (closed registration, owner 2026-10-29); T3.6 adds "and not a
// Member" when guest_accounts exists
export async function requireOwner(path: string): Promise<User> {
  const { data } = await (await requestAuth(true)).auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(path)}`);
  return data.user;
}

// Login and logout are form posts from our own pages; anything else is refused (CSRF, design 1 §1).
export const sameOrigin = (request: Request) => request.headers.get("origin") === new URL(request.url).origin;
