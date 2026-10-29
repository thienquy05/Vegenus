import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// T1.4 owner auth against the local Supabase stack (playwright.config.ts reads its settings; the
// owner account is created in e2e/global-setup.ts). Each test sends its own client IP, so the
// per-IP login bucket of one test never trips another.
const ownerEmail = (project: string) => `owner-${project}@example.test`;
const OWNER_PASSWORD = "placeholder-password-1";
const GENERIC = "Couldn’t sign in. Check your details.";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}` });
});

// Our alert lives in <main>; Next's route announcer is another role="alert" outside it.
const alert = (page: Page) => page.getByRole("main").getByRole("alert");

async function login(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Sign in/ }).click();
}

// E31, E37: an owner route without a session goes to login and carries no page data.
test("/app without a session redirects to login", async ({ request }) => {
  const res = await request.get("/app", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toBe("/login?next=%2Fapp");
});

// E22: wrong password, unknown address and the rate limit all give one generic answer.
test("wrong password and unknown address look the same", async ({ page }, info) => {
  await page.goto("/login");
  await login(page, ownerEmail(info.project.name), "wrong-password-1");
  await expect(alert(page)).toContainText(GENERIC);
  const known = await alert(page).textContent();
  await login(page, `nobody-${randomUUID()}@example.test`, "wrong-password-1");
  await expect(alert(page)).toHaveText(known!);
  expect(new URL(page.url()).pathname).toBe("/login");
});

test("the sixth attempt for one address is refused even with the right password", async ({ page }, info) => {
  const email = ownerEmail(`${info.project.name}-limited`);
  await page.goto("/login");
  for (let i = 0; i < 5; i++) await login(page, email, "wrong-password-1");
  await login(page, email, OWNER_PASSWORD);
  await expect(alert(page)).toContainText(GENERIC);
  expect(new URL(page.url()).pathname).toBe("/login");
});

// E34, E35: login lands on /app (never a foreign next), responses are no-store, logout leaves nothing.
test("login, no-store, logout and the back button", async ({ page }, info) => {
  await page.goto("/login?next=https%3A%2F%2Fother.site");
  await login(page, ownerEmail(info.project.name), OWNER_PASSWORD);
  await expect(page).toHaveURL("/app");
  await expect(page.getByRole("button", { name: /Log out/ })).toBeVisible();

  const res = await page.request.get("/app", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("no-store");
  const session = (await page.context().cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(session.length).toBeGreaterThan(0);
  for (const c of session) expect(c.httpOnly, c.name).toBe(true);
  // Session cookie (owner, 2026-10-29): it ends with the browser until "Keep me signed in" asks for consent.
  for (const c of session) expect(c.expires, c.name).toBe(-1);

  await page.getByRole("button", { name: /Log out/ }).click();
  await expect(page).toHaveURL("/login");
  expect((await page.context().cookies()).filter((c) => c.name.startsWith("sb-"))).toEqual([]);
  await page.goBack();
  await expect(page.getByRole("button", { name: /Log out/ })).toHaveCount(0);
  await page.goto("/app");
  await expect(page).toHaveURL("/login?next=%2Fapp");
});

// E34 (Codex, T1.4 review): logout clears the session cookies even when Auth cannot end the session
// (the SDK returns early without writing cookies when a refresh fails). A session the SDK cannot use
// stands in for that failure.
test("logout clears session cookies it cannot sign out", async ({ page, baseURL }) => {
  const ref = new URL(process.env.SUPABASE_URL!).hostname.split(".")[0];
  await page.context().addCookies(
    [`sb-${ref}-auth-token.0`, `sb-${ref}-auth-token.1`].map((name) => ({ name, value: "base64-unusable", url: baseURL! })),
  );
  const res = await page.request.post("/api/owner/logout", { headers: { origin: new URL(baseURL!).origin }, maxRedirects: 0 });
  expect(res.status()).toBe(303);
  expect((await page.context().cookies()).filter((c) => c.name.startsWith("sb-"))).toEqual([]);
});

// CSRF (design 1 §1): a form post from another site is refused before any check.
test("login and logout refuse a foreign Origin", async ({ request }) => {
  for (const path of ["/api/owner/login", "/api/owner/logout"]) {
    const res = await request.post(path, { headers: { origin: "https://other.site" }, maxRedirects: 0 });
    expect(res.status(), path).toBe(403);
  }
});

// E29: registration is closed, so nobody can claim an address before the owner provisions it.
test("sign-up through the Auth API is refused", async () => {
  const auth = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!).auth;
  const { data, error } = await auth.signUp({ email: `claim-${randomUUID()}@example.test`, password: OWNER_PASSWORD });
  expect(data.user).toBeNull();
  expect(error?.message).toMatch(/signups not allowed/i);
});
