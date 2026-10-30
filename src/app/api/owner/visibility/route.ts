import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { requestAuth, sameOrigin } from "@/lib/auth";

// Set the page's visibility (design 1 §6, §10.1; T1.5c). Private and Published need an explicit confirm
// (screens O9): Private shuts every guest out, Published opens the page to anyone. The database checks
// the caller owns the page and that its wording is published (owner_set_visibility).
// The O9 screen that calls this comes with the owner screens (Phase 2).
const VISIBILITIES = ["private", "token_only", "published"];

const answer = (body: object | null, status: number) => {
  const res = body ? NextResponse.json(body, { status }) : new NextResponse(null, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
};

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return answer(null, 403);
  const auth = await requestAuth(request.nextUrl.protocol === "https:");
  // getUser() asks the Auth server, so a signed-out or revoked session fails here (as requireOwner does).
  // An Auth outage also answers no user, with a retryable error: 503, not "signed out" (Codex, T1.5c).
  const { data, error: authError } = await auth.auth.getUser();
  if (isAuthRetryableFetchError(authError)) return answer(null, 503);
  if (!data.user) return answer(null, 401);
  const body = await request.json().catch(() => null);
  const visibility = body?.visibility;
  if (typeof visibility !== "string" || !VISIBILITIES.includes(visibility)) return answer(null, 400);
  if (visibility !== "token_only" && body.confirm !== true) return answer({ error: "confirm_required" }, 400);

  const { error } = await auth.rpc("owner_set_visibility", { visibility });
  if (error?.code === "42501") return answer(null, 403);
  if (error?.code === "55000") return answer({ error: "wording_not_published" }, 409);
  if (error) return answer(null, 503);
  return answer({ visibility }, 200);
}
