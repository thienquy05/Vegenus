import { expect, test } from "@playwright/test";
import { checkSizes } from "./owner-checks";

// T3.2c P1 standalone (privacy design §3.1, §3.2, §8 test 4): reachable with no token, the neutral look, never
// indexed, naming no one; the language follows the device's saved choice, else the browser's.
test("/privacy opens with no credential, says nothing about any page, passes axe and reflows", async ({ page, context }) => {
  await context.clearCookies();
  const res = await page.goto("/privacy");
  expect(res?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy & cookies" })).toBeVisible();
  await expect(page.getByText("Last updated 2026-11-27")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(/PARTNER|[\w.-]+@[\w-]+\.\w/); // no names, no contact address
  expect((await context.cookies()).map((c) => c.name)).toEqual([]); // reading the notice sets nothing
  await checkSizes(page, "privacy standalone");
  // On a phone the storage table becomes labelled records; on a laptop it is a table.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator("table tbody tr").first().evaluate((el) => getComputedStyle(el).display)).toBe("block");
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await page.locator("table tbody tr").first().evaluate((el) => getComputedStyle(el).display)).toBe("table-row");
  // Contents links move focus to the section and leave the address alone.
  await page.getByRole("link", { name: "How long" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /How long/ })).toBeFocused();
  expect(new URL(page.url()).hash).toBe("");
});

test("/privacy in Vietnamese from the browser language, and the device's saved choice wins", async ({ browser }) => {
  const vi = await browser.newContext({ locale: "vi-VN", extraHTTPHeaders: { "accept-language": "vi-VN,vi;q=0.9" } });
  const page = await vi.newPage();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Quyền riêng tư & cookie" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Quay lại" })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("vegenus_prefs", JSON.stringify({ lang: "en" })));
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy & cookies" })).toBeVisible();
  await vi.close();
});
