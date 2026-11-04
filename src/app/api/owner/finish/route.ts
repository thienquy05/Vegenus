import type { NextRequest } from "next/server";
import { answer, isVersion, ownerAuth } from "@/lib/owner-api";

// Finish in the setup wizard (owner UI O3 step 5; T2.1b). One database call accepts the drafted wording,
// marks setup finished and opens the page as Token-only (Q114); the body only names the version the review showed.
// The database refuses a second Finish (55000), a newer page and a page with a name or wording field empty (22023).
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const expected_version = (await request.json().catch(() => null))?.expected_version;
  if (!isVersion(expected_version)) return answer(null, 400);
  const { error } = await auth.rpc("owner_copy_accept_defaults", { visibility: "token_only", expected_version });
  if (error?.code === "42501") return answer(null, 403);
  if (error?.code === "55000") return answer({ error: "setup_finished" }, 409);
  // Another session saved after the review or cleared a name: the wizard reloads, as on a version conflict (Q125).
  if (error?.code === "22023") return answer({ error: "changed_elsewhere" }, 409);
  // No SQLSTATE (PostgREST never answered), a broken connection (08) or PostgREST losing the database: the call may
  // have broken after the commit, so the outcome is unknown (Q126).
  if (error && (!error.code || error.code.startsWith("08") || ["PGRST000", "PGRST001"].includes(error.code)))
    return answer({ error: "outcome_unknown" }, 502);
  if (error) return answer({ error: "not_published" }, 503);
  return answer({ visibility: "token_only" }, 200);
}
