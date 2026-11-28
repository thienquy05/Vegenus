import type { NextRequest } from "next/server";
import { answer, dbFailure, isTimestamp, isUuid, ownerAuth } from "@/lib/owner-api";

// O7: the page's wishes with one status (T3.2a; owner UI O7). {status, after?: {created_at, id}} -> {entries}; the queue
// oldest first, the history newest first, 50 at a time. The database checks the owner.
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  const after = b?.after ?? null;
  if (!["pending", "approved", "rejected"].includes(b?.status) || (after && (!isTimestamp(after.created_at) || !isUuid(after.id)))) {
    return answer(null, 400);
  }
  const { data, error } = await auth.rpc("owner_wishes", {
    which: b.status,
    after_created_at: after?.created_at ?? null,
    after_id: after?.id ?? null,
  });
  if (error) return dbFailure(error);
  return answer({ entries: data }, 200);
}
