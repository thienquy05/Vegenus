import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { MIN_TARGET_PX } from "../src/lib/ui";

// T2.1b: the dashboard (O2) and setup wizard (O3) against the local Supabase stack (E55; owner UI "O2 and O3
// revision for T2.1b"; Q114, Q121, Q124-Q126). Each browser project has its own owner, owner-setup-<project>,
// whose page beforeEach deletes, so every test starts with no page and a retry starts clean.
const ORIGIN = "http://localhost:3000";
const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1 });
const randomIp = (prefix: string) => `${prefix}.${Math.floor(Math.random() * 250) + 1}`;
const email = (project: string) => `owner-setup-${project}@example.test`;
const ownerPage = async (project: string) =>
  (await sql`select p.* from public.pages p join public.memberships m on m.page_id = p.id
    join auth.users u on u.id = m.user_id where u.email = ${email(project)} and m.role = 'owner'`)[0];
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.beforeEach(async ({}, info) => {
  await sql`delete from public.pages where id in (select m.page_id from public.memberships m
    join auth.users u on u.id = m.user_id where u.email = ${email(info.project.name)})`;
});
test.afterAll(async () => {
  await sql.end();
});

async function signIn(page: Page, project: string) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp("198.51.100") });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email(project));
  await page.getByLabel("Password", { exact: true }).fill("placeholder-password-1");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL("/app");
}

const heading = (page: Page, name: RegExp) => page.getByRole("heading", { level: 2, name });
const next = (page: Page) => page.getByRole("button", { name: /^Next/ }).click();

