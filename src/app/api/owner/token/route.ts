import { NextResponse, type NextRequest } from "next/server";
import { requestAuth, sameOrigin } from "@/lib/auth";

// Create or rotate the guest link (design 1 §3.1, §3.2; T1.5b). The database draws the token and checks
// the caller owns the page (owner_rotate_token); this answer is the only time the link is shown (Q34a),
// so nothing caches it. The request id makes a retry or double click "already rotated", not a second token.
// The Share screen O8 that calls this comes with T2.6.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const answer = (body: object | null, status: number) => {
  const res = body ? NextResponse.json(body, { status }) : new NextResponse(null, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
};

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return answer(null, 403);
  const auth = await requestAuth(request.nextUrl.protocol === "https:");
  // getUser() asks the Auth server, so a signed-out or revoked session fails here (as requireOwner does).
  const { data } = await auth.auth.getUser();
  if (!data.user) return answer(null, 401);
  const requestId = (await request.json().catch(() => null))?.request_id;
  if (typeof requestId !== "string" || !UUID.test(requestId)) return answer(null, 400);

  const { data: token, error } = await auth.rpc("owner_rotate_token", { request_id: requestId });
  if (error) return answer(null, error.code === "42501" ? 403 : 503);
  if (!token) return answer({ error: "already_rotated" }, 409);
  return answer({ link: `${request.nextUrl.origin}/g#${token}` }, 200);
}
