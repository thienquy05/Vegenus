import { expect, test } from "vitest";
import { MediaError } from "./media";
import { actions, admit, failedStage, kindOf, megabytes, unfinished, usageLevel, type Stage } from "./upload";

// O6 queue rules (owner UI "O6 Upload for T2.3b"; Q139: the screen enforces 24 photos and 1 video per memory, the
// server does not count them). Placeholder file names only.
const file = (name: string, type = "") => ({ name, type });

test("a file is a video by its type, or by its name when the browser gives no type", () => {
  expect(kindOf(file("clip.mp4", "video/mp4"))).toBe("video");
  expect(kindOf(file("CLIP.MOV"))).toBe("video");
  expect(kindOf(file("photo.heic", "image/heic"))).toBe("photo");
  expect(kindOf(file("photo.jpg"))).toBe("photo");
});

test("the caps count what the item and the queue already hold, and refuse each extra file by name", () => {
  const files = [file("a.jpg", "image/jpeg"), file("b.jpg", "image/jpeg"), file("v.mp4", "video/mp4"), file("w.mp4", "video/mp4")];
  expect(admit(files, { photos: 23, videos: 0 })).toEqual({
    added: [files[0], files[2]],
    refused: [
      { name: "b.jpg", cap: "capPhoto" },
      { name: "w.mp4", cap: "capVideo" },
    ],
  });
  expect(admit([files[2]], { photos: 0, videos: 1 }).added).toEqual([]);
});

test("each stage offers the board's actions: Cancel while working, Try again after a failure, Remove otherwise", () => {
  const offers = (stage: Stage) => Object.entries(actions(stage)).filter(([, on]) => on).map(([name]) => name);
  expect(offers("queued")).toEqual(["remove"]);
  for (const stage of ["preparingPhoto", "preparingVideo", "uploading"] as const) expect(offers(stage), stage).toEqual(["cancel"]);
  for (const stage of ["prepared", "saving"] as const) expect(offers(stage), stage).toEqual([]);
  expect(offers("ready")).toEqual(["remove"]);
  for (const stage of ["unsupported", "heic", "videoUnsupported", "large"] as const) expect(offers(stage), stage).toEqual(["remove"]);
  expect(offers("failed")).toEqual(["retry", "remove"]);
  expect(offers("canceled")).toEqual(["retry", "remove"]);
  expect(offers("notSaved")).toEqual(["retry"]);
});

// Not saved too: Try again may still confirm it, and leaving cancels its reservation.
test("leaving asks while a file is waiting, on its way, or not yet confirmed", () => {
  for (const stage of ["queued", "preparingPhoto", "preparingVideo", "prepared", "uploading", "saving", "notSaved"] as const) expect(unfinished(stage), stage).toBe(true);
  for (const stage of ["ready", "unsupported", "heic", "videoUnsupported", "large", "failed", "canceled"] as const)
    expect(unfinished(stage), stage).toBe(false);
});

test("a processing failure becomes the row's message", () => {
  expect(failedStage(new MediaError("too_large"), file("v.mp4", "video/mp4"), true)).toBe("large");
  expect(failedStage(new MediaError("unsupported"), file("p.HEIC"), true)).toBe("heic");
  expect(failedStage(new MediaError("unsupported"), file("v.mp4", "video/mp4"), false)).toBe("videoUnsupported");
  expect(failedStage(new MediaError("unsupported"), file("v.mp4", "video/mp4"), true)).toBe("unsupported");
  expect(failedStage(new Error("anything else"), file("p.jpg", "image/jpeg"), true)).toBe("unsupported");
});

test("storage is amber from 80 % and full at the budget (Q66, Q139)", () => {
  expect(usageLevel(79, 100)).toBe("ok");
  expect(usageLevel(80, 100)).toBe("warning");
  expect(usageLevel(100, 100)).toBe("full");
  expect(usageLevel(0, 0)).toBe("full");
});

test("sizes read in MB as the boards show them: the budget whole, a file to one decimal", () => {
  expect(megabytes(943718400)).toBe("900");
  expect(megabytes(2202009, 1)).toBe("2.1");
});
