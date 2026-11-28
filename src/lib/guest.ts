// Guest token (design 1 §3, §4; T1.5a). The cookie carries the token itself, HttpOnly, and the database
// re-checks it on every call through guest_open, so a rotated token or a Private page fails on the next request.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "./auth";
import { signObjects } from "./storage-admin";
import { normalizeVanity, vanityReason } from "./vanity";

export const GUEST_COOKIE = "vegenus_g";

// Q34b: 30 days. Secure on HTTPS, like the owner session (src/lib/auth.ts).
export const guestCookieOptions = (secure: boolean) =>
  ({ httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 30 * 24 * 60 * 60 }) as const;

// 32 random bytes, base64url without padding.
export const isToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

// The wish-limit device (design 3 §3.8, privacy design §2): a random id in its own HttpOnly cookie, set by the token
// exchange and by a wish, and kept 24 hours from its last use (Q103). It identifies nothing outside this site; the
// database sees only its HMAC.
export const DEVICE_COOKIE = "vegenus_d";
export const deviceId = (request: NextRequest) => {
  const id = request.cookies.get(DEVICE_COOKIE)?.value;
  return isToken(id) ? id : randomBytes(32).toString("base64url");
};
export const setDevice = (res: NextResponse, id: string, request: NextRequest) =>
  res.cookies.set(DEVICE_COOKIE, id, { ...guestCookieOptions(request.nextUrl.protocol === "https:"), maxAge: 24 * 60 * 60 });

// What guest_open returns (T3.1a): only published content. copy: {key: {en?, vi?}}; home null when unpublished or off.
export type Lang = "en" | "vi";
// alt is in the memory's main language (lang), alt_alt in its second one (lang_alt).
export type GuestMediaRef = {
  id: string; alt: string | null; alt_alt: string | null; lang: Lang; lang_alt: Lang | null; width: number | null; height: number | null;
};
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

// Who reads (T3.1pc, Q155): a guest token (guest_* functions), or a visitor naming a Published page at /p/<name>
// (public_* functions, same arguments after the first).
export type Cred = string | { page: string };
const read = (name: string, cred: Cred, args: object = {}) =>
  typeof cred === "string"
    ? anon().rpc(`guest_${name}`, { token: cred, ...args })
    : anon().rpc(`public_${name}`, { page_selector: cred.page, ...args });
export const isPageName = (value: unknown): value is string =>
  typeof value === "string" && vanityReason(value) === null && normalizeVanity(value) === value;

export async function guestOpen(cred: Cred): Promise<GuestSummary | null> {
  const { data, error } = await read("open", cred);
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

// Every /p/<name> page starts with this: a Published page by its exact name, else the ordinary not-found (owner UI
// "Guest side"; an unknown name and a page that is not Published look the same). A name typed with capitals, spaces or
// escapes goes to its normalized address first (owner decision 2026-11-27), before any lookup, so the redirect says
// nothing about the name; rest is the part of the address after the name.
export async function requireVisitor(name: string, rest = ""): Promise<GuestSummary> {
  let fixed = "";
  try {
    fixed = normalizeVanity(decodeURIComponent(name));
  } catch {} // a broken escape is no name
  if (!isPageName(fixed)) notFound();
  if (fixed !== name) permanentRedirect(`/p/${fixed}${rest}`);
  const summary = await guestOpen({ page: name });
  if (!summary) notFound();
  return summary;
}

// Variants a guest may load; the full-size original never (guest_media refuses it too).
export const GUEST_VARIANTS = ["thumb", "display", "poster", "video", "audio"] as const;
export type GuestVariant = (typeof GUEST_VARIANTS)[number];
const MEDIA_SECONDS = 300; // Q29

// Signed URLs by media id for the ids guest_media admits (design 1 §5, owner 2026-11-26): the database runs the
// publication checks as anon and returns the paths; only those are signed. An id that does not qualify, or a file
// Storage cannot sign, is absent. A database or Storage failure throws; no message holds the token.
export async function guestMedia(cred: Cred, ids: string[], variant: GuestVariant): Promise<Record<string, string>> {
  const { data, error } = await read("media", cred, { ids, variant });
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

// Guest route handlers (T3.1): same origin and the guest header, else null (403). The token comes from the body when
// the visit runs from memory (cookies blocked, design 1 §4, E30), which may still send an old cookie it cannot replace,
// else from the HttpOnly cookie. A visitor at /p/<name> sends the page's name instead (T3.1pc), which wins over any old
// cookie; a name that is not a valid normalized one reads nothing.
export async function guestRequest(request: NextRequest) {
  if (!sameOrigin(request) || request.headers.get("x-vegenus-guest") !== "1") return null;
  const body = await request.json().catch(() => null);
  const cookie = request.cookies.get(GUEST_COOKIE)?.value;
  const cred: Cred | null =
    body?.page !== undefined ? (isPageName(body.page) ? { page: body.page } : null)
    : isToken(body?.token) ? (body.token as string) : isToken(cookie) ? cookie : null;
  return { body, cred };
}

// An empty answer is either nothing published or a token that no longer opens the page (rotated, Private, page gone):
// only the second is the not-available answer, so an open visit learns that access is gone (token flow §6). A section
// turned off is the same answer as for its address (E5).
export async function stillOpen(cred: Cred, section?: string) {
  const summary = await guestOpen(cred);
  return summary !== null && (!section || summary.sections.includes(section as GuestSummary["sections"][number]));
}

// Guest answers are never cached: they depend on the token and on what is published now.
export function guestAnswer(body: object | null, status: number) {
  const res = body ? NextResponse.json(body, { status }) : new NextResponse(null, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// A section's published items (design 1 §5 guest_list), 50 per page after the (sort_order, id) cursor. Empty for a
// dead token, a page that is not live or a disabled section (E5, E6). Throws on a database failure.
export type ListSection = "memories" | "together";
export async function guestList(cred: Cred, section: ListSection, after: { sort: number; id: string } | null) {
  const { data, error } = await read("list", cred, { section, after_sort: after?.sort ?? null, after_id: after?.id ?? null });
  if (error || !data) throw new Error("guest_list failed");
  return data as Record<string, unknown>[];
}

// Approved wishes, newest first, 50 per page before the (created_at, id) cursor (Q34d: never a pending one).
export async function guestWishes(cred: Cred, after: { created_at: string; id: string } | null) {
  const { data, error } = await read("guestbook_list", cred, { after_created_at: after?.created_at ?? null, after_id: after?.id ?? null });
  if (error || !data) throw new Error("guest_guestbook_list failed");
  return data as Record<string, unknown>[];
}

// One published item for G3 (T3.1c), or null when the token, page, section or publication does not admit it.
export async function guestItem(cred: Cred, id: string) {
  const { data, error } = await read("item", cred, { item_id: id });
  if (error || !data) throw new Error("guest_item failed");
  return ((data as Record<string, unknown>[])[0] ?? null) as Record<string, unknown> | null;
}
