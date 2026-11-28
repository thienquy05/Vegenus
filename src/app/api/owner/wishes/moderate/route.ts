import type { NextRequest } from "next/server";
import { answer, dbFailure, isUuid, ownerAuth } from "@/lib/owner-api";

const STATUSES = ["pending", "approved", "rejected"];

// O7 Approve and Reject (T3.2a; owner UI O7). {id, status, expected} -> {status}; expected is the status the screen
// showed, so a decision made elsewhere first is a 409 (changed) and nothing is overwritten.
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const b = await request.json().catch(() => null);
  if (!isUuid(b?.id) || !["approved", "rejected"].includes(b.status) || !STATUSES.includes(b.expected) || b.status === b.expected)
    return answer(null, 400); // a no-op would restart a rejected wish's 30-day purge clock
  const { data, error } = await auth.rpc("owner_wish_moderate", { entry_id: b.id, status: b.status, expected: b.expected });
  if (error) return dbFailure(error);
  if (data === null) return answer({ error: "not_found" }, 404);
  if (data.error) return answer({ error: "changed" }, 409);
  return answer({ status: data.status }, 200);
}
