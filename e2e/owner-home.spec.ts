import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { checkSizes } from "./owner-checks";

// O2 Home card and O17 Home editor against the local Supabase stack (owner UI "O17 Home editor and the O2 Home card";
// PRD Q144; E14). Each browser project signs in as its own owner (owner-home-<project>, page e8/e9 from
// e2e/global-setup.ts), since a page has one Home. Placeholder data only.
const PAGES = { chromium: "00000000-0000-0000-0000-0000000000e8", webkit: "00000000-0000-0000-0000-0000000000e9" };
const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1 });
const storage = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!).storage;
// A 1×1 WebP, the smallest real image the thumb bucket accepts.
const WEBP = Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=", "base64");

test.afterAll(async () => {
  await sql.end();
});

// A published memory with two ready photos whose thumbnails are in Storage; the first has a description.
async function seedMemory(project: keyof typeof PAGES) {
  const page = PAGES[project];
  const item = randomUUID();
  const media = [randomUUID(), randomUUID()];
  const paths = media.map((m) => `pages/${page}/media/${m}/thumb`);
  await sql`delete from public.items where page_id = ${page}`;
  await sql`insert into public.items (id, page_id, kind, lang, title, event_date, date_precision, status, published)
    values (${item}, ${page}, 'memory', 'vi', 'Chuyến đi biển', '2024-05-01', 'month', 'published', '{}')`;
  for (const [i, m] of media.entries()) {
    await sql`insert into public.media (id, page_id, item_id, kind, state, width, height, position, alt)
      values (${m}, ${page}, ${item}, 'photo', 'ready', 1, 1, ${i}, ${i === 0 ? "Bãi biển" : null})`;
    await sql`insert into public.media_variants (media_id, page_id, variant, bucket, path, mime, bytes, write_until)
      values (${m}, ${page}, 'thumb', 'media-thumb', ${paths[i]}, 'image/webp', ${WEBP.length}, now())`;
    const { error } = await storage().from("media-thumb").upload(paths[i], WEBP, { contentType: "image/webp", upsert: true });
    expect(error).toBeNull();
  }
  return { page, media, paths };
}
async function cleanUp({ page, paths }: { page: string; paths: string[] }) {
  await storage().from("media-thumb").remove(paths);
  await sql`delete from public.items where page_id = ${page}`;
  await sql`delete from public.storage_deletions where path in ${sql(paths)}`;
}

async function signIn(page: Page, project: string) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.102.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto("/login");
  await page.getByLabel("Email").fill(`owner-home-${project}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("placeholder-password-1");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL("/app");
}
const card = (page: Page) => page.locator("section").filter({ has: page.locator("#home-card-title") });

test("the owner sets up Home from the dashboard: date, note, photos from a published memory, then publishes", async ({ page }, info) => {
  const project = info.project.name as keyof typeof PAGES;
  const seeded = await seedMemory(project);
  const blocked: string[] = [];
  page.on("console", (message) => message.text().includes("Content Security Policy") && blocked.push(message.text()));
  try {
    await signIn(page, project);
    await expect(card(page)).toContainText("No Home yet");
    await card(page).getByRole("button", { name: /^Set up Home/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Edit Home/ })).toBeFocused();

    await page.getByLabel(/^Together since/).fill("2020-02-29");
    await expect(page.locator("#home-zone")).toHaveText("UTC");
    await page.getByLabel(/^Welcome note/).fill("Chào mừng bạn");
    await page.getByRole("button", { name: /^Choose photos/ }).click();
    const picker = page.getByRole("dialog");
    await expect(picker).toContainText("Chuyến đi biển");
    await picker.getByLabel("Bãi biển").check();
    await picker.getByLabel(/No description yet/).check();
    await expect(picker).toContainText("2 of 7 photos selected");
    await picker.getByRole("button", { name: /^Use these photos/ }).click();
    await expect(page.locator("#home-stack > li")).toHaveCount(2);
    await expect(page.locator("#home-stack > li").first()).toContainText("Cover");
    await expect(page.getByRole("main")).toContainText("Pick 3 to 7 photos.");

    await page.getByRole("button", { name: /^Save draft/ }).click();
    await expect(page.getByRole("main")).toContainText("Draft saved.");
    const [saved] = await sql`select id, status, body, start_date::text from public.items where page_id = ${seeded.page} and kind = 'home'`;
    expect(saved).toMatchObject({ status: "draft", body: "Chào mừng bạn", start_date: "2020-02-29" });
    expect(await sql`select media_id, position from public.home_picks where item_id = ${saved.id} order by position`).toEqual([
      { media_id: seeded.media[0], position: 0 },
      { media_id: seeded.media[1], position: 1 },
    ]);
    // The pick previews are signed and load under the owner CSP.
    const thumb = page.locator("#home-stack img").first();
    await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1);

    await page.getByRole("button", { name: /^Publish/ }).click();
    await expect(page.getByRole("main")).toContainText("Published.");
    expect((await sql`select status from public.items where id = ${saved.id}`)[0].status).toBe("published");
    expect((await sql`select count(*)::int as n from public.home_picks where item_id = ${saved.id} and published_position is not null`)[0].n).toBe(2);

    await page.getByRole("button", { name: /^Back/ }).click();
    await expect(page.locator("#home-card-title")).toBeFocused();
    await expect(card(page)).toContainText("Published");
    await expect(card(page)).toContainText(/Day \d+ together/);
    expect(blocked).toEqual([]);
  } finally {
    await cleanUp(seeded);
  }
});

test("the Home card and the editor pass axe at phone, tablet and laptop, and reflow at 320 px with 200 % text", async ({ page }, info) => {
  test.slow();
  const project = info.project.name as keyof typeof PAGES;
  const seeded = await seedMemory(project);
  try {
    await signIn(page, project);
    await expect(card(page)).toContainText("No Home yet");
    await checkSizes(page, "O2 with the Home card");
    await card(page).getByRole("button", { name: /^Set up Home/ }).click();
    await page.getByLabel(/^Add a second language/).check();
    await page.getByLabel(/^Welcome note/).fill("Những kỷ niệm ấm áp giữa chiều dịu dàng, ".repeat(16));
    await page.getByRole("button", { name: /^Save draft/ }).click();
    await expect(page.getByRole("main")).toContainText("Check the highlighted fields before saving.");
    await checkSizes(page, "O17 with errors");
    await page.getByLabel(/^Welcome note/).fill("Chào mừng bạn");
    await page.getByRole("button", { name: /^Choose photos/ }).click();
    await expect(page.getByRole("dialog")).toContainText("Chuyến đi biển");
    await checkSizes(page, "O17 picker");
    await page.getByRole("dialog").getByLabel("Bãi biển").check();
    await page.getByRole("dialog").getByRole("button", { name: /^Use these photos/ }).click();
    await expect(page.locator("#home-stack > li")).toHaveCount(1);
    await checkSizes(page, "O17 with a pick");
  } finally {
    await cleanUp(seeded);
  }
});
