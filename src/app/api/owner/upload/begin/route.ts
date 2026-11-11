import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, ownerAuth } from "@/lib/owner-api";

// Begin an upload (owner UI O6; design 3 §3.4; T2.3b). The database admits the files under the page lock and the
// budget (owner_upload_begin); then one signed upload URL is minted per admitted path with the owner's session, which
// the storage insert policy checks. upsert false: a finished file cannot be overwritten through its URL (security
// review of T2.3a). The browser uploads each file with its token; nothing else can write those paths.
const KINDS = ["photo", "video", "audio"];
const VARIANTS = ["thumb", "display", "poster", "full", "video", "audio"];

type Admitted = { media_id: string; write_until: string; files: { variant: string; bucket: string; path: string; max_bytes: number }[] };

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (
    !isUuid(b?.item_id) ||
    !KINDS.includes(b.kind) ||
    !Array.isArray(b.variants) ||
    b.variants.length === 0 ||
    !b.variants.every((v: unknown) => typeof v === "string" && VARIANTS.includes(v))
  ) {
    return answer(null, 400);
  }

  const { data, error } = await auth.rpc("owner_upload_begin", { item_id: b.item_id, kind: b.kind, variants: b.variants });
  if (error?.code === "53400") return answer({ error: "storage_full" }, 409);
  if (error) return dbFailure(error);
  if (data === null) return answer(null, 404); // not an item of the caller's page (E56)
  const admitted = data as Admitted;

  const files = [];
  for (const f of admitted.files) {
    const signed = await auth.storage.from(f.bucket).createSignedUploadUrl(f.path, { upsert: false });
    if (signed.error || !signed.data) {
      // Release the reservation now rather than at expiry; its paths stay fenced until write_until + drain.
      await auth.rpc("owner_upload_cancel", { media_id: admitted.media_id });
      return answer(null, 503);
    }
    files.push({ ...f, token: signed.data.token });
  }
  return answer({ media_id: admitted.media_id, write_until: admitted.write_until, files }, 200);
}
