import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { MIN_TARGET_PX } from "../src/lib/ui";

// Owner-area accessibility checks shared by the owner specs. They live in specs that run against Supabase, not in a
// *.a11y.ts file, because the a11y CI job runs no Supabase.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
export const SIZES = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 900 },
];

export async function axe(page: Page, where: string) {
  // Messages fade in (120 ms): measure the settled colours, not a frame of the fade.
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"));
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(violations.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target}: ${n.failureSummary}`)), where).toEqual([]);
}

// WCAG 1.4.10 and 1.4.4: 320 px wide with text at 200 %, no page scroll and every control still 44 px.
export async function reflow(page: Page, where: string) {
  const problems = await page.evaluate((min) => {
    const out: string[] = [];
    if (document.documentElement.scrollWidth > innerWidth) out.push(`page scrolls: ${document.documentElement.scrollWidth}`);
    for (const el of document.querySelectorAll<HTMLElement>("main button, main a, main input, main select")) {
      const box = el.getBoundingClientRect();
      if (!box.width || el.closest("[inert], dialog:not([open])") || el.matches("[type=checkbox], [type=radio]")) continue;
      if (box.height < min || box.width < min) out.push(`small target: ${el.outerHTML.slice(0, 60)}`);
      if (box.right > innerWidth + 0.5) out.push(`off screen: ${el.outerHTML.slice(0, 60)}`);
    }
    return out;
  }, MIN_TARGET_PX);
  expect(problems, where).toEqual([]);
}

// axe at phone, tablet and laptop, then reflow at 320 px with 200 % text (set through the CSSOM: the page CSP refuses
// an injected <style>).
export async function checkSizes(page: Page, where: string) {
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await axe(page, `${where} ${size.width}`);
  }
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("32px");
  await reflow(page, `${where} 320 @ 200%`);
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
}
