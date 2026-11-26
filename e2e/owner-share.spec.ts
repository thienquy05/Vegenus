import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { checkSizes } from "./owner-checks";

// O2's Share entry and Visibility row, O8 Share and O9 Visibility against the local Supabase stack (owner UI "O8 Share
// and O9 Visibility for T2.6"; PRD Q146). Each browser project signs in as its own owner (owner-share-<project>, page
// ec/ed from e2e/global-setup.ts) and starts from a known state, so a retry passes too. Placeholder data only.
const PAGES = { chromium: "00000000-0000-0000-0000-0000000000ec", webkit: "00000000-0000-0000-0000-0000000000ed" };
const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1 });

test.afterAll(async () => {
  await sql.end();
});

async function start(page: Page, project: keyof typeof PAGES) {
  const id = PAGES[project];
  await sql`delete from public.guest_tokens where page_id = ${id}`;
  await sql`update public.pages set visibility = 'token_only' where id = ${id}`;
  await sql`update public.page_sections set enabled = section = 'home' where page_id = ${id}`;
  await sql`update public.pages set label_a = 'Partner A', label_b = 'Partner B', default_lang = 'en', timezone = 'UTC', theme = 'a_dreamy' where id = ${id}`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.104.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto("/login");
  await page.getByLabel("Email").fill(`owner-share-${project}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("placeholder-password-1");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL("/app");
  return id;
}

test("the owner creates the guest link on O8, sees it once with its QR, and the link opens the page", async ({ page, browser }, info) => {
  const id = await start(page, info.project.name as keyof typeof PAGES);
  const blocked: string[] = [];
  page.on("console", (message) => message.text().includes("Content Security Policy") && blocked.push(message.text()));
  await expect(page.locator("#share-state")).toContainText("Guest link: not created yet");
  await checkSizes(page, "O2 with the Share entry and the Visibility row");

  await page.locator("#share-entry").click();
  await expect(page.locator("#share-title")).toBeFocused();
  await expect(page.getByRole("main")).toContainText("Create a guest link.");
  await checkSizes(page, "O8 without a link");

  await page.locator("#share-create").click();
  await expect(page.locator("#reveal-title")).toBeFocused();
  const link = (await page.locator("#reveal-link").textContent())!;
  expect(link).toMatch(/^http:\/\/localhost:3000\/g#[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole("img", { name: /QR code for your guest link/ })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Guest link created");
  await checkSizes(page, "O8 reveal");
  // The acknowledgement reached the database.
  await expect.poll(async () => (await sql`select shown_at from public.guest_tokens where page_id = ${id} and active`)[0]?.shown_at).not.toBeNull();

  const guest = await (await browser.newContext()).newPage();
  await guest.setExtraHTTPHeaders({ "x-forwarded-for": `203.0.114.${Math.floor(Math.random() * 250) + 1}` });
  await guest.goto(link);
  await expect(guest).toHaveURL("/g/home");
  await guest.context().close();

  await page.locator("#share-done").click();
  await expect(page.locator("#dialog-cancel")).toBeFocused();
  await page.locator("#dialog-act").click();
  await expect(page.locator("#share-rotate")).toBeFocused();
  await expect(page.getByRole("main")).toContainText("shown on this screen once");
  await expect(page.getByRole("main")).not.toContainText(link);
  await page.locator("#share-rotate").click();
  await expect(page.locator("#share-dialog")).toContainText("Rotate the guest link?");
  await checkSizes(page, "O8 rotate confirm");
  await page.keyboard.press("Escape");
  await expect(page.locator("#share-rotate")).toBeFocused();

  await page.locator("#share-back").click();
  await expect(page.locator("#share-entry")).toBeFocused();
  await expect(page.locator("#share-state")).toContainText("Guest link created");
  expect(blocked).toEqual([]);
});

test("the owner changes sections and visibility on O9, each panel saved on its own", async ({ page }, info) => {
  const id = await start(page, info.project.name as keyof typeof PAGES);
  await page.locator("#visibility-change").click();
  await expect(page.locator("#visibility-title")).toBeFocused();
  await expect(page.locator("#vis-token_only")).toBeChecked();
  await expect(page.locator("#vis-published")).toBeDisabled();
  await checkSizes(page, "O9");

  await page.locator("#section-together").check();
  await expect(page.locator("#sections-status")).toContainText("Changes not saved");
  await checkSizes(page, "O9 with unsaved sections");
  await page.locator("#save-sections").click();
  await expect(page.getByRole("status")).toContainText("Saved");
  const enabled = await sql`select section from public.page_sections where page_id = ${id} and enabled order by section`;
  expect(enabled.map((r) => r.section)).toEqual(["home", "together"]);

  await page.locator("#vis-private").check();
  await page.locator("#save-visibility").click();
  await expect(page.locator("#visibility-dialog")).toContainText("Make the page private?");
  await checkSizes(page, "O9 Private confirm");
  await page.locator("#dialog-act").click();
  await expect.poll(async () => (await sql`select visibility from public.pages where id = ${id}`)[0].visibility).toBe("private");

  await page.locator("#vis-token_only").check();
  await page.locator("#visibility-back").click();
  await expect(page.locator("#visibility-dialog")).toContainText("Discard unsaved changes?");
  await page.locator("#dialog-act").click();
  await expect(page.locator("#visibility-change")).toBeFocused();
  await expect(page.locator("#visibility-card")).toContainText("Private");
  expect((await sql`select visibility from public.pages where id = ${id}`)[0].visibility).toBe("private");
});

// O19 Page settings (owner UI "O19 Page settings"; PRD Q115): each panel saved on its own, O2's card shows the result.
test("the owner changes names, time zone and suggested theme on O19, each panel saved on its own", async ({ page }, info) => {
  const id = await start(page, info.project.name as keyof typeof PAGES);
  const row = async () => (await sql`select label_a, label_b, timezone, theme from public.pages where id = ${id}`)[0];
  await page.locator("#settings-change").click();
  await expect(page.locator("#settings-title")).toBeFocused();
  await expect(page.locator("#settings-theme-a_dreamy")).toBeChecked();
  await checkSizes(page, "O19");

  await page.locator("#settings-label_b").fill(" Partner C ");
  await expect(page.locator("#names-status")).toContainText("Changes not saved");
  await checkSizes(page, "O19 with unsaved names");
  await page.locator("#save-names").click();
  await expect(page.getByRole("status")).toContainText("Saved");
  expect(await row()).toMatchObject({ label_a: "Partner A", label_b: "Partner C" });

  await page.locator("#settings-timezone").selectOption("Asia/Tokyo");
  await page.locator("#save-timezone").click();
  await expect.poll(async () => (await row()).timezone).toBe("Asia/Tokyo");

  await page.locator("#settings-theme-none").check();
  await page.locator("#save-theme").click();
  await expect.poll(async () => (await row()).theme).toBeNull();

  await page.locator("#settings-theme-c_cozy").check();
  await page.locator("#settings-back").click();
  await expect(page.locator("#settings-dialog")).toContainText("Discard unsaved changes?");
  await checkSizes(page, "O19 leave dialog");
  await page.locator("#dialog-act").click();
  await expect(page.locator("#settings-change")).toBeFocused();
  for (const part of ["Partner C", "Asia/Tokyo", "No suggestion"]) await expect(page.locator("#settings-card")).toContainText(part);
  expect((await row()).theme).toBeNull();
});
