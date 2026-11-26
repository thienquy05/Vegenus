// Guest token (design 1 §3, §4; T1.5a). The cookie carries the token itself, HttpOnly, and the database
// re-checks it on every call through guest_open, so a rotated token or a Private page fails on the next request.
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signObjects } from "./storage-admin";

export const GUEST_COOKIE = "vegenus_g";

// Q34b: 30 days. Secure on HTTPS, like the owner session (src/lib/auth.ts).
export const guestCookieOptions = (secure: boolean) =>
  ({ httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 30 * 24 * 60 * 60 }) as const;

// 32 random bytes, base64url without padding.
export const isToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

// What guest_open returns (T3.1a): only published content. copy: {key: {en?, vi?}}; home null when unpublished or off.
type Lang = "en" | "vi";
export type GuestMediaRef = { id: string; alt: string | null; alt_alt: string | null; width: number | null; height: number | null };
export type GuestSummary = {
  theme: string | null;
  default_lang: Lang;
  sections: string[];
  names: [string | null, string | null];
  timezone: string;
  copy: Record<string, Partial<Record<Lang, string>>>;
  home: {
    lang: Lang; body: string | null; lang_alt: Lang | null; body_alt: string | null; start_date: string | null;
    picks: GuestMediaRef[];
  } | null;
};

// guest_open runs as anon (design 3 §3.9); rpc() sends the token in a POST body, never in a URL.
// Null for a wrong, rotated or inactive token and for a page that is not live: one answer for all.
// A database failure throws instead (retryable, not "not available"); the message never holds the token.
const anon = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export async function guestOpen(token: string): Promise<GuestSummary | null> {
  const { data, error } = await anon().rpc("guest_open", { token });
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

// Variants a guest may load; the full-size original never (guest_media refuses it too).
export const GUEST_VARIANTS = ["thumb", "display", "poster", "video", "audio"] as const;
export type GuestVariant = (typeof GUEST_VARIANTS)[number];
const MEDIA_SECONDS = 300; // Q29

// Signed URLs by media id for the ids guest_media admits (design 1 §5, owner 2026-11-26): the database runs the
// publication checks as anon and returns the paths; only those are signed. An id that does not qualify, or a file
// Storage cannot sign, is absent. A database or Storage failure throws; no message holds the token.
export async function guestMedia(token: string, ids: string[], variant: GuestVariant): Promise<Record<string, string>> {
  const { data, error } = await anon().rpc("guest_media", { token, ids, variant });
  if (error || !data) throw new Error("guest_media failed");
  const rows = data as { media_id: string; bucket: string; path: string }[];
  const urls: Record<string, string> = {};
  for (const bucket of new Set(rows.map((r) => r.bucket))) {
    const mine = rows.filter((r) => r.bucket === bucket);
    const signed = await signObjects(bucket, mine.map((r) => r.path), MEDIA_SECONDS);
    if (!signed) throw new Error("signing failed");
    const byPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
    for (const r of mine) {
      const url = byPath.get(r.path);
      if (url) urls[r.media_id] = url;
    }
  }
  return urls;
}
