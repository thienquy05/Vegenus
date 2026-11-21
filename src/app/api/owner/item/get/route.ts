import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, ownerAuth, signPreviews } from "@/lib/owner-api";

// One item for the editor (owner UI O5; T2.2). POST, because ownerAuth needs Origin (see /api/owner/page).
// An unknown id and another page's id are the same 404 (E56). Each finished media gets a preview URL signed with the
// owner's session in place of its {bucket, path} (signPreviews).
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.id)) return answer(null, 400);
  const { data, error } = await auth.rpc("owner_item_get", { item_id: b.id });
  if (error) return dbFailure(error);
  if (data === null) return answer(null, 404);
  if (!Array.isArray(data.media) || data.media.length === 0) return answer({ item: data }, 200);
  const media = await signPreviews(auth, data.media);
  return media ? answer({ item: { ...data, media } }, 200) : answer(null, 503);
}
