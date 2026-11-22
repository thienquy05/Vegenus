import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// T1.5b rotation (design 1 §3.1, §6; E3) against the local Supabase stack. e2e/global-setup.ts gives
// each browser project its own page owned by owner-<project>; the tests create their own tokens, so a
// retry starts from whatever the last run left. T2.6 (Q146 10, 12, 21): each call names the link it expects, read from
// the owner_page() snapshot, and O8 acknowledges a revealed version.
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

const snapshot = async (owner: Page) =>
  (await (await owner.request.post("/api/owner/page", { headers: { origin: ORIGIN } })).json()).page;
const activeVersion = async (owner: Page): Promise<number | null> => (await snapshot(owner)).link?.version ?? null;

const rotate = (owner: Page, expected: number | null, requestId = randomUUID()) =>
  owner.request.post("/api/owner/token", { data: { request_id: requestId, expected_version: expected }, headers: { origin: ORIGIN } });

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
  const oldLink = await linkOf(await rotate(page, await activeVersion(page)));

  const guest = await (await browser.newContext()).newPage();
  await guest.setExtraHTTPHeaders({ "x-forwarded-for": randomIp("203.0.113") });
  await guest.goto(oldLink);
  await expect(guest).toHaveURL("/g/home");

  const requestId = randomUUID();
  const oldVersion = await activeVersion(page);
  const newLink = await linkOf(await rotate(page, oldVersion, requestId));
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
  const again = await rotate(page, oldVersion, requestId);
  expect(again.status()).toBe(409);
  expect(await again.json()).toEqual({ error: "already_rotated" });
  expect(await again.text()).not.toContain(new URL(newLink).hash.slice(1));
  await guest.reload();
  await expect(guest).toHaveURL("/g/home");
  await guest.context().close();
});

// Design 3 §9: concurrent rotations resolve to one active token; one request id rotates once. Q146 10: rotations that
// name the same version leave one new link, the rest are "changed".
test("rotations at the same moment leave one working link", async ({ page, request }, info) => {
  await signIn(page, info.project.name);

  // Five at once, so the requests really overlap (two alone sometimes run one after the other).
  const expected = await activeVersion(page);
  const five = await Promise.all(Array.from({ length: 5 }, () => rotate(page, expected)));
  expect(five.map((res) => res.status()).sort()).toEqual([200, 409, 409, 409, 409]);
  for (const res of five.filter((r) => r.status() === 409)) expect(await res.json()).toEqual({ error: "changed" });
  const winner = await linkOf(five.find((res) => res.status() === 200)!);
  expect(await opens(request, winner)).toBe(true);

  const requestId = randomUUID();
  const current = await activeVersion(page);
  const same = await Promise.all([rotate(page, current, requestId), rotate(page, current, requestId)]);
  expect(same.map((res) => res.status()).sort()).toEqual([200, 409]);
  const link = await linkOf(same.find((res) => res.status() === 200)!);
  expect(await opens(request, link)).toBe(true);
  expect(await opens(request, winner)).toBe(false);
});

// Q146 12: one acknowledgement per revealed version, only while it is active; the snapshot never holds the token.
test("the reveal's acknowledgement marks only the active version shown", async ({ page }, info) => {
  await signIn(page, info.project.name);
  const ack = (version: number) => page.request.post("/api/owner/token/shown", { data: { version }, headers: { origin: ORIGIN } });

  const first = await rotate(page, await activeVersion(page));
  const { link, version } = await first.json();
  expect((await snapshot(page)).link).toEqual({ version, created_at: expect.any(String), shown_at: null });
  expect(JSON.stringify(await snapshot(page))).not.toContain(new URL(link).hash.slice(1));

  const shown = await ack(version);
  expect(shown.status()).toBe(200);
  expect(await shown.json()).toEqual({ shown: true });
  expect((await snapshot(page)).link.shown_at).toEqual(expect.any(String));

  // Rotated again: the new version is "display not confirmed" and the old one can no longer be acknowledged.
  const second = await (await rotate(page, version)).json();
  expect((await snapshot(page)).link).toMatchObject({ version: second.version, shown_at: null });
  expect(await (await ack(version)).json()).toEqual({ shown: false });
});
