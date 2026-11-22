import type { NextRequest } from "next/server";
import { answer, ownerAuth } from "@/lib/owner-api";

// The usage snapshot O2 and O10 read (T2.5a; PRD Q145 13; owner UI "O10 Usage"). POST, because ownerAuth needs Origin
// and browsers leave it off a same-origin GET. null: no page, or not its owner.
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const usage = await auth.rpc("owner_usage");
  if (usage.error) return answer(null, 503);
  return answer({ usage: usage.data }, 200);
}
