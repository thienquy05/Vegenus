import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { checkSizes } from "./owner-checks";

// O2 Usage card, the attention line and O10 Usage against the local Supabase stack and the real usage read (owner UI
// "O10 Usage and the O2 attention line for T2.5"; PRD Q145; E23, E24). Each browser project signs in as its own owner
// (owner-usage-<project>, page ea/eb from e2e/global-setup.ts). The daily job's state is shared by every page and the
// storage-worker spec runs the cron at the same time, so nothing here depends on it. Placeholder data only.
const PAGES = { chromium: "00000000-0000-0000-0000-0000000000ea", webkit: "00000000-0000-0000-0000-0000000000eb" };
const sql = postgres(process.env.SUPABASE_DB_URL ?? "", { max: 1 });

test.afterAll(async () => {
  await sql.end();
});

async function signIn(page: Page, project: string) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.103.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto("/login");
  await page.getByLabel("Email").fill(`owner-usage-${project}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("placeholder-password-1");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL("/app");
}

test("the owner sees storage at 85 % on O2, opens Usage, and goes back to the control that opened it", async ({ page }, info) => {
  const project = info.project.name as keyof typeof PAGES;
  const id = PAGES[project];
  const path = `pages/${id}/media/usage-e2e/thumb`;
  const blocked: string[] = [];
  page.on("console", (message) => message.text().includes("Content Security Policy") && blocked.push(message.text()));
  // 850 of 1000 bytes: a deletion still waiting (it counts until the job deletes it), held back from the cron.
  await sql`update public.pages set storage_budget_bytes = 1000 where id = ${id}`;
  await sql`insert into public.storage_deletions (page_id, bucket, path, bytes, not_before)
    values (${id}, 'media-thumb', ${path}, 850, now() + interval '1 day')`;
  try {
    await signIn(page, project);
    const card = page.locator("#usage-card");
    await expect(card).toContainText("Storage <1 MB of <1 MB");
    await expect(page.locator("#usage-attention")).toBeVisible();
    await checkSizes(page, "O2 with the attention line and the Usage card");

    await card.getByRole("button", { name: /^View usage/ }).click();
    await expect(page.locator("#usage-title")).toBeFocused();
    await expect(page.locator("#storage-amount")).toContainText("(85%)");
    await expect(page.getByRole("main")).toContainText("Waiting to be deleted: <1 MB");
    await expect(page.getByRole("main")).toContainText("Storage is over 80%.");
    await expect(page.locator("#usage-supabase")).toHaveAttribute("href", "https://supabase.com/dashboard/org/_/usage");
    await checkSizes(page, "O10 at 85 %");

    await page.locator("#usage-refresh").click();
    await expect(page.getByRole("status")).toContainText("Usage updated");
    await page.locator("#usage-back").click();
    await expect(page.locator("#usage-entry-link")).toBeFocused();
    expect(blocked).toEqual([]);
  } finally {
    await sql`delete from public.storage_deletions where path = ${path}`;
    await sql`update public.pages set storage_budget_bytes = default where id = ${id}`;
  }
});
