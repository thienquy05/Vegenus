import type { NextRequest } from "next/server";
import { HEAD_BYTES, contentOk, readsWhole } from "@/lib/media-check";
import { answer, dbFailure, isUuid, ownerAuth } from "@/lib/owner-api";

// Complete an upload (owner UI O6; design 3 §3.4; T2.3b). The database reads the real file sizes from storage, never
// the browser's; width, height and duration come from the processed file in the browser.
type Stored = { bucket: string; path: string; mime: string | null; present: boolean };

// Reads one stored file under the owner's session (the read policy covers a pending upload): a photo whole, video and
// sound only their first bytes. null when storage does not answer.
async function read(auth: Exclude<Awaited<ReturnType<typeof ownerAuth>>, Response>, f: Stored) {
  const signed = await auth.storage.from(f.bucket).createSignedUrl(f.path, 60);
  if (signed.error || !signed.data) return null;
  const headers: HeadersInit = readsWhole(f.mime!) ? {} : { range: `bytes=0-${HEAD_BYTES - 1}` };
  try {
    const res = await fetch(signed.data.signedUrl, { headers, signal: AbortSignal.timeout(10_000) });
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null; // storage too slow or the read broke off: the route answers 503 and the owner can retry
  }
}

const dimension = (value: unknown) => value === null || (Number.isInteger(value) && (value as number) > 0 && (value as number) <= 2 ** 31 - 1);

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.media_id) || !dimension(b.width) || !dimension(b.height) || !dimension(b.duration_ms)) {
    return answer(null, 400);
  }
  // Every file is checked by its bytes before the database marks the media ready (security gate, Phase 2). A file not
  // written yet answers incomplete before any read, so nothing can land after the check; a written file cannot change
  // (upsert off, and owners have no update or delete policy on storage).
  const listed = await auth.rpc("owner_upload_files", { media_id: b.media_id });
  if (listed.error) return dbFailure(listed.error);
  const files = listed.data as Stored[] | null;
  if (!files) return answer(null, 404);
  if (files.some((f) => !f.present)) return answer({ error: "incomplete" }, 409);
  for (const f of files) {
    const bytes = await read(auth, f);
    if (!bytes) return answer(null, 503);
    if (!contentOk(f.mime!, bytes)) {
      await auth.rpc("owner_upload_cancel", { media_id: b.media_id }); // fails the media and queues its files
      return answer({ error: "invalid_file" }, 409); // O6 shows it as failed: Try again restarts the upload
    }
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
