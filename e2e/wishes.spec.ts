import { expect, request as api, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { checkSizes } from "./owner-checks";

// T3.2 wishes against the local stack (design 3 §3.9 and §9 rows E11, E46, E47; Q73, Q75, Q78, Q103). Each worker
// makes its own Published page (with a token too) so the per-page and per-IP buckets are its own. Placeholder data only.
let sql: postgres.Sql;
let pageId: string, name: string, token: string;

// A Published page with Wishes on, at its own name.
async function makePage() {
  const id = randomUUID();
  const vanity = `wish-${id.slice(0, 8)}`;
  await sql`insert into public.pages (id, theme, default_lang, visibility, timezone, copy_published_at, setup_completed_at, label_a, label_b, vanity_name)
    values (${id}, 'a_dreamy', 'en', 'published', 'UTC', now(), now(), 'Partner A', 'Partner B', ${vanity})`;
  await sql`update public.page_sections set enabled = true where page_id = ${id} and section in ('home', 'guestbook')`;
  return { id, vanity };
}

test.beforeAll(async () => {
  sql = postgres(process.env.SUPABASE_DB_URL!, { max: 1 });
  ({ id: pageId, vanity: name } = await makePage());
  token = randomBytes(32).toString("base64url");
  await sql`insert into public.guest_tokens (page_id, version, token_hash, request_id)
    values (${pageId}, 1, sha256(convert_to(${token}, 'UTF8')), gen_random_uuid())`;
});

test.afterAll(async () => {
  await sql`delete from public.pages where id = ${pageId}`;
  await sql.end();
});

// A fresh browser: its own cookie jar, on one network address.
const browser = (baseURL: string, ip: string) =>
  api.newContext({ baseURL, extraHTTPHeaders: { origin: new URL(baseURL).origin, "x-vegenus-guest": "1", "x-forwarded-for": ip } });
const wish = (ctx: APIRequestContext, extra: object = {}, submission_id = randomUUID()) =>
  ctx.post("/api/guest/wish", { data: { submission_id, display_name: "[GUEST]", body: "[WISH_TEXT]", lang: "en", page: name, consent: 1, ...extra } });
const entries = () => sql`select author_kind, status, token_version from public.guestbook_entries where page_id = ${pageId} order by created_at`;

test("a visitor's wishes: one device cookie, a retry counted once, the 4th refused, another browser still welcome", async ({ baseURL }) => {
  const ip = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  const first = await browser(baseURL!, ip);
  const sub = randomUUID();
  const sent = await wish(first, {}, sub);
  expect(sent.status()).toBe(200);
  expect(await sent.json()).toEqual({ status: "sent" });
  const cookie = sent.headersArray().find((h) => h.name.toLowerCase() === "set-cookie" && h.value.startsWith("vegenus_d="))!.value;
  expect(cookie).toMatch(/HttpOnly/i);
  const device = cookie.slice("vegenus_d=".length, cookie.indexOf(";"));

  // A lost response, sent again (Q73): the first result, one entry.
  expect(await (await wish(first, {}, sub)).json()).toEqual({ status: "sent" });
  expect(await entries()).toEqual([{ author_kind: "visitor", status: "pending", token_version: null }]);

  // The cookie is reused, so the device limit applies: 3 per rolling 24 h (Q75).
  for (let n = 2; n <= 3; n++) expect((await wish(first)).status()).toBe(200);
  const fourth = await wish(first);
  expect(fourth.status()).toBe(429);
  const limited = await fourth.json();
  expect(limited).toMatchObject({ error: "rate_limited", shared: false });
  expect(limited.retry_after).toBeGreaterThan(86_000);
  expect(limited.retry_after).toBeLessThanOrEqual(86_400);
  expect((await first.storageState()).cookies.find((c) => c.name === "vegenus_d")?.value).toBe(device);

  // A second fresh browser on the same address counts only toward the IP limit (20, Q78; E46).
  const second = await browser(baseURL!, ip);
  expect((await wish(second)).status()).toBe(200);
  expect((await entries()).length).toBe(4);
  await first.dispose();
  await second.dispose();
});

test("T3.2c: a post without consent to the current notice is refused, stores nothing and sets no device cookie", async ({ baseURL }) => {
  const ctx = await browser(baseURL!, `198.51.103.${Math.floor(Math.random() * 250) + 1}`);
  const before = (await entries()).length;
  expect((await wish(ctx, { consent: undefined })).status()).toBe(400);
  const old = await wish(ctx, { consent: 2 });
  expect(old.status()).toBe(409);
  expect(await old.json()).toEqual({ error: "needs_consent" });
  expect(old.headersArray().some((h) => h.name.toLowerCase() === "set-cookie" && h.value.startsWith("vegenus_d="))).toBe(false);
  expect(await entries()).toHaveLength(before);
  await ctx.dispose();
});

test("the token path, the exchange's device cookie, and no wish where the credential does not open the page", async ({ baseURL }) => {
  const guest = await browser(baseURL!, `198.51.100.${Math.floor(Math.random() * 250) + 1}`);
  const exchanged = await guest.post("/api/guest/session", { data: { token } });
  expect(exchanged.status()).toBe(200);
  const cookies = (await guest.storageState()).cookies.map((c) => c.name);
  expect(cookies).toEqual(expect.arrayContaining(["vegenus_g", "vegenus_d"]));

  const before = (await entries()).length;
  expect((await wish(guest, { page: undefined })).status()).toBe(200);
  expect((await entries()).at(-1)).toEqual({ author_kind: "token", status: "pending", token_version: 1 });

  // E47: a Token-only page by its name takes no visitor wish; a wrong token none either.
  await sql`update public.pages set visibility = 'token_only' where id = ${pageId}`;
  expect((await wish(guest)).status()).toBe(404);
  await sql`update public.pages set visibility = 'published' where id = ${pageId}`;
  expect((await wish(guest, { page: undefined, token: "Z".repeat(43) })).status()).toBe(404);
  expect((await entries()).length).toBe(before + 1);
  await guest.dispose();
});

// Design 3 §9: the guarantees under concurrency, straight at the database through 10 connections (the server's own
// pool has one, so requests through it never overlap). Keys are random 32-byte stand-ins for the server's HMACs.
test("under concurrency: one entry per submission, the device limit across pages, exactly 50 a page a day", async () => {
  const pool = postgres(process.env.SUPABASE_DB_URL!, { max: 10 });
  const made = [await makePage(), await makePage(), await makePage()];
  const [b, c, d] = made;
  const post = (page: string, sub: string, device: Buffer, ip: Buffer) =>
    pool`select public.public_guestbook_post(${page}, ${sub}::uuid, ${device}, ${ip}, '[GUEST]', '[WISH_TEXT]', 'en', 1) as r`.then(
      ([row]) => (row.r as { status: string } | null)?.status ?? "not_available",
    );
  const times = (n: number) => Array.from({ length: n }, (_, i) => i);
  const tally = (all: string[]) => all.reduce<Record<string, number>>((n, s) => ({ ...n, [s]: (n[s] ?? 0) + 1 }), {});
  try {
    // Eight sends of one submission at once (a retry storm): one entry, one charge on the device.
    const sub = randomUUID();
    const device = randomBytes(32);
    expect(await Promise.all(times(8).map(() => post(b.vanity, sub, device, randomBytes(32))))).toEqual(Array(8).fill("sent"));
    expect((await sql`select count(*)::int as n from public.guestbook_entries where submission_id = ${sub}`)[0].n).toBe(1);
    expect((await sql`select sum(count)::int as n from public.rate_limit_hits where scope = 'wish_device' and key_hash = ${device}`)[0].n).toBe(1);

    // One device posting on two pages at once: 3 in its window, the rest refused, none failing.
    const busy = randomBytes(32);
    const both = await Promise.all(times(6).map((i) => post(i % 2 ? b.vanity : c.vanity, randomUUID(), busy, randomBytes(32))));
    expect(tally(both)).toEqual({ sent: 3, rate_limited: 3 });

    // 60 different guests on one fresh page at once: exactly 50 (the page's day), the rest refused.
    const crowd = await Promise.all(times(60).map(() => post(d.vanity, randomUUID(), randomBytes(32), randomBytes(32))));
    expect(tally(crowd)).toEqual({ sent: 50, rate_limited: 10 });
  } finally {
    await sql`delete from public.pages where id in ${sql(made.map((p) => p.id))}`;
    await pool.end();
  }
});

// T3.2b in the browser: a visitor's G6 form, the daily-limit notice and G7 in every theme, each passing axe at phone,
// tablet and laptop and reflowing at 320 px with 200 % text. A fresh browser per theme, so its own device. The page has
// the default wording (wording_core): "Write to us", "Wish sent!", "Back to the wishes".
const THEMES = ["a_dreamy", "b_cosmic", "c_cozy", "d_elegant"];
async function leaveWish(page: Page, text: string) {
  await page.getByRole("button", { name: "Write to us" }).click();
  await page.getByLabel("Display name").fill("[GUEST]");
  await page.getByLabel("Your wish").fill(text);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send wish" }).click();
}
for (const theme of THEMES) {
  test(`G6, the daily-limit notice and G7 in ${theme}`, async ({ page }) => {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": `203.0.114.${Math.floor(Math.random() * 250) + 1}` });
    await page.goto(`/p/${name}/wishes`);
    await page.evaluate((t) => localStorage.setItem("vegenus_prefs", JSON.stringify({ theme: t, lang: "en" })), theme);
    await page.reload();
    await page.getByRole("button", { name: "Write to us" }).click();
    await expect(page.getByLabel("Display name")).toBeFocused();
    await checkSizes(page, `${theme} wish form`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("Display name").fill("[GUEST]");
    await page.getByLabel("Your wish").fill("[WISH_TEXT]");
    // T3.2c: unticked, Send asks for the box; P1 opens over the form in the theme and returns with the draft kept.
    await page.getByRole("button", { name: "Send wish" }).click();
    await expect(page.getByRole("checkbox")).toBeFocused();
    await expect(page.getByText("Tick the box to send your wish.")).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("link", { name: "privacy notice" }).click();
    const notice = page.getByRole("dialog", { name: "Privacy & cookies" });
    await expect(notice).toBeVisible();
    await checkSizes(page, `${theme} privacy notice over G6`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press("Escape");
    await expect(notice).toHaveCount(0);
    await expect(page.getByRole("link", { name: "privacy notice" })).toBeFocused();
    await expect(page.getByRole("checkbox")).toBeChecked();
    await expect(page.getByLabel("Your wish")).toHaveValue("[WISH_TEXT]");
    await page.getByRole("button", { name: "Send wish" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Wish sent!" })).toBeFocused();
    await checkSizes(page, `${theme} wish sent`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Back to the wishes" }).click();
    for (let n = 2; n <= 3; n++) {
      await leaveWish(page, `[WISH_${n}]`);
      await page.getByRole("button", { name: "Back to the wishes" }).click();
    }
    await leaveWish(page, "[WISH_4]");
    await expect(page.getByRole("alertdialog")).toContainText("Come back at");
    await checkSizes(page, `${theme} daily-limit notice`);
    await page.getByRole("button", { name: "I understand" }).click();
    await expect(page.getByRole("button", { name: "Send wish" })).toBeFocused();
  });
}

// O7 for the signed-in owner (owner-<project>, page e4/e5 from e2e/global-setup.ts): O2's count opens the queue, a wish
// is approved, and Back returns to Review wishes. Its wishes are removed afterwards.
const OWNER_PAGES = { chromium: "00000000-0000-0000-0000-0000000000e4", webkit: "00000000-0000-0000-0000-0000000000e5" };
test("O2's pending count opens O7; Approve moves the wish only once the server confirms; Delete removes one", async ({ page }, info) => {
  const project = info.project.name as keyof typeof OWNER_PAGES;
  const subs = [randomUUID(), randomUUID()];
  await sql`insert into public.guestbook_entries (page_id, display_name, body, lang, submission_id, author_kind, consent_version)
    values (${OWNER_PAGES[project]}, '[GUEST_1]', '[WISH_1]', 'vi', ${subs[0]}, 'visitor', 1),
           (${OWNER_PAGES[project]}, '[GUEST_2]', '[WISH_2]', 'en', ${subs[1]}, 'visitor', 1)`;
  try {
    await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.102.${Math.floor(Math.random() * 250) + 1}` });
    await page.goto("/login");
    await page.getByLabel("Email").fill(`owner-${project}@example.test`);
    await page.getByLabel("Password", { exact: true }).fill("placeholder-password-1");
    await page.getByRole("button", { name: /Sign in/ }).click();
    await expect(page).toHaveURL("/app");
    await expect(page.locator("#wishes-card")).toContainText(/\d+ waiting for approval/);
    await page.getByRole("button", { name: /^Review wishes/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Wishes/ })).toBeFocused();
    const card = page.locator("article").filter({ hasText: "[GUEST_1]" });
    await expect(card.locator("blockquote")).toHaveText("[WISH_1]");
    await checkSizes(page, "O7 queue");
    await page.setViewportSize({ width: 390, height: 844 });
    await card.getByRole("button", { name: /^Approve/ }).click();
    await expect(card).toHaveCount(0);
    expect((await sql`select status from public.guestbook_entries where submission_id = ${subs[0]}`)[0].status).toBe("approved");
    // T3.2c: Delete asks first, then the row is gone at once (privacy design §6, test 9).
    const other = page.locator("article").filter({ hasText: "[GUEST_2]" });
    await expect(other).toContainText("Consent given");
    await other.getByRole("button", { name: /^Delete/ }).click();
    const confirm = page.getByRole("dialog", { name: /Delete this wish for good\?/ });
    await expect(confirm).toBeVisible();
    await checkSizes(page, "O7 delete confirm");
    await page.setViewportSize({ width: 390, height: 844 });
    await confirm.getByRole("button", { name: /^Delete/ }).click();
    await expect(other).toHaveCount(0);
    expect(await sql`select 1 from public.guestbook_entries where submission_id = ${subs[1]}`).toHaveLength(0);
    // The queue is empty and this page has Wishes off, so the card is gone: focus goes to O2's heading.
    await page.getByRole("button", { name: /^Back/ }).click();
    await expect(page.locator("#wishes-card")).toHaveCount(0);
    await expect(page.locator("#dashboard-title")).toBeFocused();
  } finally {
    await sql`delete from public.guestbook_entries where submission_id in ${sql(subs)}`;
  }
});
