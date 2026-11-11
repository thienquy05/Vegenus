import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, ownerAuth } from "@/lib/owner-api";

// Delete one photo, clip or voice note, finished or not (owner UI O5, O6; design 3 §3.4; T2.3b). Under /upload, not
// /media: .gitignore keeps every media/ folder out of Git (privacy rule 3). Its files are queued for deletion and
// stay charged until the daily job confirms them gone (T2.3c).
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.media_id)) return answer(null, 400);
  const { data, error } = await auth.rpc("owner_media_delete", { media_id: b.media_id });
  if (error) return dbFailure(error);
  return data ? answer({}, 200) : answer(null, 404);
}
