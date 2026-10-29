import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// T1.5b rotation (design 1 §3.1, §6; E3) against the local Supabase stack. e2e/global-setup.ts gives
// each browser project its own page owned by owner-<project>; the tests create their own tokens, so a
// retry starts from whatever the last run left.
const ORIGIN = "http://localhost:3000";
const TAP = "Tap the tag or scan the QR code to see this page.";
const randomIp = (prefix: string) => `${prefix}.${Math.floor(Math.random() * 250) + 1}`;

async function signIn(page: Page, project: string) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp("198.51.100") });
  await page.goto("/login");
  await page.getByLabel("Email").fill(`owner-${project}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("placeholder-password-1");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL("/app");
}

const rotate = (owner: Page, requestId = randomUUID()) =>
  owner.request.post("/api/owner/token", { data: { request_id: requestId }, headers: { origin: ORIGIN } });

async function linkOf(res: Awaited<ReturnType<typeof rotate>>) {
  expect(res.status()).toBe(200);
  const { link } = await res.json();
  expect(link).toMatch(/^http:\/\/localhost:3000\/g#[A-Za-z0-9_-]{43}$/);
  return link as string;
}

// Does this link's token still open the page? One exchange, no browser state.
const opens = async (request: APIRequestContext, link: string) =>
  (
    await request.post("/api/guest/session", {
      data: { token: new URL(link).hash.slice(1) },
      headers: { origin: ORIGIN, "x-vegenus-guest": "1", "x-forwarded-for": randomIp("203.0.113") },
    })
  ).status() === 200;

test("rotation: the old cookie and link fail on the next request, the new link works (E3)", async ({ page, browser }, info) => {
  await signIn(page, info.project.name);
  const oldLink = await linkOf(await rotate(page));

  const guest = await (await browser.newContext()).newPage();
  await guest.setExtraHTTPHeaders({ "x-forwarded-for": randomIp("203.0.113") });
  await guest.goto(oldLink);
  await expect(guest).toHaveURL("/g/home");

  const requestId = randomUUID();
  const newLink = await linkOf(await rotate(page, requestId));
  expect(newLink).not.toBe(oldLink);

  // The guest's cookie still holds the old token: the next request fails (back to the tap notice).
  await guest.reload();
  await expect(guest).toHaveURL("/g");
  await expect(guest.getByRole("main")).toHaveText(TAP);

  // A tap of the old tag: the same notice as a wrong token.
  const sent = guest.waitForRequest((r) => r.url().endsWith("/api/guest/session") && r.method() === "POST");
  await guest.goto(oldLink);
  await sent;
  await expect(guest.getByRole("main")).toHaveText(TAP);

  await guest.goto(newLink);
  await expect(guest).toHaveURL("/g/home");

  // A retry of the same request (lost response, double click): no second token, no link again (Q34a).
  const again = await rotate(page, requestId);
  expect(again.status()).toBe(409);
  expect(await again.text()).not.toContain(new URL(newLink).hash.slice(1));
  await guest.reload();
  await expect(guest).toHaveURL("/g/home");
  await guest.context().close();
});

// Design 3 §9: concurrent rotations resolve to one active token; one request id rotates once.
test("rotations at the same moment leave one working link", async ({ page, request }, info) => {
  await signIn(page, info.project.name);

  // Five at once, so the requests really overlap (two alone sometimes run one after the other).
  const links = await Promise.all(Array.from({ length: 5 }, async () => linkOf(await rotate(page))));
  expect((await Promise.all(links.map((link) => opens(request, link)))).filter(Boolean)).toHaveLength(1);

  const requestId = randomUUID();
  const same = await Promise.all([rotate(page, requestId), rotate(page, requestId)]);
  expect(same.map((res) => res.status()).sort()).toEqual([200, 409]);
  const link = await linkOf(same.find((res) => res.status() === 200)!);
  expect(await opens(request, link)).toBe(true);
  for (const old of links) expect(await opens(request, old)).toBe(false);
});
