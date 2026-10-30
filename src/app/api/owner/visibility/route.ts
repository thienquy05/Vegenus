import type { NextRequest } from "next/server";
import { answer, ownerAuth } from "@/lib/owner-api";

// Set the page's visibility (design 1 §6, §10.1; T1.5c). Private and Published need an explicit confirm
// (screens O9): Private shuts every guest out, Published opens the page to anyone. The database checks
// the caller owns the page and that its wording is published (owner_set_visibility).
// The O9 screen that calls this comes with the owner screens (Phase 2).
const VISIBILITIES = ["private", "token_only", "published"];

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => null);
  const visibility = body?.visibility;
  if (typeof visibility !== "string" || !VISIBILITIES.includes(visibility)) return answer(null, 400);
  if (visibility !== "token_only" && body.confirm !== true) return answer({ error: "confirm_required" }, 400);

  const { error } = await auth.rpc("owner_set_visibility", { visibility });
  if (error?.code === "42501") return answer(null, 403);
  if (error?.code === "55000") return answer({ error: "wording_not_published" }, 409);
  if (error) return answer(null, 503);
  return answer({ visibility }, 200);
}
