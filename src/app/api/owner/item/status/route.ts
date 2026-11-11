import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, isVersion, ownerAuth } from "@/lib/owner-api";

// Publish or unpublish an item, naming the version read (owner UI O4, O5; T2.2). Guests see only published items.
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.id) || !isVersion(b.expected_version) || !["draft", "published"].includes(b.status)) {
    return answer(null, 400);
  }
  const { data, error } = await auth.rpc("owner_item_set_status", {
    item_id: b.id,
    expected_version: b.expected_version,
    status: b.status,
  });
  if (error) return dbFailure(error);
  if (data === null) return answer({ error: "changed_elsewhere" }, 409);
  return answer({ version: data }, 200);
}
