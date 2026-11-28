import type { NextRequest } from "next/server";
import { GUEST_VARIANTS, type GuestVariant, guestAnswer as answer, guestMedia, guestRequest, stillOpen } from "@/lib/guest";
import { isUuid } from "@/lib/owner-api";

// Guest media URLs (T3.1a; design 1 §5; Q29). {ids, variant, token?} -> {urls: {id: url}}, signed for 5 minutes. The
// token comes from the HttpOnly cookie, or from the body when cookies are blocked and the visit runs from memory
// (design 1 §4, E30). The database decides which ids qualify, so an id that is foreign, missing, unpublished or in a
// disabled section is simply absent (E5, E6, E56).
export async function POST(request: NextRequest) {
  const req = await guestRequest(request);
  if (!req) return answer(null, 403);
  const ids: unknown = req.body?.ids;
  const variant: unknown = req.body?.variant;
  if (!Array.isArray(ids) || ids.length > 100 || !ids.every(isUuid) || !GUEST_VARIANTS.includes(variant as GuestVariant)) return answer(null, 400);
  if (!req.cred) return answer({ error: "not_available" }, 404);
  try {
    const urls = await guestMedia(req.cred, ids, variant as GuestVariant);
    if (ids.length && !Object.keys(urls).length && !(await stillOpen(req.cred))) return answer({ error: "not_available" }, 404);
    return answer({ urls }, 200);
  } catch {
    return answer({ error: "unavailable" }, 503);
  }
}
