import type { NextRequest } from "next/server";
import { answer, isUuid, isVersion, ownerAuth } from "@/lib/owner-api";

// Create or rotate the guest link (design 1 §3.1, §3.2; T1.5b). The database draws the token and checks
// the caller owns the page (owner_rotate_token); this answer is the only time the link is shown (Q34a),
// so nothing caches it. The request id makes a retry or double click "already rotated", not a second token.
// T2.6 (Q146 10, 21): O8 names the link it expects (null: Create, no active link; else the version the owner
// confirmed), so a link replaced in another tab is "changed", never rotated by surprise; the answer names the version.
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => null);
  const { request_id, expected_version } = body ?? {};
  if (!isUuid(request_id) || !(expected_version === null || isVersion(expected_version))) return answer(null, 400);

  const { data, error } = await auth.rpc("owner_rotate_token", { request_id, expected_version });
  if (error) return answer(null, error.code === "42501" ? 403 : 503);
  if (data.error) return answer({ error: data.error }, 409);
  return answer({ link: `${request.nextUrl.origin}/g#${data.token}`, version: data.version }, 200);
}
