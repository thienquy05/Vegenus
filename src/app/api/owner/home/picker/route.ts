import type { NextRequest } from "next/server";
import { answer, dbFailure, ownerAuth, signPreviews } from "@/lib/owner-api";

// The O17 photo picker (owner UI O17; PRD Q144; T2.4): ready photos of published memories, grouped by memory, newest
// first. Every thumbnail is signed in one pass (signPreviews), then handed back to its memory.
type Photo = { preview: { bucket: string; path: string } | null };

export async function POST(request: NextRequest) {
  const auth = await ownerAuth(request);
  if (auth instanceof Response) return auth;
  const { data, error } = await auth.rpc("owner_home_photos");
  if (error) return dbFailure(error);
  const memories = (data ?? []) as { photos: Photo[] }[];
  const signed = await signPreviews(auth, memories.flatMap((m) => m.photos));
  if (!signed) return answer(null, 503);
  let next = 0;
  return answer({ memories: memories.map((m) => ({ ...m, photos: signed.slice(next, (next += m.photos.length)) })) }, 200);
}
