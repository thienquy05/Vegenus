import { expect, test } from "@playwright/test";

test("home page shows the site name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vegenus");
});
