import type { NextRequest } from "next/server";
import { answer, dbFailure, isVersion, ownerAuth } from "@/lib/owner-api";

// O8's one acknowledgement after a reveal renders (Q146 12): owner_token_shown sets shown_at on that version only
// while it is active. shown false: the link was replaced, so O8 reads the metadata again. A failed call leaves
// shown_at empty and the next read shows "display not confirmed".
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const version = (await request.json().catch(() => null))?.version;
  if (!isVersion(version)) return answer(null, 400);
  const { data, error } = await auth.rpc("owner_token_shown", { version });
  if (error) return dbFailure(error);
  return answer({ shown: data }, 200);
}
