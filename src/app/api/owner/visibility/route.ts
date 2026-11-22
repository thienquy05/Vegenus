import type { NextRequest } from "next/server";
import { answer, isUuid, ownerAuth } from "@/lib/owner-api";

// Set the page's visibility (design 1 §6, §10.1; T1.5c). Private and Published need an explicit confirm
// (screens O9): Private shuts every guest out, Published opens the page to anyone (refused until Phase 3, Q146). The database checks
// the caller owns the page and that its wording is published (owner_set_visibility).
// T2.6 (Q146 20, 35): saves unconditionally; the request id makes a retry of a committed save apply nothing, and every
// save answers the owner_page() snapshot O9 draws from.
const VISIBILITIES = ["private", "token_only", "published"];

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => null);
  const visibility = body?.visibility;
  const request_id = body?.request_id;
  if (typeof visibility !== "string" || !VISIBILITIES.includes(visibility) || !isUuid(request_id)) return answer(null, 400);
  if (visibility !== "token_only" && body.confirm !== true) return answer({ error: "confirm_required" }, 400);
  // Q146 (owner, 2026-11-22): Published waits for the Phase 3 public guest route; until then no client can store it,
  // so the page never turns public by itself the day that route ships. Phase 3 removes this line.
  if (visibility === "published") return answer({ error: "not_available" }, 409);

  const { data, error } = await auth.rpc("owner_set_visibility", { visibility, request_id });
  if (error?.code === "42501") return answer(null, 403);
  if (error?.code === "55000") return answer({ error: "wording_not_published" }, 409);
  if (error) return answer(null, 503);
  return answer({ page: data }, 200);
}
