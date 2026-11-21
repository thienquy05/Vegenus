import type { NextRequest } from "next/server";
import { answer, dbFailure, ownerAuth, signPreviews } from "@/lib/owner-api";

// Home for O17 and the O2 Home card (owner UI O17; PRD Q144; T2.4): the draft with its picks in order, the page time
// zone for the counter, and whether the published Home differs. No Home yet is {home: null}, not a 404 (O2: Set up
// Home). Each pick's thumbnail is signed with the owner's session (signPreviews).
export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const { data, error } = await auth.rpc("owner_home_get");
  if (error) return dbFailure(error);
  if (data === null) return answer({ home: null }, 200);
  const picks = await signPreviews(auth, data.picks ?? []);
  return picks ? answer({ home: { ...data, picks } }, 200) : answer(null, 503);
}