// Fills both names on step 1 and saves: the first Next creates the Private page (Q128). Ends on step 2.
async function createPage(page: Page) {
  await page.getByRole("button", { name: /Set up your page/ }).click();
  await expect(heading(page, /Language and your names/)).toBeFocused();
  await page.getByLabel(/Partner A's name/).fill("  Partner A ");
  await page.getByLabel(/Partner B's name/).fill("Partner B");
  await next(page);
  await expect(heading(page, /time zone/)).toBeFocused();
}

// Steps 1 to 4 from the empty dashboard; ends on step 5, the review.
async function walkToReview(page: Page) {
  await createPage(page);
  await next(page);
  await expect(heading(page, /What you'd like to share/)).toBeFocused();
  await page.getByLabel(/Wishes/).check();
  await next(page);
  await expect(heading(page, /Words for your guests/)).toBeFocused();
  await next(page);
  await expect(heading(page, /Visibility and review/)).toBeFocused();
}

// From step 2: another session saves, then the owner presses Next and meets the conflict dialog.
async function conflictAtZone(page: Page, project: string) {
  await createPage(page);
  await sql`update public.pages set label_a = 'Partner C' where id = ${(await ownerPage(project)).id}`;
  await next(page);
  const dialog = page.getByRole("dialog", { name: /Page changed elsewhere/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("E55: no page, then setup step by step, Finish, and the done dashboard; a guest opens the page", async ({ page, browser }, info) => {
  await signIn(page, info.project.name);
  await expect(heading(page, /Make room for your memories/)).toBeVisible();
  expect(await ownerPage(info.project.name)).toBeUndefined();

  await walkToReview(page);
  const saved = await ownerPage(info.project.name);
  // No theme: guests choose it on their first visit (Q128).
  expect(saved).toMatchObject({ theme: null, label_a: "Partner A", label_b: "Partner B", visibility: "private", copy_published_at: null });
  await expect(page.getByRole("main")).toContainText("Token-only");
  await expect(page.getByRole("main")).toContainText("Step 5 of 5");

  await page.getByRole("button", { name: /Finish and publish/ }).click();
  await expect(heading(page, /Partner A.*Partner B/)).toBeFocused();
  await expect(page.getByRole("main")).toContainText("Wishes");
  await expect(page.getByRole("main")).toContainText("Your page is set up.");
  expect(await ownerPage(info.project.name)).toMatchObject({ visibility: "token_only", setup_completed_at: expect.any(Date) });

  const res = await page.request.post("/api/owner/token", { data: { request_id: randomUUID() }, headers: { origin: ORIGIN } });
  expect(res.status()).toBe(200);
  const guest = await (await browser.newContext()).newPage();
  await guest.setExtraHTTPHeaders({ "x-forwarded-for": randomIp("203.0.113") });
  await guest.goto((await res.json()).link);
  await expect(guest).toHaveURL("/g/home");
});

test("a resumed setup opens at the review, or at step 1 while a name is missing (Q121, Q128)", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await createPage(page);
  await page.getByRole("button", { name: /Leave setup/ }).click();
  await expect(page.getByRole("main")).toContainText("Private");
  await page.getByRole("button", { name: /Continue setup/ }).click();
  await expect(heading(page, /Visibility and review/)).toBeFocused();
  await expect(page.getByRole("main")).toContainText("Saved choices restored.");
  await page.getByRole("button", { name: /Leave setup/ }).click();
  await expect(page.getByRole("button", { name: /Continue setup/ })).toBeVisible();
  await sql`update public.pages set label_b = null where id = ${(await ownerPage(info.project.name)).id}`;
  await page.reload();
  await page.getByRole("button", { name: /Continue setup/ }).click();
  await expect(heading(page, /Language and your names/)).toBeFocused();
  await expect(page.getByRole("button", { name: /^Back/ })).toBeDisabled();
});

test("names are checked before saving and the first invalid field gets focus", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await page.getByRole("button", { name: /Set up your page/ }).click();
  await page.getByLabel(/Partner B's name/).fill("x".repeat(41));
  await next(page);
  await expect(page.getByLabel(/Partner A's name/)).toBeFocused();
  await expect(page.getByRole("main")).toContainText("Enter a name.");
  await expect(page.getByRole("main")).toContainText("Use 40 characters or fewer.");
  expect(await ownerPage(info.project.name)).toBeUndefined();
});

test("a confirmed Finish failure says nothing was published and its one retry publishes", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await walkToReview(page);
  await page.route("**/api/owner/finish", (route) => route.fulfill({ status: 503, json: { error: "not_published" } }));
  await page.getByRole("button", { name: /Finish and publish/ }).click();
  await expect(page.getByRole("main")).toContainText("Nothing was published.");
  await expect(page.getByRole("button", { name: /Finish and publish/ })).toHaveCount(0);
  expect((await ownerPage(info.project.name)).visibility).toBe("private");
  await page.unroute("**/api/owner/finish");
  await page.getByRole("button", { name: /^Try again/ }).click();
  await expect(heading(page, /Partner A.*Partner B/)).toBeVisible();
});

test("an uncertain Finish never claims nothing was published; its retry survives Leave and resume", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await walkToReview(page);
  await page.route("**/api/owner/finish", (route) => route.abort());
  await page.getByRole("button", { name: /Finish and publish/ }).click();
  await expect(page.getByRole("main")).toContainText("We couldn't confirm whether your page was published.");
  await expect(page.getByRole("main")).not.toContainText("Nothing was published");
  await expect(page.getByRole("main")).not.toContainText("Your page stays private.");
  await page.unroute("**/api/owner/finish");
  await page.getByRole("button", { name: /Leave setup/ }).click();
  await page.getByRole("button", { name: /Continue setup/ }).click();
  await expect(heading(page, /Visibility and review/)).toBeFocused();
  await expect(page.getByRole("button", { name: /Finish and publish/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^Try again/ }).click();
  await expect(heading(page, /Partner A.*Partner B/)).toBeVisible();
});

test("a second Finish answers already set up and leads to the overview", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await walkToReview(page);
  const { version } = await ownerPage(info.project.name);
  expect((await page.request.post("/api/owner/finish", { headers: { origin: ORIGIN }, data: { expected_version: version } })).status()).toBe(200);
  await page.getByRole("button", { name: /Finish and publish/ }).click();
  await expect(heading(page, /already set up/)).toBeFocused();
  await page.getByRole("button", { name: /Go to overview/ }).click();
  await expect(heading(page, /Partner A.*Partner B/)).toBeVisible();
});

test("a save from a stale screen opens the conflict dialog; Reload saved choices re-reads", async ({ page }, info) => {
  await signIn(page, info.project.name);
  const dialog = await conflictAtZone(page, info.project.name);
  await dialog.getByRole("button", { name: /Reload saved choices/ }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: /^Back/ }).click();
  await expect(page.getByLabel(/Partner A's name/)).toHaveValue("Partner C");
});

test("Esc on the conflict dialog writes nothing: the next save asks again (Codex)", async ({ page }, info) => {
  await signIn(page, info.project.name);
  const dialog = await conflictAtZone(page, info.project.name);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await next(page);
  await expect(dialog).toBeVisible();
  expect((await ownerPage(info.project.name)).label_a).toBe("Partner C");
});

test("Keep mine saves the owner's choices over a change made elsewhere", async ({ page }, info) => {
  await signIn(page, info.project.name);
  const dialog = await conflictAtZone(page, info.project.name);
  await dialog.getByRole("button", { name: /Keep mine/ }).click();
  await expect(heading(page, /What you'd like to share/)).toBeFocused();
  expect(await ownerPage(info.project.name)).toMatchObject({ label_a: "Partner A", label_b: "Partner B" });
});

test("Leave asks only about the current step: an edit left behind by Back is not asked about (spec wording, Q129)", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await createPage(page);
  const saved = (await ownerPage(info.project.name)).timezone;
  await page.getByLabel(/Time zone/).selectOption(saved === "Asia/Tokyo" ? "Asia/Seoul" : "Asia/Tokyo");
  await page.getByRole("button", { name: /^Back/ }).click();
  await page.getByRole("button", { name: /Leave setup/ }).click();
  await expect(heading(page, /Make room/)).toBeVisible();
  expect((await ownerPage(info.project.name)).timezone).toBe(saved);
});

test("Finish after another session cleared a name opens the conflict dialog and resumes at step 1 (Q125)", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await walkToReview(page);
  await sql`update public.pages set label_b = null where id = ${(await ownerPage(info.project.name)).id}`;
  await page.getByRole("button", { name: /Finish and publish/ }).click();
  const dialog = page.getByRole("dialog", { name: /Page changed elsewhere/ });
  await dialog.getByRole("button", { name: /Reload saved choices/ }).click();
  await expect(heading(page, /Language and your names/)).toBeVisible();
  await expect(page.getByLabel(/Partner B's name/)).toHaveValue("");
  expect((await ownerPage(info.project.name)).visibility).toBe("private");
});

test("a failed wording read after the first save keeps its Try again; the wording step waits for it", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await page.getByRole("button", { name: /Set up your page/ }).click();
  await page.getByLabel(/Partner A's name/).fill("Partner A");
  await page.getByLabel(/Partner B's name/).fill("Partner B");
  await page.route("**/api/owner/page", (route) => route.fulfill({ status: 503 }));
  await next(page);
  await expect(heading(page, /time zone/)).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Not saved.");
  await next(page);
  await next(page);
  await expect(heading(page, /Words for your guests/)).toBeFocused();
  await expect(page.getByRole("button", { name: /^Next/ })).toBeDisabled();
  const again = page.getByRole("button", { name: /^Try again/ });
  await again.click();
  await expect(again).toHaveCount(1); // a second failure shows one message and one retry
  await page.unroute("**/api/owner/page");
  await again.click();
  await expect(heading(page, /Words for your guests/)).toBeFocused();
  await expect(page.getByRole("button", { name: /^Next/ })).toBeEnabled();
  await expect(page.getByRole("main")).toContainText("Together for");
});

test("offline blocks saving with the reason; Leave asks before discarding, and Esc keeps the input", async ({ page, context }, info) => {
  await signIn(page, info.project.name);
  await page.getByRole("button", { name: /Set up your page/ }).click();
  await context.setOffline(true);
  await expect(page.getByRole("main")).toContainText("You’re offline.");
  await expect(page.getByRole("button", { name: /^Next/ })).toBeDisabled();
  await expect(page.getByRole("main").getByRole("status")).toContainText("You’re offline.");
  await context.setOffline(false);
  await page.getByLabel(/Partner A's name/).fill("Partner A");
  await page.getByRole("button", { name: /Leave setup/ }).click();
  const dialog = page.getByRole("dialog", { name: /Leave setup\?/ });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel(/Partner A's name/)).toHaveValue("Partner A");
  await expect(page.getByRole("button", { name: /Leave setup/ })).toBeFocused();
});

// Accessibility lives in this spec, not a *.a11y.ts file, because the a11y CI job runs no Supabase.
const SIZES = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 900 },
];

async function axe(page: Page, where: string) {
  // Messages fade in (120 ms): measure the settled colours, not a frame of the fade.
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"));
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(violations.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target}: ${n.failureSummary}`)), where).toEqual([]);
}

// WCAG 1.4.10 and 1.4.4: 320 px wide with text at 200 %, no page scroll and every control still 44 px.
async function reflow(page: Page, where: string) {
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

test("every dashboard state and wizard step passes axe at phone, tablet and laptop, and reflows at 320 px with 200 % text", async ({ page }, info) => {
  test.slow();
  await signIn(page, info.project.name);
  const check = async (where: string) => {
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await axe(page, `${where} ${size.width}`);
    }
    await page.setViewportSize({ width: 320, height: 640 });
    // Through the CSSOM: the page CSP refuses an injected <style>.
    await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("32px");
    await reflow(page, `${where} 320 @ 200%`);
    await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  };
  await expect(heading(page, /Make room/)).toBeVisible();
  await check("O2 empty");
  await page.getByRole("button", { name: /Set up your page/ }).click();
  for (const step of [1, 2, 3, 4, 5]) {
    await expect(page.getByRole("main")).toContainText(`Step ${step} of 5`);
    if (step === 1) {
      await page.getByLabel(/Partner A's name/).fill("Kỷ niệm dịu dàng giữa những chiều ấm êm.");
      await page.getByLabel(/Partner B's name/).fill("Những kỷ niệm ấm áp giữa chiều dịu dàng.");
    }
    if (step === 4 && (await page.getByRole("button", { name: /Guest preview/ }).isVisible()))
      await page.getByRole("button", { name: /Guest preview/ }).click();
    await check(`O3 step ${step}`);
    if (step < 5) await next(page);
  }
  await page.getByRole("button", { name: /Leave setup/ }).click();
  await expect(heading(page, /Make room/)).toBeVisible();
  await check("O2 resumed");
  await page.getByRole("button", { name: /Continue setup/ }).click();
  await page.route("**/api/owner/finish", (route) => route.fulfill({ status: 503, json: { error: "not_published" } }));
  await page.getByRole("button", { name: /Finish and publish/ }).click();
  await expect(page.getByRole("main")).toContainText("Nothing was published.");
  await check("O3 Finish failed");
  await page.unroute("**/api/owner/finish");
  await page.getByRole("button", { name: /Leave setup/ }).click();
  await expect(heading(page, /Make room/)).toBeVisible();
  await page.getByRole("button", { name: /Continue setup/ }).click();
  await page.getByRole("button", { name: /^Change/ }).first().click();
  await page.getByLabel(/Partner B's name/).fill("Những kỷ niệm ấm áp giữa chiều dịu dàng!");
  await page.getByRole("button", { name: /Leave setup/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await check("O3 Leave dialog");
  await page.keyboard.press("Escape");
  for (let step = 1; step < 5; step++) {
    await expect(page.getByRole("main")).toContainText(`Step ${step} of 5`);
    await next(page);
  }
  await page.getByRole("button", { name: /Finish and publish/ }).click();
  await expect(heading(page, /Kỷ niệm/)).toBeVisible();
  await check("O2 done, long Vietnamese");
  for (const [status, where] of [[503, "O2 read failure"], [403, "O2 access lost"]] as const) {
    await page.route("**/api/owner/page", (route) => route.fulfill({ status }));
    await page.reload();
    await expect(page.getByRole("main").locator("p[tabindex]")).toBeVisible();
    await check(where);
    await page.unroute("**/api/owner/page");
  }
  await page.reload();
  await expect(heading(page, /Kỷ niệm/)).toBeVisible();
  await page.context().setOffline(true);
  await expect(page.getByRole("main")).toContainText("You’re offline.");
  await check("O2 offline");
  await page.context().setOffline(false);
});

test("the wording step's theme preview changes only the preview and saves nothing; reduced motion stops the owner transitions (theme test 10, Q128)", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await createPage(page);
  await next(page);
  await next(page);
  await expect(heading(page, /Words for your guests/)).toBeFocused();
  const toggle = page.getByRole("button", { name: /Guest preview/ });
  if (await toggle.isVisible()) await toggle.click();
  const owner = () =>
    page.getByRole("main").evaluate((main) => {
      const style = getComputedStyle(main);
      return ["--bg", "--text", "--accent", "--font-body"].map((name) => style.getPropertyValue(name)).concat(style.fontFamily);
    });
  const before = await owner();
  const preview = page.locator("[data-theme][inert]");
  for (const [name, theme] of [[/A Dreamy/, "a_dreamy"], [/B Cosmic/, "b_cosmic"], [/C Cozy/, "c_cozy"], [/D Elegant/, "d_elegant"]] as const) {
    await page.getByRole("button", { name }).click();
    await expect(preview).toHaveAttribute("data-theme", theme);
    expect(await owner()).toEqual(before);
  }
  expect(await preview.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(244, 241, 236)");
  await page.getByRole("button", { name: /A Dreamy/ }).click();
  expect(await preview.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(36, 18, 58)");
  await page.getByRole("button", { name: /D Elegant/ }).click();
  await page.getByRole("button", { name: /^Back/ }).click();
  await next(page); // a real save after picking a preview still stores no theme
  await expect(heading(page, /Words for your guests/)).toBeFocused();
  expect((await ownerPage(info.project.name)).theme).toBeNull();

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.getByRole("button", { name: /^Next/ }).evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s, 0s");
});

// The five-step review (Q128): the paths the renumbering moved.
const alertRegion = (page: Page) => page.getByRole("main").getByRole("alert");

test("Finish after another session saved publishes nothing; Keep mine saves the reviewed choices and stays on the review (Codex)", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await walkToReview(page);
  await sql`update public.pages set label_a = 'Partner C' where id = ${(await ownerPage(info.project.name)).id}`;
  await page.getByRole("button", { name: /Finish and publish/ }).click();
  const dialog = page.getByRole("dialog", { name: /Page changed elsewhere/ });
  await expect(dialog).toBeVisible();
  expect((await ownerPage(info.project.name)).visibility).toBe("private");
  await dialog.getByRole("button", { name: /Keep mine/ }).click();
  await expect(dialog).toBeHidden();
  await expect(heading(page, /Visibility and review/)).toBeVisible();
  await expect.poll(async () => (await ownerPage(info.project.name)).label_a).toBe("Partner A");
  await page.getByRole("button", { name: /Finish and publish/ }).click();
  await expect(heading(page, /Partner A.*Partner B/)).toBeVisible();
});

test("a double tap on Next at the wording step opens the review and publishes nothing; Finish then works", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await createPage(page);
  await next(page);
  await expect(heading(page, /What you'd like to share/)).toBeFocused();
  await next(page);
  await expect(heading(page, /Words for your guests/)).toBeFocused();
  let finishes = 0;
  page.on("request", (request) => void (request.url().endsWith("/api/owner/finish") && finishes++));
  // Same node, two taps 100 ms apart: Finish replaces Next's label under the finger.
  await page.getByRole("button", { name: /^Next/ }).evaluate(async (button: HTMLButtonElement) => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    button.click();
  });
  await expect(heading(page, /Visibility and review/)).toBeFocused();
  await page.waitForTimeout(200);
  expect(finishes).toBe(0);
  expect((await ownerPage(info.project.name)).visibility).toBe("private");
  await page.getByRole("button", { name: /Finish and publish/ }).click();
  await expect(heading(page, /Partner A.*Partner B/)).toBeVisible();
});

test("a refused first save offers Use UTC; the flag survives Leave and resume until a zone is chosen (R1, R2, Codex)", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await page.getByRole("button", { name: /Set up your page/ }).click();
  await page.getByLabel(/Partner A's name/).fill("Partner A");
  await page.getByLabel(/Partner B's name/).fill("Partner B");
  await page.route("**/api/owner/setup", (route) => route.fulfill({ status: 400 }));
  await next(page);
  await page.unroute("**/api/owner/setup");
  await page.getByRole("button", { name: /Use UTC/ }).click();
  await expect(heading(page, /time zone/)).toBeFocused();
  await expect(page.getByRole("main")).toContainText("UTC is selected for now.");
  expect((await ownerPage(info.project.name)).timezone).toBe("UTC");
  await page.getByRole("button", { name: /Leave setup/ }).click();
  await page.getByRole("button", { name: /Continue setup/ }).click();
  await expect(heading(page, /Visibility and review/)).toBeFocused();
  await expect(page.getByRole("main")).toContainText("Set from a fallback: please check.");
  await page.getByRole("button", { name: /^Change/ }).nth(2).click();
  await page.getByLabel(/Time zone/).selectOption("Asia/Tokyo");
  await next(page);
  await next(page);
  await next(page);
  await expect(heading(page, /Visibility and review/)).toBeFocused();
  await expect(page.getByRole("main")).not.toContainText("Set from a fallback");
  await expect(page.getByRole("main")).toContainText("Home only");
  expect((await ownerPage(info.project.name)).timezone).toBe("Asia/Tokyo");
});

test("Reload clears the UTC flag when another session saved a real zone", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await page.getByRole("button", { name: /Set up your page/ }).click();
  await page.getByLabel(/Partner A's name/).fill("Partner A");
  await page.getByLabel(/Partner B's name/).fill("Partner B");
  await page.route("**/api/owner/setup", (route) => route.fulfill({ status: 400 }));
  await next(page);
  await page.unroute("**/api/owner/setup");
  await page.getByRole("button", { name: /Use UTC/ }).click();
  await expect(heading(page, /time zone/)).toBeFocused();
  await sql`update public.pages set timezone = 'Asia/Tokyo' where id = ${(await ownerPage(info.project.name)).id}`;
  await page.getByRole("button", { name: /^Back/ }).click();
  await next(page);
  const dialog = page.getByRole("dialog", { name: /Page changed elsewhere/ });
  await dialog.getByRole("button", { name: /Reload saved choices/ }).click();
  await expect(dialog).toBeHidden();
  await next(page);
  await expect(heading(page, /time zone/)).toBeFocused();
  await expect(page.getByRole("main")).not.toContainText("UTC is selected for now.");
});

test("Reload flags a UTC zone saved by another session, so the review asks to check it (Codex)", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await createPage(page);
  await page.getByLabel(/Time zone/).selectOption("Asia/Tokyo");
  await next(page);
  await expect(heading(page, /What you'd like to share/)).toBeFocused();
  await sql`update public.pages set timezone = 'UTC' where id = ${(await ownerPage(info.project.name)).id}`;
  await next(page);
  const dialog = page.getByRole("dialog", { name: /Page changed elsewhere/ });
  await dialog.getByRole("button", { name: /Reload saved choices/ }).click();
  await expect(dialog).toBeHidden();
  await next(page);
  await expect(heading(page, /Words for your guests/)).toBeFocused();
  await next(page);
  await expect(heading(page, /Visibility and review/)).toBeFocused();
  await expect(page.getByRole("main")).toContainText("Set from a fallback: please check.");
});

test("a failed first save keeps step 1 and its retry; a lost answer ends in the conflict dialog, and 401 goes to login", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await page.getByRole("button", { name: /Set up your page/ }).click();
  await page.getByLabel(/Partner A's name/).fill("Partner A");
  await page.getByLabel(/Partner B's name/).fill("Partner B");
  await page.route("**/api/owner/setup", (route) => route.fulfill({ status: 503 }));
  await next(page);
  await expect(page.getByRole("main")).toContainText("Not saved.");
  await expect(heading(page, /Language and your names/)).toBeVisible();
  await page.unroute("**/api/owner/setup");
  await page.route("**/api/owner/setup", async (route) => {
    await route.fetch(); // the save commits and its answer is lost
    await route.abort();
  });
  await page.getByRole("button", { name: /^Try again/ }).click();
  await expect(page.getByRole("button", { name: /^Try again/ })).toBeEnabled();
  await page.unroute("**/api/owner/setup");
  await page.getByRole("button", { name: /^Try again/ }).click();
  const dialog = page.getByRole("dialog", { name: /Page changed elsewhere/ });
  await dialog.getByRole("button", { name: /Keep mine/ }).click();
  await expect(heading(page, /time zone/)).toBeFocused();
  await page.route("**/api/owner/setup", (route) => route.fulfill({ status: 401 }));
  await next(page);
  await expect(page).toHaveURL(/\/login/);
});

test("every Change link on the review opens its own step", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await walkToReview(page);
  for (const [row, step, title] of [[0, 1, /Language and your names/], [1, 1, /Language and your names/], [2, 2, /time zone/], [3, 3, /What you'd like to share/], [4, 4, /Words for your guests/]] as const) {
    await page.getByRole("button", { name: /^Change/ }).nth(row).click();
    await expect(heading(page, title)).toBeFocused();
    for (let at = step; at < 5; at++) await next(page);
    await expect(heading(page, /Visibility and review/)).toBeFocused();
  }
});

test("Enter in the focused empty name field still announces the error; a tap, which moves focus, does not repeat it", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await page.getByRole("button", { name: /Set up your page/ }).click();
  await page.getByLabel(/Partner A's name/).focus();
  await page.keyboard.press("Enter");
  await expect(alertRegion(page)).toContainText("Enter a name.");
  await page.getByLabel(/Partner B's name/).focus();
  await next(page);
  await expect(page.getByLabel(/Partner A's name/)).toBeFocused();
  await expect(alertRegion(page)).toHaveText("");
});

test("access lost in the wizard is read once, by focus", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await createPage(page);
  await page.route("**/api/owner/setup", (route) => route.fulfill({ status: 403 }));
  await next(page);
  await expect(page.getByRole("main").locator("p[tabindex]")).toBeFocused();
  await expect(alertRegion(page)).toHaveText("");
});

test("a failed save on a resumed wizard no longer says the saved choices were restored", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await walkToReview(page);
  await page.getByRole("button", { name: /Leave setup/ }).click();
  await page.getByRole("button", { name: /Continue setup/ }).click();
  await expect(page.getByRole("main")).toContainText("Saved choices restored.");
  await page.route("**/api/owner/finish", (route) => route.fulfill({ status: 503, json: { error: "not_published" } }));
  await page.getByRole("button", { name: /Finish and publish/ }).click();
  await expect(page.getByRole("main")).toContainText("Nothing was published");
  await expect(page.getByRole("main").getByRole("status")).toHaveText("");
  await expect(page.getByRole("main")).not.toContainText("Saved choices restored.");
});

test("retrying an uncertain Finish does not raise the old alert while it runs", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await walkToReview(page);
  await page.route("**/api/owner/finish", (route) => route.abort());
  await page.getByRole("button", { name: /Finish and publish/ }).click();
  const again = page.getByRole("button", { name: /^Try again/ });
  await expect(again).toBeVisible();
  await page.unroute("**/api/owner/finish");
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/owner/finish", async (route) => {
    await held;
    await route.abort();
  });
  await again.click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Publishing");
  await expect(alertRegion(page)).toHaveText("");
  release();
  await expect(again).toBeEnabled();
});

test("a dialog opened from a control the save disabled gives focus back to the step heading", async ({ page }, info) => {
  await signIn(page, info.project.name);
  await createPage(page);
  await page.getByRole("button", { name: /^Back/ }).click();
  await sql`update public.pages set label_a = 'Partner C' where id = ${(await ownerPage(info.project.name)).id}`;
  await page.getByRole("radio").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: /Page changed elsewhere/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(heading(page, /Language and your names/)).toBeFocused();
});

test("a running save dims the primary button; the phone layout keeps its sizes and gaps", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await signIn(page, info.project.name);
  await page.getByRole("button", { name: /Set up your page/ }).click();
  const radio = await page.locator("label:has(input[type=radio])").first().boundingBox();
  expect(radio!.height).toBeLessThan(80); // not the 120 px flex basis meant as a width
  await page.getByLabel(/Partner A's name/).fill("Partner A");
  await page.getByLabel(/Partner B's name/).fill("Partner B");
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/owner/setup", async (route) => {
    await held;
    await route.continue();
  });
  await next(page);
  await expect(page.getByRole("button", { name: /^Next/ })).toHaveCSS("opacity", "0.55");
  release();
  await expect(heading(page, /time zone/)).toBeFocused();
  await page.unroute("**/api/owner/setup");
  await next(page);
  await expect(heading(page, /What you'd like to share/)).toBeFocused();
  await next(page);
  await expect(heading(page, /Words for your guests/)).toBeFocused();
  const toggle = page.getByRole("button", { name: /Guest preview/ });
  await toggle.click();
  const a = await toggle.boundingBox();
  const b = await page.getByRole("button", { name: /A Dreamy/ }).boundingBox();
  expect(b!.y - (a!.y + a!.height)).toBeGreaterThanOrEqual(8);
});
