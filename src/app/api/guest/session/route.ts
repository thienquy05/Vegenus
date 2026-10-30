import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/auth";
import { GUEST_COOKIE, guestCookieOptions, guestOpen, isToken } from "@/lib/guest";
import { exchangeAllowed } from "@/lib/server-db";

// Token exchange (design 1 §4 step 3-5; T1.5a). The token arrives only in this POST body and leaves only
// in the HttpOnly cookie; nothing here logs it. Wrong, rotated, malformed and rate-limited requests get
// one answer (design 1 §4). Headers: next.config.ts.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request) || request.headers.get("x-vegenus-guest") !== "1") return new NextResponse(null, { status: 403 });
  const token = (await request.json().catch(() => null))?.token;
  let summary;
  try {
    summary = (await exchangeAllowed(request)) && isToken(token) ? await guestOpen(token) : null;
  } catch {
    // A dependency failed (Codex, T1.5a review): retryable, no cookie, and nothing about the token.
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (!summary) return NextResponse.json({ error: "not_available" }, { status: 404 });

  const res = NextResponse.json(summary);
  res.cookies.set(GUEST_COOKIE, token, guestCookieOptions(request.nextUrl.protocol === "https:"));
  return res;
}
