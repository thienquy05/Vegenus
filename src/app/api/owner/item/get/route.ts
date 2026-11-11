import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, ownerAuth } from "@/lib/owner-api";

// One item for the editor (owner UI O5; T2.2). POST, because ownerAuth needs Origin (see /api/owner/page).
// An unknown id and another page's id are the same 404 (E56).
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.id)) return answer(null, 400);
  const { data, error } = await auth.rpc("owner_item_get", { item_id: b.id });
  if (error) return dbFailure(error);
  return data === null ? answer(null, 404) : answer({ item: data }, 200);
}
