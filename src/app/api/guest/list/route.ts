import type { NextRequest } from "next/server";
import { guestAnswer as answer, guestList, guestRequest, type ListSection, stillOpen } from "@/lib/guest";
import { isUuid } from "@/lib/owner-api";

// A section's published items for G2 and G4 (T3.1b; design 1 §5). {section, after?: {sort, id}, token?} -> {items}.
// The database checks the token, the page and the section, so a dead token or a disabled section is an empty list.
const SECTIONS: ListSection[] = ["memories", "together"];
export async function POST(request: NextRequest) {
  const req = await guestRequest(request);
  if (!req) return answer(null, 403);
  const section: unknown = req.body?.section;
  const after: unknown = req.body?.after ?? null;
  const cursor = after as { sort?: unknown; id?: unknown } | null;
  if (!SECTIONS.includes(section as ListSection) || (cursor && (!Number.isFinite(cursor.sort) || !isUuid(cursor.id)))) return answer(null, 400);
  if (!req.token) return answer({ error: "not_available" }, 404);
  try {
    const items = await guestList(req.token, section as ListSection, cursor as { sort: number; id: string } | null);
    if (!items.length && !(await stillOpen(req.token, section as ListSection))) return answer({ error: "not_available" }, 404);
    return answer({ items }, 200);
  } catch {
    return answer({ error: "unavailable" }, 503);
  }
}
