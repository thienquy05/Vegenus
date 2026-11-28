import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, ownerAuth } from "@/lib/owner-api";

// O7 Delete (T3.2c; privacy design §6): {id} -> {status: "deleted"}. The wish goes at once, whatever its status; a
// wish that is not the page's, or already gone, is a 404.
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.id)) return answer(null, 400);
  const { data, error } = await auth.rpc("owner_wish_delete", { entry_id: b.id });
  if (error) return dbFailure(error);
  if (data === null) return answer({ error: "not_found" }, 404);
  return answer({ status: "deleted" }, 200);
}
