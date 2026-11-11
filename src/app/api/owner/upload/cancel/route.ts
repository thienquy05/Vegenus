import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, ownerAuth } from "@/lib/owner-api";

// Cancel an upload in progress (owner UI O6; design 3 §3.4; T2.3b). Its files are queued for deletion and stay
// charged until they are confirmed gone; the screen must not claim the space is free at once.
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.media_id)) return answer(null, 400);
  const { data, error } = await auth.rpc("owner_upload_cancel", { media_id: b.media_id });
  if (error) return dbFailure(error);
  return data ? answer({}, 200) : answer(null, 404);
}
