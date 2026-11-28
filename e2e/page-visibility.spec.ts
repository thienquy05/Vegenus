import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// T1.5c visibility (design 1 §6, §10.1; E4, E21, E47) against the local Supabase stack. e2e/global-setup.ts
// gives each browser project its own live page owned by owner-visibility-<project>; the test creates its
// token and first sets Token-only, so a retry starts from a known state. T2.6 (Q146 20, 35): saves carry a request id
// and answer the owner_page() snapshot.
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

const snapshot = async (owner: Page) =>
  (await (await owner.request.post("/api/owner/page", { headers: { origin: ORIGIN } })).json()).page;
// T3.1p (Q155): every save names the saved values it was drafted against; by default a fresh snapshot.
const baseOf = (page: { visibility: string; vanity_name: string | null; link: unknown }) =>
  ({ visibility: page.visibility, vanity_name: page.vanity_name, has_link: page.link !== null });
const setVisibility = async (owner: Page, data: object) =>
  owner.request.post("/api/owner/visibility", {
    data: { request_id: randomUUID(), base: baseOf(await snapshot(owner)), ...data },
    headers: { origin: ORIGIN },
  });

test("Private stops an open guest on the next request; Token-only lets the token back in; Published saves an address (E4, E47, Q155)", async ({ page, browser }, info) => {
  await signIn(page, info.project.name);
  expect((await setVisibility(page, { visibility: "token_only" })).status()).toBe(200);
  const res = await page.request.post("/api/owner/token", {
    data: { request_id: randomUUID(), expected_version: (await snapshot(page)).link?.version ?? null },
    headers: { origin: ORIGIN },
  });
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
  const privateId = randomUUID();
  const priv = await setVisibility(page, { visibility: "private", confirm: true, request_id: privateId });
  expect(priv.status()).toBe(200);
  expect(priv.headers()["cache-control"]).toBe("no-store");
  expect((await priv.json()).page).toEqual(await snapshot(page));
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
  // A retry of the committed Private save (its answer lost) answers the snapshot and does not apply again (Q146 35).
  // Its base (Private) is stale now, so only a request-id-first check answers 200 rather than conflict (T3.1p).
  const retry = await setVisibility(page, {
    visibility: "private", confirm: true, request_id: privateId, base: { visibility: "private", vanity_name: null, has_link: true },
  });
  expect(retry.status()).toBe(200);
  expect((await retry.json()).page.visibility).toBe("token_only");
  await guest.reload();
  await expect(guest).toHaveURL("/g/home");

  // T3.1p: a stale base is a conflict and changes nothing (Q155).
  const stale = await setVisibility(page, { visibility: "token_only", base: { visibility: "private", vanity_name: null, has_link: true } });
  expect(stale.status()).toBe(409);
  expect(await stale.json()).toEqual({ error: "conflict" });

  // Published needs a valid address; the API normalizes it and Token-only keeps it reserved (Q155-Q157).
  const address = `e2e-${info.project.name}`;
  const bad = await setVisibility(page, { visibility: "published", vanity_name: "https://[HOST]/p/x", confirm: true });
  expect(bad.status()).toBe(400);
  expect(await bad.json()).toEqual({ error: "invalid_name", reason: "format" });
  const published = await setVisibility(page, { visibility: "published", vanity_name: ` ${address.toUpperCase()} `, confirm: true });
  expect(published.status()).toBe(200);
  expect((await published.json()).page).toMatchObject({ visibility: "published", vanity_name: address });
  // T3.1pc: a visitor with no credential opens it at /p/<name>: the guest views, indexable, never cached or a referrer.
  const visitor = await (await browser.newContext()).newPage();
  const open = await visitor.goto(`/p/${address}`);
  expect(open?.status()).toBe(200);
  expect(open?.headers()["x-robots-tag"]).toBeUndefined();
  expect(open?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(open?.headers()["cache-control"]).toContain("no-store");
  await expect(visitor.locator("main h1")).toBeVisible();
  expect((await visitor.request.get(`/p/${address.toUpperCase()}`)).status()).toBe(404);
  const back = await setVisibility(page, { visibility: "token_only" });
  expect(back.status()).toBe(200);
  expect((await back.json()).page).toMatchObject({ visibility: "token_only", vanity_name: address });
  // Token-only: the address is a 404 again, the same as a name nobody has (nonce and name aside), so it reveals nothing.
  const gone = await visitor.request.get(`/p/${address}`);
  const nobody = await visitor.request.get("/p/nobody-has-this");
  expect([gone.status(), nobody.status()]).toEqual([404, 404]);
  const plain = async (res: { text(): Promise<string> }, name: string) =>
    (await res.text()).replace(/(nonce=|nonce\\":\\)"[^"\\]*/g, '$1"').replaceAll(name, "[NAME]");
  expect(await plain(gone, address)).toBe(await plain(nobody, "nobody-has-this"));
  await visitor.context().close();
  const shown = await guest.reload();
  await expect(guest).toHaveURL("/g/home");
  expect(shown?.headers()["x-robots-tag"]).toBe("noindex");
  await guest.context().close();
});

// O9 sections (Q146 20, 21): the draft's base flags are the precondition; a stale base is a conflict.
test("a sections save answers the snapshot; a stale base is a conflict", async ({ page }, info) => {
  await signIn(page, info.project.name);
  const save = (base: string[], sections: string[]) =>
    page.request.post("/api/owner/sections", {
      data: { base_sections: base, sections, request_id: randomUUID() },
      headers: { origin: ORIGIN },
    });
  // A known start, so a retry after a failure midway does not begin from the test's own saves (review T2.6a).
  const before = ["home", "memories"];
  expect((await save((await snapshot(page)).sections, before)).status()).toBe(200);

  const saved = await save(before, ["home", "together"]);
  expect(saved.status()).toBe(200);
  expect((await saved.json()).page.sections).toEqual(["home", "together"]);
  expect((await snapshot(page)).sections).toEqual(["home", "together"]);

  const stale = await save(before, ["home"]);
  expect(stale.status()).toBe(409);
  expect(await stale.json()).toEqual({ error: "conflict" });
  expect((await snapshot(page)).sections).toEqual(["home", "together"]);

  expect((await save(["home", "together"], before)).status()).toBe(200);
});

// O19 settings (T2.8, Q115): one save per panel with the saved values it was edited against, through PostgREST's
// jsonb arguments. Bases come from a fresh snapshot, so a retry starts from a known state; the end restores them.
test("a settings save answers the snapshot; a retry applies once; a stale base is a conflict", async ({ page }, info) => {
  await signIn(page, info.project.name);
  const save = (panel: string, base: object, fields: object, request_id = randomUUID()) =>
    page.request.post("/api/owner/settings", { data: { panel, base, fields, request_id }, headers: { origin: ORIGIN } });
  const start = await snapshot(page);

  const id = randomUUID();
  const none = await save("theme", { theme: start.theme }, { theme: null }, id);
  expect(none.status()).toBe(200);
  expect((await none.json()).page.theme).toBeNull();
  // The same request again, its base now stale: answered as committed, not as a conflict.
  const replay = await save("theme", { theme: start.theme }, { theme: null }, id);
  expect(replay.status()).toBe(200);
  expect((await replay.json()).page.theme).toBeNull();

  const zone = await save("timezone", { timezone: start.timezone }, { timezone: "Europe/Paris" });
  expect((await zone.json()).page.timezone).toBe("Europe/Paris");
  const unknown = await save("timezone", { timezone: "Europe/Paris" }, { timezone: "Not/A_Zone" });
  expect(unknown.status()).toBe(400);
  expect(await unknown.json()).toEqual({ error: "invalid_timezone" });
  const stale = await save("timezone", { timezone: "UTC" }, { timezone: "Asia/Tokyo" });
  expect(stale.status()).toBe(409);
  expect(await stale.json()).toEqual({ error: "conflict" });

  const names = await save("names", { label_a: start.label_a }, { label_a: "   " });
  expect(await names.json()).toEqual({ error: "invalid_name", fields: { label_a: "required" } });

  expect((await save("theme", { theme: null }, { theme: start.theme })).status()).toBe(200);
  expect((await save("timezone", { timezone: "Europe/Paris" }, { timezone: start.timezone })).status()).toBe(200);
});

// E21: no sitemap lists any page (only Published pages may be indexed, and their route comes in Phase 3).
test("there is no sitemap", async ({ request }) => {
  expect((await request.get("/sitemap.xml")).status()).toBe(404);
});
