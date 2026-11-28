import type { NextRequest } from "next/server";
import { guestAnswer as answer, guestRequest, guestWishes, stillOpen } from "@/lib/guest";
import { isTimestamp, isUuid } from "@/lib/owner-api";

// Approved wishes for G5 (T3.1b; design 1 §5). {after?: {created_at, id}, token?} -> {entries}, newest first.
export async function POST(request: NextRequest) {
  const req = await guestRequest(request);
  if (!req) return answer(null, 403);
  const cursor = (req.body?.after ?? null) as { created_at?: unknown; id?: unknown } | null;
  const at = cursor?.created_at;
  if (req.body === null || (cursor && (!isTimestamp(at) || !isUuid(cursor.id)))) return answer(null, 400);
  if (!req.cred) return answer({ error: "not_available" }, 404);
  try {
    const entries = await guestWishes(req.cred, cursor as { created_at: string; id: string } | null);
    if (!entries.length && !(await stillOpen(req.cred, "guestbook"))) return answer({ error: "not_available" }, 404);
    return answer({ entries }, 200);
  } catch {
    return answer({ error: "unavailable" }, 503);
  }
}
