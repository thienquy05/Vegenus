import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { checkSizes } from "./owner-checks";

// T3.1b-c guest views against the local stack: the token page of e2e/global-setup.ts (Home, Memories and Together
// enabled, no Home item) opens G1 under the first-visit theme prompt, the menu reaches G2 with a published memory, its
// card opens the G3 album, G4 shows a published place in its sheet, a disabled section by URL is not found (E5), and every
// theme passes axe at phone, tablet and laptop and reflows at 320 px with 200 % text. Each browser project uses its
// own memory id. Placeholder data only.
const PAGE = "00000000-0000-0000-0000-0000000000e2";
const THEMES = ["a_dreamy", "b_cosmic", "c_cozy", "d_elegant"];

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 250) + 1}` });
});

test("G1, the menu, G2, G3 and G4 for a token guest, in every theme and size", async ({ page }) => {
  const sql = postgres(process.env.SUPABASE_DB_URL!, { max: 1 });
  const memory = randomUUID();
  const place = randomUUID();
  const title = `[TITLE_${memory.slice(0, 8)}]`;
  const placeTitle = `[PLACE_${place.slice(0, 8)}]`;
  try {
    await sql`insert into public.items (id, page_id, kind, lang, title, body, event_date, date_precision)
      values (${memory}, ${PAGE}, 'memory', 'en', ${title}, '[MESSAGE]', '2024-06-01', 'month'),
             (${place}, ${PAGE}, 'milestone', 'en', ${placeTitle}, '[NOTE]', '2024-07-01', 'month')`;
    await sql`update public.items i set status = 'published', published = public.item_snapshot(i) where i.id in (${memory}, ${place})`;

    await page.goto(`/g#${process.env.E2E_GUEST_TOKEN}`);
    await expect(page).toHaveURL("/g/home");
    // First visit (Q128): the theme prompt over Home, checked at every size, then skipped.
    const dialog = page.getByRole("dialog", { name: "Choose a theme" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { checked: true })).toBeFocused();
    await checkSizes(page, "theme prompt");
    await dialog.getByRole("button", { name: "Not now" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Partner A & Partner B");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();

    // E5: the page enables no wishes, so their address is not found.
    expect((await page.request.get("/g/wishes", { maxRedirects: 0 })).status()).toBe(404);

    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator("#guest-nav").getByRole("link", { name: "Memories" }).click(); // not Home's shortcut
    await expect(page).toHaveURL("/g/memories");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();

    // G3: the card opens the album at its own address; the message is its second page.
    await page.getByRole("link", { name: title }).click();
    await expect(page).toHaveURL(`/g/memories/${memory}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeFocused();
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText("[MESSAGE]")).toBeVisible();
    await checkSizes(page, "album message");

    // G4: Together from the menu; a place opens its sheet, Escape returns to the card.
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator("#guest-nav").getByRole("link", { name: "Together" }).click();
    await expect(page).toHaveURL("/g/together");
    const card = page.getByRole("button", { name: placeTitle });
    await card.click();
    const sheet = page.getByRole("dialog", { name: placeTitle });
    await expect(sheet.getByText("[NOTE]")).toBeVisible();
    await checkSizes(page, "place sheet");
    await page.keyboard.press("Escape");
    await expect(card).toBeFocused();

    for (const theme of THEMES) {
      await page.evaluate((t) => localStorage.setItem("vegenus_prefs", JSON.stringify({ theme: t })), theme);
      for (const path of ["/g/home", "/g/memories", `/g/memories/${memory}`, "/g/together"]) {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (path === "/g/memories") await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
        if (path === "/g/together") await expect(card).toBeVisible();
        await checkSizes(page, `${theme} ${path}`);
      }
    }
  } finally {
    await sql`delete from public.items where id in (${memory}, ${place})`;
    await sql.end();
  }
});
