import { expect, test } from "vitest";
import { chooseMode } from "./mode";

// T3.4, 3D approach §3.2 test 1: the mode rules as a pure function, first match wins. World is not built (Phase 5),
// so rules 6 and 7 both give Page. `locked` names a hard rule: G8 shows Page disabled with that reason.
const yes = { webgl: true, reduce: false };
test.each([
  ["1: no WebGL 2 is Static and locked, even with a pick", { webgl: false, reduce: false, pick: "page" }, { mode: "static", locked: "no3d" }],
  ["2: Reduce motion is Static and locked, even with a pick", { webgl: true, reduce: true, pick: "page" }, { mode: "static", locked: "reduce" }],
  ["1 before 2", { webgl: false, reduce: true }, { mode: "static", locked: "no3d" }],
  ["3: a G8 pick of Static", { ...yes, pick: "static" }, { mode: "static" }],
  ["3: a G8 pick of Page beats saveData", { ...yes, pick: "page", saveData: true }, { mode: "page" }],
  ["3: a G8 pick of Page beats low memory", { ...yes, pick: "page", deviceMemory: 1 }, { mode: "page" }],
  ["4: saveData", { ...yes, saveData: true }, { mode: "static" }],
  ["5: deviceMemory below 2", { ...yes, deviceMemory: 1 }, { mode: "static" }],
  ["6: deviceMemory 2 is Page", { ...yes, deviceMemory: 2 }, { mode: "page" }],
  ["7: otherwise Page (World not offered)", yes, { mode: "page" }],
] as const)("%s", (_, signals, expected) => {
  expect(chooseMode(signals)).toEqual(expected);
});
