import type { NextRequest } from "next/server";
import { answer, dbFailure, ownerAuth } from "@/lib/owner-api";

// One section's items, drafts included, for the content list (owner UI O4; T2.2).
const SECTIONS = ["home", "memories", "together", "zodiac", "guestbook"];

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!SECTIONS.includes(b?.section)) return answer(null, 400);
  const { data, error } = await auth.rpc("owner_items_list", { section: b.section });
  if (error) return dbFailure(error);
  return answer({ items: data }, 200);
}
