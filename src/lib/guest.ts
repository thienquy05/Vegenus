// Guest token (design 1 §3, §4; T1.5a). The cookie carries the token itself, HttpOnly, and the database
// re-checks it on every call through guest_open, so a rotated token or a Private page fails on the next request.
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const GUEST_COOKIE = "vegenus_g";

// Q34b: 30 days. Secure on HTTPS, like the owner session (src/lib/auth.ts).
export const guestCookieOptions = (secure: boolean) =>
  ({ httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 30 * 24 * 60 * 60 }) as const;

// 32 random bytes, base64url without padding.
export const isToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

export type GuestSummary = { theme: string; default_lang: string; sections: string[] };

// guest_open runs as anon (design 3 §3.9); rpc() sends the token in a POST body, never in a URL.
// Null for a wrong, rotated or inactive token and for a page that is not live: one answer for all.
// A database failure throws instead (retryable, not "not available"); the message never holds the token.
export async function guestOpen(token: string): Promise<GuestSummary | null> {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("guest_open", { token });
  if (error) throw new Error("guest_open failed");
  return data as GuestSummary | null;
}

// Every guest page starts with this. Without a working token cookie: back to the tap notice (G-E1).
export async function requireGuest(): Promise<GuestSummary> {
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  const summary = isToken(token) ? await guestOpen(token) : null;
  if (!summary) redirect("/g");
  return summary;
}
