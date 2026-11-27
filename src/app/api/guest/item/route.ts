import type { NextRequest } from "next/server";
import { guestAnswer as answer, guestItem, guestRequest, stillOpen } from "@/lib/guest";
import { isUuid } from "@/lib/owner-api";

// One published memory for G3 (T3.1c; design 1 §5). {id, token?} -> {item}. A missing item while the token still opens
// Memories is "not_found" (the memory was unpublished or removed); otherwise the not-available answer (token flow §6).
export async function POST(request: NextRequest) {
  const req = await guestRequest(request);
  if (!req) return answer(null, 403);
  const id: unknown = req.body?.id;
  if (!isUuid(id)) return answer(null, 400);
  if (!req.token) return answer({ error: "not_available" }, 404);
  try {
    const item = await guestItem(req.token, id as string);
    if (item) return answer({ item }, 200);
    return answer({ error: (await stillOpen(req.token, "memories")) ? "not_found" : "not_available" }, 404);
  } catch {
    return answer({ error: "unavailable" }, 503);
  }
}
