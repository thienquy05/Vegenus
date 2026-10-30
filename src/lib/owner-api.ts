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
