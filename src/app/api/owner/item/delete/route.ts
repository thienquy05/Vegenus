import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, isVersion, ownerAuth } from "@/lib/owner-api";

// Delete an item, naming the version read (owner UI O4, O5; T2.2). A stale version and an id that is not the
// caller's answer the same (E56).
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.id) || !isVersion(b.expected_version)) return answer(null, 400);
  const { data, error } = await auth.rpc("owner_item_delete", { item_id: b.id, expected_version: b.expected_version });
  if (error) return dbFailure(error);
  return data ? answer({}, 200) : answer({ error: "changed_elsewhere" }, 409);
}
