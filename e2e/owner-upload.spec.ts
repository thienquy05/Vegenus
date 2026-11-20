import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { checkSizes } from "./owner-checks";

// O6 upload against the local Supabase stack (owner UI "O6 Upload for T2.3b"; Q139): a real photo is prepared in the
// browser, PUT to its signed URLs under the owner CSP (cross-origin, so CORS too) and confirmed. Each browser project
// signs in as its own owner (page e4/e5 from e2e/global-setup.ts) on a fresh item. Placeholder data only.
const PAGES = { chromium: "00000000-0000-0000-0000-0000000000e4", webkit: "00000000-0000-0000-0000-0000000000e5" };
const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1 });
const storage = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!).storage;
// A 1×1 PNG: decodable by every browser, so the screen prepares it for real.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test.afterAll(async () => {
  await sql.end();
});

async function openUpload(page: Page, project: keyof typeof PAGES, title: string) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.102.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto("/login");
  await page.getByLabel("Email").fill(`owner-${project}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("placeholder-password-1");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL("/app");
  await page.getByRole("button", { name: /^Content/ }).click();
  await page.locator("article").filter({ has: page.getByRole("heading", { name: title }) }).getByRole("button", { name: /^Open/ }).click();
  await page.getByRole("button", { name: /^Add photos or video/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Add photos or video/ })).toBeFocused();
}
async function seedItem(project: keyof typeof PAGES, title: string) {
  const item = randomUUID();
  await sql`insert into public.items (id, page_id, kind, lang, title, event_date, date_precision)
    values (${item}, ${PAGES[project]}, 'memory', 'vi', ${title}, '2024-05-01', 'month')`;
  return item;
}
async function removeItem(item: string) {
  const files = await sql`select bucket, path from public.media_variants where media_id in (select id from public.media where item_id = ${item})`;
  for (const bucket of new Set(files.map((f) => f.bucket as string))) {
    await storage().from(bucket).remove(files.filter((f) => f.bucket === bucket).map((f) => f.path as string));
  }
  await sql`delete from public.items where id = ${item}`;
  if (files.length) await sql`delete from public.storage_deletions where path = any(${files.map((f) => f.path as string)})`;
}

test("a photo is prepared, uploaded to its signed URLs and confirmed, then shows on the item", async ({ page }, info) => {
  const project = info.project.name as keyof typeof PAGES;
  const title = `Ảnh ${randomUUID().slice(0, 8)}`;
  const item = await seedItem(project, title);
  const blocked: string[] = [];
  page.on("console", (message) => /Content Security Policy|CORS/i.test(message.text()) && blocked.push(message.text()));
  try {
    await openUpload(page, project, title);
    await expect(page.getByRole("main")).toContainText("MB of");
    await page.locator("#files").setInputFiles({ name: "photo-01.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: /^Start uploads/ }).click();
    const row = page.locator("article").filter({ hasText: "photo-01.png" });
    await expect(row).toContainText("Saved");
    await expect(row).toContainText("Location data removed");
    await expect(page.getByRole("main")).toContainText("All files are confirmed.");

    const [media] = await sql`select id, state, width, height from public.media where item_id = ${item}`;
    expect([media.state, media.width, media.height]).toEqual(["ready", 1, 1]);
    const files = await sql`select bucket, path from public.media_variants where media_id = ${media.id} order by bucket`;
    expect(files.map((f) => f.bucket)).toEqual(["media-display", "media-thumb"]);
    for (const f of files) {
      const [{ size }] = await sql`select (metadata ->> 'size')::int as size from storage.objects where bucket_id = ${f.bucket} and name = ${f.path}`;
      expect(size, f.bucket).toBeGreaterThan(0);
    }
    expect(blocked).toEqual([]);

    // Done returns to the item, which reads the new photo with its preview.
    await page.getByRole("button", { name: /^Done/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Item editor/ })).toBeVisible();
    await expect(page.locator("main img")).toBeVisible();
  } finally {
    await removeItem(item);
  }
});

test("O6 passes axe at phone, tablet and laptop, and reflows at 320 px with 200 % text", async ({ page }, info) => {
  test.slow();
  const project = info.project.name as keyof typeof PAGES;
  const title = `Những kỷ niệm ấm áp giữa chiều dịu dàng ${randomUUID().slice(0, 8)}`;
  const item = await seedItem(project, title);
  try {
    await openUpload(page, project, title);
    await expect(page.getByRole("main")).toContainText("MB of");
    await checkSizes(page, "O6 empty");
    // A file the browser cannot read: an error row, and nothing reaches the server.
    await page.locator("#files").setInputFiles({ name: "broken-photo-with-a-long-file-name-01.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") });
    await page.getByRole("button", { name: /^Start uploads/ }).click();
    await expect(page.locator("article")).toContainText("Can’t read this file.");
    await checkSizes(page, "O6 unreadable file");
    expect(await sql`select 1 from public.media where item_id = ${item}`).toHaveLength(0);
  } finally {
    await removeItem(item);
  }
});
