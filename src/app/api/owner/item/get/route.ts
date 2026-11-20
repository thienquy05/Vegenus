import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, ownerAuth } from "@/lib/owner-api";

// One item for the editor (owner UI O5; T2.2). POST, because ownerAuth needs Origin (see /api/owner/page).
// An unknown id and another page's id are the same 404 (E56). Each finished media gets a preview URL signed with the
// owner's session (the storage read policy admits only their own page's files) in place of its {bucket, path}; a file
// Storage cannot sign gets null, so the rest of the item still loads.
const PREVIEW_SECONDS = 3600;
type Preview = { bucket: string; path: string } | null;
type Media = { preview: Preview; [key: string]: unknown };

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.id)) return answer(null, 400);
  const { data, error } = await auth.rpc("owner_item_get", { item_id: b.id });
  if (error) return dbFailure(error);
  if (data === null) return answer(null, 404);
  if (!Array.isArray(data.media) || data.media.length === 0) return answer({ item: data }, 200);

  const media = data.media as Media[];
  const urls = new Map<string, string | null>();
  for (const bucket of new Set(media.flatMap((m) => (m.preview ? [m.preview.bucket] : [])))) {
    const paths = media.flatMap((m) => (m.preview?.bucket === bucket ? [m.preview.path] : []));
    const signed = await auth.storage.from(bucket).createSignedUrls(paths, PREVIEW_SECONDS);
    if (signed.error || !signed.data) return answer(null, 503);
    for (const s of signed.data) if (s.path) urls.set(`${bucket}/${s.path}`, s.signedUrl);
  }
  const withUrls = media.map(({ preview, ...m }) => ({
    ...m,
    preview_url: preview ? (urls.get(`${preview.bucket}/${preview.path}`) ?? null) : null,
  }));
  return answer({ item: { ...data, media: withUrls } }, 200);
}
