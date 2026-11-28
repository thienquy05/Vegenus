import { expect, request as api, test, type Browser } from "@playwright/test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { checkSizes } from "./owner-checks";

// T3.3 English and Vietnamese against the local stack (E12, E13, E54; editable copy §4 "Language availability"; Q67).
// Each worker makes its own Published page, default Vietnamese, whose labels are long Vietnamese phrases with emoji,
// with one Vietnamese-only memory and one wish sent in decomposed form. Placeholder text only: phrases, no names.
const THEMES = ["a_dreamy", "b_cosmic", "c_cozy", "d_elegant"];
const LABEL_A = "Người Thương Ở Phương Trời Xa 🌸";
const LABEL_B = "Bạn Đồng Hành Dịu Dàng Nhất 💞";
const WISH_NAME = "Khách Phương Xa Ghé Thăm Nhà 🎉";
const WISH_BODY = "Chúc hai bạn mãi hạnh phúc, thương nhau trọn đời! Đường dài có nhau. 💐👩‍❤️‍👨";
const TITLE = "Kỷ niệm đầu tiên ở thành phố sương mù";
const ip = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

let sql: postgres.Sql;
let pageId: string, vanity: string, memory: string;

test.beforeAll(async ({ baseURL }) => {
  sql = postgres(process.env.SUPABASE_DB_URL!, { max: 1 });
  pageId = randomUUID();
  memory = randomUUID();
  vanity = `lang-${pageId.slice(0, 8)}`;
  await sql`insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at, setup_completed_at, label_a, label_b, vanity_name)
    values (${pageId}, 'a_dreamy', 'vi', 'published', 'UTC', now(), now(), ${LABEL_A}, ${LABEL_B}, ${vanity})`;
  await sql`update public.page_sections set enabled = true where page_id = ${pageId} and section in ('home', 'memories', 'guestbook')`;
  await sql`insert into public.items (id, page_id, kind, lang, title, body, event_date, date_precision)
    values (${memory}, ${pageId}, 'memory', 'vi', ${TITLE}, 'Lời nhắn bằng tiếng Việt.', '2024-06-01', 'month')`;
  await sql`update public.items i set status = 'published', published = public.item_snapshot(i) where i.id = ${memory}`;

  // The wish goes in decomposed (NFD), as some keyboards send it, then is approved.
  const ctx = await api.newContext({ baseURL, extraHTTPHeaders: { origin: new URL(baseURL!).origin, "x-vegenus-guest": "1", "x-forwarded-for": ip() } });
  const sent = await ctx.post("/api/guest/wish", {
    data: { submission_id: randomUUID(), display_name: WISH_NAME.normalize("NFD"), body: WISH_BODY.normalize("NFD"), lang: "vi", page: vanity, consent: 1 },
  });
  expect(sent.status()).toBe(200);
  await ctx.dispose();
});

test.afterAll(async () => {
  await sql`delete from public.pages where id = ${pageId}`;
  await sql.end();
});

// A returning guest (a theme saved, so no first-visit prompt) with this phone language and, optionally, a saved one.
async function guest(browser: Browser, locale: string, prefs: object = {}) {
  const ctx = await browser.newContext({ locale, extraHTTPHeaders: { "x-forwarded-for": ip() } });
  await ctx.addInitScript((p) => localStorage.setItem("vegenus_prefs", JSON.stringify({ theme: "a_dreamy", ...p })), prefs);
  return { ctx, page: await ctx.newPage() };
}

test("E12: decomposed Vietnamese and emoji are stored composed", async () => {
  expect(WISH_BODY.normalize("NFD")).not.toBe(WISH_BODY); // the test really sends a different form
  expect(await sql`select display_name, body from public.guestbook_entries where page_id = ${pageId}`).toEqual([
    { display_name: WISH_NAME, body: WISH_BODY },
  ]);
  await sql`update public.guestbook_entries set status = 'approved', moderated_at = now() where page_id = ${pageId}`;
});

// Each theme in its own test (one test for all four outran WebKit's 30 s on CI, guest-views.spec.ts).
for (const theme of THEMES) {
  test(`E12 ${theme}: long Vietnamese labels, a Vietnamese title and an emoji wish render whole and reflow`, async ({ browser }) => {
    await sql`update public.guestbook_entries set status = 'approved', moderated_at = now() where page_id = ${pageId}`;
    const { ctx, page } = await guest(browser, "vi-VN", { theme });
    await page.goto(`/p/${vanity}`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${LABEL_A} & ${LABEL_B}`);
    await checkSizes(page, `${theme} home`);
    await page.goto(`/p/${vanity}/memories/${memory}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
    await checkSizes(page, `${theme} album`);
    await page.goto(`/p/${vanity}/wishes`);
    await expect(page.getByText(WISH_BODY)).toBeVisible();
    await expect(page.getByText(WISH_NAME)).toBeVisible();
    await checkSizes(page, `${theme} wishes`);
    await ctx.close();
  });
}

test("E54: a language the owner has not finished is not offered; the default shows and G8 says why", async ({ browser }) => {
  await sql`update public.page_copy set published_text = null where page_id = ${pageId} and key = 'tour.3.body' and lang = 'en'`;
  try {
    const { ctx, page } = await guest(browser, "en-US");
    await page.goto(`/p/${vanity}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await page.getByRole("button", { name: "Mở menu" }).click();
    await page.locator("#guest-nav").getByRole("button", { name: "Cài đặt" }).click();
    const settings = page.getByRole("dialog", { name: "Cài đặt" });
    await expect(settings.getByRole("radio", { name: /English/ })).toBeDisabled();
    await expect(settings.getByRole("radio", { name: "Tiếng Việt" })).toBeChecked();
    await expect(settings.getByRole("group", { name: "Ngôn ngữ" })).toHaveAccessibleDescription("Chủ trang chưa thiết lập tiếng Anh.");
    await checkSizes(page, "G8 language not set up");
    await ctx.close();
  } finally {
    await sql`update public.page_copy set published_text = draft_text where page_id = ${pageId} and key = 'tour.3.body' and lang = 'en'`;
  }
  // Complete again: the English phone gets English.
  const { ctx, page } = await guest(browser, "en-US");
  await page.goto(`/p/${vanity}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await ctx.close();
});

test("E13 and Q67: a Vietnamese-only memory shows its own text to an English guest, marked, with the note", async ({ browser }) => {
  const { ctx, page } = await guest(browser, "vi-VN", { lang: "en" });
  await page.goto(`/p/${vanity}/memories/${memory}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAttribute("lang", "vi");
  await expect(page.getByText("Shown in the original language.")).toBeVisible();
  await ctx.close();
});

test("G-E1 speaks the phone's language before any page is known", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "vi-VN" });
  const page = await ctx.newPage();
  await page.goto("/g");
  await expect(page.getByText("Chạm thẻ hoặc quét mã QR để xem trang này.")).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("lang", "vi");
  await ctx.close();
  // The language saved in G8 on this device wins over the phone's.
  const saved = await guest(browser, "vi-VN", { lang: "en" });
  await saved.page.goto("/g");
  await expect(saved.page.getByText("Tap the tag or scan the QR code to see this page.")).toBeVisible();
  await saved.ctx.close();
});
