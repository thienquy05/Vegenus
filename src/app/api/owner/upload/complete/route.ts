import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, ownerAuth } from "@/lib/owner-api";

// Complete an upload (owner UI O6; design 3 §3.4; T2.3b). The database reads the real file sizes from storage, never
// the browser's; width, height and duration come from the processed file in the browser.
const dimension = (value: unknown) => value === null || (Number.isInteger(value) && (value as number) > 0 && (value as number) <= 2 ** 31 - 1);

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.media_id) || !dimension(b.width) || !dimension(b.height) || !dimension(b.duration_ms)) {
    return answer(null, 400);
  }
  const { data, error } = await auth.rpc("owner_upload_complete", {
    media_id: b.media_id,
    width: b.width,
    height: b.height,
    duration_ms: b.duration_ms,
  });
  if (error) return dbFailure(error);
  if (data === "ready") return answer({ state: "ready" }, 200);
  if (data === "too_large") return answer({ error: "too_large" }, 422);
  if (data === "incomplete") return answer({ error: "incomplete" }, 409);
  return answer(null, 404); // no reservation: unknown, late, cancelled or not the caller's (E56)
}
