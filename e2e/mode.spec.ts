import { expect, test, type Browser } from "@playwright/test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { checkSizes } from "./owner-checks";

// T3.4 mode selector against the local stack (E2; 3D approach §3.2, guest UI §9 Mode). An in-app browser loads the page
// and settles on a mode that works: Static without WebGL 2 (G8 says why), Page with it, and the guest's G8 pick is kept.
// The WebGL 2 probe is stubbed so the result does not depend on the test machine's GPU. Placeholder data only.
const IN_APP = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/1.0",
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 [FBAN/EMA;FBAV/1.0;]",
];
const ip = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

let sql: postgres.Sql;
let pageId: string, vanity: string;

test.beforeAll(async () => {
  sql = postgres(process.env.SUPABASE_DB_URL!, { max: 1 });
  pageId = randomUUID();
  vanity = `mode-${pageId.slice(0, 8)}`;
  await sql`insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at, setup_completed_at, label_a, label_b, vanity_name)
    values (${pageId}, 'b_cosmic', 'en', 'published', 'UTC', now(), now(), '[PARTNER_A]', '[PARTNER_B]', ${vanity})`;
  await sql`update public.page_sections set enabled = true where page_id = ${pageId} and section in ('home', 'memories')`;
});

test.afterAll(async () => {
  await sql`delete from public.pages where id = ${pageId}`;
  await sql.end();
});

// A returning guest (a theme saved, so no first-visit prompt) in an in-app browser, with or without WebGL 2.
async function guest(browser: Browser, userAgent: string, webgl: boolean) {
  const ctx = await browser.newContext({ userAgent, locale: "en-US", extraHTTPHeaders: { "x-forwarded-for": ip() } });
  await ctx.addInitScript((ok) => {
    if (!localStorage.getItem("vegenus_prefs")) localStorage.setItem("vegenus_prefs", JSON.stringify({ theme: "b_cosmic" }));
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (kind === "webgl2") return ok ? ({ getExtension: () => null } as unknown as WebGL2RenderingContext) : null;
      return real.call(this, kind as "2d", ...(rest as []));
    } as typeof real;
  }, webgl);
  return { ctx, page: await ctx.newPage() };
}
async function settings(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.locator("#guest-nav").getByRole("button", { name: "Settings" }).click();
  return page.getByRole("dialog", { name: "Settings" });
}

for (const ua of IN_APP) {
  const app = ua.includes("Zalo") ? "Zalo" : "Facebook";
  test(`E2 ${app}: without WebGL 2 the page loads in Static; G8 shows Page disabled with the reason`, async ({ browser }) => {
    const { ctx, page } = await guest(browser, ua, false);
    await page.goto(`/p/${vanity}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("[PARTNER_A] & [PARTNER_B]");
    await expect(page.locator("html")).toHaveAttribute("data-mode", "static");
    const g8 = await settings(page);
    const view = g8.getByRole("group", { name: "View" });
    await expect(view.getByRole("radio", { name: "Page" })).toBeDisabled();
    await expect(view.getByRole("radio", { name: "Static" })).toBeChecked();
    await expect(view).toHaveAccessibleDescription("3D isn't available on this device.");
    await checkSizes(page, `${app} G8 no WebGL`);
    await ctx.close();
  });
}

test("E2: an in-app browser with WebGL 2 loads in Page; a G8 pick of Static applies at once and is kept", async ({ browser }) => {
  const { ctx, page } = await guest(browser, IN_APP[0], true);
  await page.goto(`/p/${vanity}`);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "page");
  const g8 = await settings(page);
  await g8.getByRole("radio", { name: "Static" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "static");
  await page.goto(`/p/${vanity}/memories`);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "static");
  await ctx.close();
});
