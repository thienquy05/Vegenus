// The guest's presentation mode (3D approach §3.2, FR13): first match wins. Rules 1-2 are hard (`locked`: G8 shows
// Page disabled with the reason); 4-5 are hints a G8 pick beats. World is not built (Phase 5), so rules 6 (low memory,
// in-app browser) and 7 both give Page; the in-app check and the runtime-downgrade cap come with the 3D that needs them.
export type Mode = "page" | "static";
export type Signals = { webgl: boolean; reduce: boolean; pick?: Mode; saveData?: boolean; deviceMemory?: number };

export function chooseMode({ webgl, reduce, pick, saveData, deviceMemory }: Signals): { mode: Mode; locked?: "no3d" | "reduce" } {
  if (!webgl) return { mode: "static", locked: "no3d" };
  if (reduce) return { mode: "static", locked: "reduce" };
  if (pick) return { mode: pick };
  if (saveData || (deviceMemory ?? 2) < 2) return { mode: "static" };
  return { mode: "page" };
}

// Rule 1's probe: a WebGL 2 context that is not a slow software fallback, released at once.
export function hasWebgl2() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
