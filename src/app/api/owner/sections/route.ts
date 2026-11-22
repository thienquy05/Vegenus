import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, ownerAuth } from "@/lib/owner-api";

// O9's sections save for a finished page (owner UI O9; Q146 20, 21, 35). The draft sends the flags it was based on
// and the new ones; owner_save_sections answers null ("conflict") when the saved flags differ from that base, and a
// retry of a committed request id answers the snapshot without applying twice. Home stays on (Q118).
const SECTIONS = ["home", "memories", "together", "guestbook"];
// The base may hold zodiac (its flag is kept); O9 cannot switch it until T3.9 (Q118).
const BASE_SECTIONS = [...SECTIONS, "zodiac"];
const listOf = (value: unknown, allowed: string[]) =>
  Array.isArray(value) && value.every((section) => allowed.includes(section));

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const { base_sections, sections, request_id } = (await request.json().catch(() => null)) ?? {};
  if (!listOf(base_sections, BASE_SECTIONS) || !listOf(sections, SECTIONS) || !isUuid(request_id)) return answer(null, 400);

  const { data, error } = await auth.rpc("owner_save_sections", { base_sections, sections, request_id });
  if (error?.code === "55000") return answer({ error: "setup_not_finished" }, 409);
  if (error) return dbFailure(error);
  if (data === null) return answer({ error: "conflict" }, 409);
  return answer({ page: data }, 200);
}
