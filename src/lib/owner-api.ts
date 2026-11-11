// The start of every owner route handler (design 1 §9 layer 2). Its own module, so the route tests
// that mock requestAuth in src/lib/auth.ts also reach the calls made here.
import { NextResponse, type NextRequest } from "next/server";
import { authUnavailable, requestAuth, sameOrigin } from "./auth";

// Owner answers are never cached.
export const answer = (body: object | null, status: number) => {
  const res = body ? NextResponse.json(body, { status }) : new NextResponse(null, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
};

// pages.version is a Postgres int, starting at 1 (design 3 §1.6).
const MAX_VERSION = 2 ** 31 - 1;
export const isVersion = (value: unknown) => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_VERSION;

// Origin first, then the session. getUser() asks the Auth server, so a signed-out or revoked session
// fails here (as requireOwner does). An Auth outage also answers no user (authUnavailable): 503, not
// "signed out" (Codex, T1.5c). Returns the signed-in client, or the answer to send.
export async function ownerAuth(request: NextRequest) {
  if (!sameOrigin(request)) return answer(null, 403);
  const auth = await requestAuth(request.nextUrl.protocol === "https:");
  const { data, error } = await auth.auth.getUser();
  if (authUnavailable(error)) return answer(null, 503);
  if (!data.user) return answer(null, 401);
  return auth;
}

export const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// What the database's refusals mean to an owner route: 42501 not the page's owner, and these codes bad input
// (22023 rule, 23514 check, 22P02 enum text, 22P05 NUL, 22007 and 22008 date). Anything else is an outage.
const BAD_INPUT = ["22023", "23514", "22P02", "22P05", "22007", "22008"];
export const dbFailure = (error: { code?: string }) =>
  error.code === "42501" ? answer(null, 403) : answer(null, BAD_INPUT.includes(error.code ?? "") ? 400 : 503);
