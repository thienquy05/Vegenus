import type { NextRequest } from "next/server";
import { answer, ownerAuth } from "@/lib/owner-api";

// The saved setup and its drafted wording (Q124), read by the dashboard and wizard (owner UI O2, O3; T2.1b).
// POST, because ownerAuth needs Origin and browsers leave it off a same-origin GET. null: no page yet.
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const page = await auth.rpc("owner_page");
  if (page.error) return answer(null, 503);
  if (page.data === null) return answer({ page: null, drafts: null }, 200);
  const drafts = await auth.rpc("owner_copy_drafts");
  if (drafts.error) return answer(null, 503);
  return answer({ page: page.data, drafts: drafts.data }, 200);
}
