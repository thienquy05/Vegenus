import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// T1.5c visibility (design 1 §6, §10.1; E4, E21, E47) against the local Supabase stack. e2e/global-setup.ts
// gives each browser project its own live page owned by owner-visibility-<project>; the test creates its
// token and first sets Token-only, so a retry starts from a known state.
const ORIGIN = "http://localhost:3000";
const TAP = "Tap the tag or scan the QR code to see this page.";
const randomIp = (prefix: string) => `${prefix}.${Math.floor(Math.random() * 250) + 1}`;

async function signIn(page: Page, project: string) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp("198.51.100") });
  await page.goto("/login");
  await page.getByLabel("Email").fill(`owner-visibility-${project}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("placeholder-password-1");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL("/app");
}

const setVisibility = (owner: Page, data: object) =>
  owner.request.post("/api/owner/visibility", { data, headers: { origin: ORIGIN } });

test("Private stops an open guest on the next request; Token-only and Published let the token back in (E4, E47)", async ({ page, browser }, info) => {
  await signIn(page, info.project.name);
  expect((await setVisibility(page, { visibility: "token_only" })).status()).toBe(200);
  const res = await page.request.post("/api/owner/token", { data: { request_id: randomUUID() }, headers: { origin: ORIGIN } });
  expect(res.status()).toBe(200);
  const { link } = await res.json();

  const guest = await (await browser.newContext()).newPage();
  await guest.setExtraHTTPHeaders({ "x-forwarded-for": randomIp("203.0.113") });
  await guest.goto(link);
  await expect(guest).toHaveURL("/g/home");

  // No confirm: refused, nothing changes (O9).
  const unconfirmed = await setVisibility(page, { visibility: "private" });
  expect(unconfirmed.status()).toBe(400);
  await guest.reload();
  await expect(guest).toHaveURL("/g/home");

  // Private while the guest has the page open: the next request shows only the tap notice.
  const priv = await setVisibility(page, { visibility: "private", confirm: true });
  expect(priv.status()).toBe(200);
  expect(priv.headers()["cache-control"]).toBe("no-store");
  await guest.reload();
  await expect(guest).toHaveURL("/g");
  await expect(guest.getByRole("main")).toHaveText(TAP);
  // A fresh tap of the same link: the same notice, nothing about why.
  const sent = guest.waitForRequest((r) => r.url().endsWith("/api/guest/session") && r.method() === "POST");
  await guest.goto(link);
  await sent;
  await expect(guest.getByRole("main")).toHaveText(TAP);

  expect((await setVisibility(page, { visibility: "token_only" })).status()).toBe(200);
  await guest.goto(link);
  await expect(guest).toHaveURL("/g/home");

  expect((await setVisibility(page, { visibility: "published", confirm: true })).status()).toBe(200);
  await guest.reload();
  await expect(guest).toHaveURL("/g/home");

  expect((await setVisibility(page, { visibility: "token_only" })).status()).toBe(200);
  await guest.context().close();
});

// E21: no sitemap lists any page (only Published pages may be indexed, and their route comes in Phase 3).
test("there is no sitemap", async ({ request }) => {
  expect((await request.get("/sitemap.xml")).status()).toBe(404);
});
