import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { checkSizes } from "./owner-checks";

// T3.1b guest views against the local stack: the token page of e2e/global-setup.ts (Home and Memories enabled, no Home
// item) opens G1, the menu reaches G2 with a published memory, a disabled section by URL is not found (E5), and every
// theme passes axe at phone, tablet and laptop and reflows at 320 px with 200 % text. Each browser project uses its
// own memory id. Placeholder data only.
const PAGE = "00000000-0000-0000-0000-0000000000e2";
const THEMES = ["a_dreamy", "b_cosmic", "c_cozy", "d_elegant"];

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 250) + 1}` });
});

test("G1, the menu and G2 for a token guest, in every theme and size", async ({ page }) => {
  const sql = postgres(process.env.SUPABASE_DB_URL!, { max: 1 });
  const memory = randomUUID();
  const title = `[TITLE_${memory.slice(0, 8)}]`;
  try {
    await sql`insert into public.items (id, page_id, kind, lang, title, event_date, date_precision)
      values (${memory}, ${PAGE}, 'memory', 'en', ${title}, '2024-06-01', 'month')`;
    await sql`update public.items i set status = 'published', published = public.item_snapshot(i) where i.id = ${memory}`;

    await page.goto(`/g#${process.env.E2E_GUEST_TOKEN}`);
    await expect(page).toHaveURL("/g/home");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Partner A & Partner B");

    // E5: the page enables no wishes, so their address is not found.
    expect((await page.request.get("/g/wishes", { maxRedirects: 0 })).status()).toBe(404);

    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "Memories" }).click();
    await expect(page).toHaveURL("/g/memories");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();

    for (const theme of THEMES) {
      await page.evaluate((t) => localStorage.setItem("vegenus_prefs", JSON.stringify({ theme: t })), theme);
      for (const path of ["/g/home", "/g/memories"]) {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (path === "/g/memories") await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
        await checkSizes(page, `${theme} ${path}`);
      }
    }
  } finally {
    await sql`delete from public.items where id = ${memory}`;
    await sql.end();
  }
});
