import { expect, test } from "vitest";
import { SITE_NAME } from "./site";

test("site name is Vegenus", () => {
  expect(SITE_NAME).toBe("Vegenus");
});
