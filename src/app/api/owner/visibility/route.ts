import type { NextRequest } from "next/server";
import { answer, isUuid, ownerAuth } from "@/lib/owner-api";
import { normalizeVanity, vanityReason } from "@/lib/vanity";

// Set the page's visibility (design 1 §6, §10.1; T1.5c). Private and Published need an explicit confirm
// (screens O9): Private shuts every guest out, Published opens the page to anyone at its address. The database checks
// the caller owns the page and that its wording is published (owner_set_visibility).
// T2.6 (Q146 20, 35): the request id makes a retry of a committed save apply nothing, and every save answers the
// owner_page() snapshot O9 draws from.
// T3.1p (Q155-Q157; owner UI "O9 Published address"): the draft's base {visibility, vanity_name, has_link} must still
// match (else 409 conflict); Published needs an address under the shared rule (400 invalid_name with its reason) that
// no other page holds or held (409 name_taken). Token-only and Private keep the saved address and send none.
const VISIBILITIES = ["private", "token_only", "published"];
const isVisibility = (value: unknown): value is string => typeof value === "string" && VISIBILITIES.includes(value);

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => null);
  const { visibility, request_id, base } = body ?? {};
  const validBase = !!base && typeof base === "object" && isVisibility(base.visibility)
    && (base.vanity_name === null || typeof base.vanity_name === "string") && typeof base.has_link === "boolean";
  if (!isVisibility(visibility) || !isUuid(request_id) || !validBase) return answer(null, 400);
  if (visibility !== "token_only" && body.confirm !== true) return answer({ error: "confirm_required" }, 400);
  let vanity_name: string | null = null;
  if (visibility === "published") {
    const name = typeof body.vanity_name === "string" ? body.vanity_name : "";
    const reason = vanityReason(name);
    if (reason) return answer({ error: "invalid_name", reason }, 400);
    vanity_name = normalizeVanity(name);
  }

  const { data, error } = await auth.rpc("owner_set_visibility", {
    visibility, vanity_name, request_id,
    base: { visibility: base.visibility, vanity_name: base.vanity_name, has_link: base.has_link },
  });
  if (error?.code === "42501") return answer(null, 403);
  if (error?.code === "55000") return answer({ error: "wording_not_published" }, 409);
  if (error?.code === "23505") return answer({ error: "name_taken" }, 409);
  if (error?.code === "23514") return answer({ error: "invalid_name" }, 400);
  if (error) return answer(null, 503);
  if (data === null) return answer({ error: "conflict" }, 409);
  return answer({ page: data }, 200);
}
