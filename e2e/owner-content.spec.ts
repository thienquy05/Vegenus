import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { checkSizes } from "./owner-checks";

// O4 content list and O5 item editor against the local Supabase stack (owner UI "O4 Content list and O5 Item editor";
// Q140). Each browser project signs in as its own owner (owner-<project>, page e4/e5 from e2e/global-setup.ts) and
// works only on items it creates, named with a fresh id. Placeholder data only.
const PAGES = { chromium: "00000000-0000-0000-0000-0000000000e4", webkit: "00000000-0000-0000-0000-0000000000e5" };
const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1 });
const storage = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!).storage;
// A 1×1 WebP, the smallest real image the thumb bucket accepts.
const WEBP = Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=", "base64");

test.afterAll(async () => {
  await sql.end();
});

async function signIn(page: Page, project: string) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.101.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto("/login");
  await page.getByLabel("Email").fill(`owner-${project}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("placeholder-password-1");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL("/app");
  await page.getByRole("button", { name: /^Content/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Content/ })).toBeFocused();
}
const row = (page: Page, title: string) => page.locator("article").filter({ has: page.getByRole("heading", { name: title }) });

// An item with one finished photo whose thumbnail is in Storage, as O6 will leave it.
async function seedPhoto(project: keyof typeof PAGES, title: string) {
  const page = PAGES[project];
  const item = randomUUID();
  const media = randomUUID();
  const path = `pages/${page}/media/${media}/thumb`;
  await sql`insert into public.items (id, page_id, kind, lang, title, event_date, date_precision)
    values (${item}, ${page}, 'memory', 'vi', ${title}, '2024-05-01', 'month')`;
  await sql`insert into public.media (id, page_id, item_id, kind, state, width, height) values (${media}, ${page}, ${item}, 'photo', 'ready', 1, 1)`;
  await sql`insert into public.media_variants (media_id, page_id, variant, bucket, path, mime, bytes, write_until)
    values (${media}, ${page}, 'thumb', 'media-thumb', ${path}, 'image/webp', ${WEBP.length}, now())`;
  const { error } = await storage().from("media-thumb").upload(path, WEBP, { contentType: "image/webp" });
  expect(error).toBeNull();
  return { item, media, path };
}
async function removePhoto({ item, path }: { item: string; path: string }) {
  await storage().from("media-thumb").remove([path]);
  await sql`delete from public.items where id = ${item}`;
  await sql`delete from public.storage_deletions where path = ${path}`;
}

test("the owner writes, publishes, unpublishes and deletes an item through the list and the editor", async ({ page }, info) => {
  const title = `Kỷ niệm ${randomUUID().slice(0, 8)}`;
  try {
    await signIn(page, info.project.name);
    await page.getByRole("button", { name: /^New item/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Item editor/ })).toBeFocused();
    await page.getByLabel(/^Title/).fill(title);
    await page.getByRole("textbox", { name: /^Year/ }).fill("2024");
    await page.getByRole("textbox", { name: /^Month/ }).fill("5");
    await page.getByRole("textbox", { name: /^Day/ }).fill("12");
    await page.getByRole("button", { name: /^Save draft/ }).click();
    await expect(page.getByRole("main")).toContainText("Draft saved.");
    const [saved] = await sql`select status, event_date::text, date_precision from public.items where title = ${title}`;
    expect(saved).toEqual({ status: "draft", event_date: "2024-05-12", date_precision: "day" });

    await page.getByRole("button", { name: /^Publish/ }).click();
    await expect(page.getByRole("main")).toContainText("Published.");
    expect((await sql`select status from public.items where title = ${title}`)[0].status).toBe("published");

    await page.getByRole("button", { name: /^Back/ }).click();
    await expect(row(page, title)).toContainText("Published");
    await expect(row(page, title)).toContainText("2024-05-12");
    await row(page, title).getByRole("button", { name: /^Unpublish/ }).click();
    await expect(page.getByRole("dialog")).toContainText("Unpublish this item?");
    await page.getByRole("dialog").getByRole("button", { name: /^Unpublish/ }).click();
    await expect(row(page, title)).toContainText("Draft");
    expect((await sql`select status from public.items where title = ${title}`)[0].status).toBe("draft");

    await row(page, title).getByRole("button", { name: /^Open/ }).click();
    await page.getByRole("button", { name: /^Delete/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Delete/ }).click();
    await expect(page.getByRole("main")).toContainText("Item deleted.");
    await expect(row(page, title)).toHaveCount(0);
    expect(await sql`select 1 from public.items where title = ${title}`).toHaveLength(0);
  } finally {
    await sql`delete from public.items where title = ${title}`;
  }
});

test("a photo's signed preview shows under the owner CSP, and its alt text saves with the item", async ({ page }, info) => {
  const project = info.project.name as keyof typeof PAGES;
  const title = `Ảnh ${randomUUID().slice(0, 8)}`;
  const seeded = await seedPhoto(project, title);
  const blocked: string[] = [];
  page.on("console", (message) => message.text().includes("Content Security Policy") && blocked.push(message.text()));
  try {
    await signIn(page, project);
    await row(page, title).getByRole("button", { name: /^Open/ }).click();
    const thumb = page.locator("main img");
    await expect(thumb).toBeVisible();
    await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1);
    await page.getByLabel(/Photo alt text/).fill("Bãi biển lúc hoàng hôn");
    await page.getByRole("button", { name: /^Save draft/ }).click();
    await expect(page.getByRole("main")).toContainText("Draft saved.");
    expect((await sql`select alt from public.media where id = ${seeded.media}`)[0].alt).toBe("Bãi biển lúc hoàng hôn");
    expect(blocked).toEqual([]);
  } finally {
    await removePhoto(seeded);
  }
});

test("the list and the editor pass axe at phone, tablet and laptop, and reflow at 320 px with 200 % text", async ({ page }, info) => {
  test.slow();
  const project = info.project.name as keyof typeof PAGES;
  // Its own title: owner-upload.spec seeds the same prefix on this page and may run at the same time.
  const title = `Những kỷ niệm ấm áp giữa chiều dịu dàng ${randomUUID().slice(0, 8)}`;
  const seeded = await seedPhoto(project, title);
  try {
    await signIn(page, project);
    await expect(page.locator("article").first()).toBeVisible();
    await checkSizes(page, "O4 memories");
    await page.getByRole("button", { name: /^Together/ }).click();
    await expect(page.getByRole("button", { name: /^New item/ })).toBeVisible();
    await checkSizes(page, "O4 together");
    await page.getByRole("button", { name: /^New item/ }).click();
    await page.getByLabel(/Anniversary/).check();
    await page.getByLabel(/^Add a second language/).check();
    await page.getByRole("button", { name: /^Save draft/ }).click();
    await expect(page.getByRole("main")).toContainText("Check the highlighted fields before saving.");
    await checkSizes(page, "O5 new with errors");
    await page.getByRole("button", { name: /^Back/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Discard/ }).click();
    await page.getByRole("button", { name: /^Memories/ }).click();
    await page.locator("article").filter({ hasText: title }).getByRole("button", { name: /^Open/ }).click();
    await expect(page.locator("main img")).toBeVisible();
    await checkSizes(page, "O5 saved with a photo");
  } finally {
    await removePhoto(seeded);
  }
});
