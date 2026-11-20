import { MediaError } from "./media";

// O6 queue rules (owner UI "O6 Upload for T2.3b"; Q139). The screen enforces the per-memory caps; the server does not
// count them. Each stage's copy key is `upload.<stage>`.
export type Stage =
  | "queued"
  | "preparingPhoto"
  | "preparingVideo"
  | "prepared"
  | "uploading"
  | "saving"
  | "ready"
  | "unsupported"
  | "heic"
  | "videoUnsupported"
  | "large"
  | "failed"
  | "canceled"
  | "notSaved";
type Picked = { name: string; type: string };

const PHOTO_CAP = 24;
const VIDEO_CAP = 1;
const VIDEO_NAME = /\.(mp4|mov|m4v|webm|3gp|mkv)$/i;

// Some browsers give no type for a video they cannot play; the name decides then.
export const kindOf = (file: Picked) => (file.type.startsWith("video/") || (!file.type && VIDEO_NAME.test(file.name)) ? "video" : "photo");

export function admit<F extends Picked>(files: F[], held: { photos: number; videos: number }) {
  let { photos, videos } = held;
  const added: F[] = [];
  const refused: { name: string; cap: "capPhoto" | "capVideo" }[] = [];
  for (const file of files) {
    const video = kindOf(file) === "video";
    if (video ? videos >= VIDEO_CAP : photos >= PHOTO_CAP) refused.push({ name: file.name, cap: video ? "capVideo" : "capPhoto" });
    else {
      if (video) videos++;
      else photos++;
      added.push(file);
    }
  }
  return { added, refused };
}

const WORKING: Stage[] = ["preparingPhoto", "preparingVideo", "uploading"];
// Not saved counts: Try again may still confirm it, so leaving asks first.
const UNFINISHED: Stage[] = ["queued", ...WORKING, "prepared", "saving", "notSaved"];
// Not saved has no Remove: the server may have kept the file, so the row stays until it is confirmed or refused.
const NO_REMOVE: Stage[] = [...WORKING, "prepared", "saving", "notSaved"];
export const actions = (stage: Stage) => ({
  cancel: WORKING.includes(stage),
  retry: ["failed", "canceled", "notSaved"].includes(stage),
  remove: !NO_REMOVE.includes(stage),
});
export const unfinished = (stage: Stage) => UNFINISHED.includes(stage);

export function failedStage(error: unknown, file: Picked, canCompressVideo: boolean): Stage {
  if (error instanceof MediaError && error.message === "too_large") return "large";
  if (/\.hei[cf]$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type)) return "heic";
  if (kindOf(file) === "video" && !canCompressVideo) return "videoUnsupported";
  return "unsupported";
}

export const usageLevel = (used: number, budget: number) => (budget <= 0 || used >= budget ? "full" : used >= budget * 0.8 ? "warning" : "ok");

// MB as the boards show them: MiB, the unit the budget is set in (900 MiB).
export const megabytes = (bytes: number, digits = 0) => (bytes / 1048576).toFixed(digits);
