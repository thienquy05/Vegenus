import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// T1.5a token exchange (design 1 §4; E27, E30) against the local Supabase stack. e2e/global-setup.ts
// seeds a Token-only page with a random token for this run; the token is never a real value.
const token = () => process.env.E2E_GUEST_TOKEN!;
const TAP = "Tap the tag or scan the QR code to see this page.";
const NOT_REMEMBERED = "This visit won’t be remembered";
const GUEST_POST = { "content-type": "application/json", "x-vegenus-guest": "1", origin: "http://localhost:3000" };

// Each test sends its own client IP, so the per-IP exchange bucket of one test never trips another.
const randomIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
});

// Every request the page makes, with its Referer, to prove the token travels only in a POST body.
function recordRequests(page: Page) {
  const seen: { url: string; referer: string; body: string }[] = [];
  page.on("request", (r) => seen.push({ url: r.url(), referer: r.headers().referer ?? "", body: r.postData() ?? "" }));
  return seen;
}

test("the fragment is exchanged for the guest cookie and removed (E27)", async ({ page, context }) => {
  const seen = recordRequests(page);
  await page.goto(`/g#${token()}`);
  await expect(page).toHaveURL("/g/home");
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.getByRole("listitem").filter({ hasText: "memories" })).toBeVisible();

  const cookie = (await context.cookies()).find((c) => c.name === "vegenus_g");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect(cookie?.path).toBe("/");
  const days = (cookie!.expires * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(29.9);
  expect(days).toBeLessThanOrEqual(30);

  expect(seen.filter((r) => r.url.includes(token()) || r.referer.includes(token()))).toEqual([]);
  const posts = seen.filter((r) => r.body.includes(token()));
  expect(posts.map((r) => new URL(r.url).pathname)).toEqual(["/api/guest/session"]);
});

test("an empty fragment and a wrong token show the same tap notice, and set no cookie", async ({ page, context }) => {
  await page.goto("/g");
  await expect(page.getByRole("main")).toHaveText(TAP);
  const empty = await page.getByRole("main").innerHTML();

  // Same tab, only the fragment changes (Codex, round 3): the wrong token must really be sent and refused.
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/guest/session") && r.method() === "POST");
  await page.goto(`/g#${"A".repeat(43)}`);
  await sent;
  await expect(page.getByRole("main")).toHaveText(TAP);
  expect(await page.getByRole("main").innerHTML()).toBe(empty);
  expect((await context.cookies()).filter((c) => c.name === "vegenus_g")).toEqual([]);
});

// Codex, round 3: a re-tap in the same tab after the tap notice changes only the fragment.
test("a token arriving in the same tab after the tap notice is exchanged", async ({ page }) => {
  await page.goto("/g");
  await expect(page.getByRole("main")).toHaveText(TAP);
  await page.goto(`/g#${token()}`);
  await expect(page).toHaveURL("/g/home");
});

// Codex, round 4: an older exchange answered late must not overwrite the newer token's cookie. A is
// held back, B starts on top of it, and B's probe is slow enough for A's answer to land in between.
test("overlapping exchanges end with the newest token's cookie and page", async ({ page, context }) => {
  const tokenB = process.env.E2E_GUEST_TOKEN_B!;
  await page.route("/api/guest/session", async (route) => {
    if (route.request().postData()?.includes(token())) await new Promise((r) => setTimeout(r, 1000));
    await route.continue();
  });
  await page.route("/g/home", async (route) => {
    if (route.request().resourceType() === "fetch") await new Promise((r) => setTimeout(r, 2000));
    await route.continue();
  });
  await page.goto(`/g#${token()}`);
  await page.evaluate((b) => (location.hash = b), tokenB);
  await expect(page).toHaveURL("/g/home", { timeout: 10_000 });
  await expect(page.getByRole("listitem").filter({ hasText: "zodiac" })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === "vegenus_g")?.value).toBe(tokenB);
});

test("the guest home without a cookie goes back to the tap notice", async ({ request }) => {
  const res = await request.get("/g/home", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toBe("/g");
});

// E30: some in-app browsers drop cookies. The visit works from memory and keeps the fragment.
test("cookies blocked: the visit works in memory with the notice (E30)", async ({ page, context }) => {
  await page.route("/api/guest/session", async (route) => {
    const response = await route.fetch();
    await context.clearCookies(); // route.fetch() stores the cookie in this context itself
    const headers = { ...response.headers() };
    delete headers["set-cookie"];
    await route.fulfill({ response, headers });
  });
  await page.goto(`/g#${token()}`);
  await expect(page.getByRole("status")).toContainText(NOT_REMEMBERED);
  await expect(page.getByRole("listitem").filter({ hasText: "memories" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/g");
  expect(new URL(page.url()).hash).toBe(`#${token()}`);
  expect((await context.cookies()).filter((c) => c.name === "vegenus_g")).toEqual([]);
});

// Codex, T1.5a review: only a redirect from the probe means "cookies blocked". A probe that fails for
// another reason must not keep a working token in the address bar (E27).
test("a failed probe clears the fragment and still shows the page", async ({ page, context }) => {
  await page.route("/g/home", (route) => (route.request().resourceType() === "fetch" ? route.abort() : route.continue()));
  await page.goto(`/g#${token()}`);
  await expect(page.getByRole("listitem").filter({ hasText: "memories" })).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  await expect(page.getByRole("status")).toHaveCount(0);
  expect((await context.cookies()).filter((c) => c.name === "vegenus_g")).toHaveLength(1);
});

// Codex, T1.5a review: a transport or server failure is not a wrong token. The token leaves the address
// bar but stays in memory, so the guest can retry without a new tap.
test("a failed exchange can be retried without a new tap", async ({ page }) => {
  let first = true;
  await page.route("/api/guest/session", (route) => {
    if (!first) return route.continue();
    first = false;
    return route.abort();
  });
  await page.goto(`/g#${token()}`);
  // Our alert lives in <main>; Next's route announcer is another role="alert" outside it.
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Couldn’t open the page");
  expect(new URL(page.url()).hash).toBe("");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL("/g/home");
});

// Codex, T1.5a review round 2: after a failed exchange the fragment is gone; if the retry then finds cookies
// blocked, the fragment must come back, or a reload loses the visit (E30).
test("a retry that finds cookies blocked puts the fragment back", async ({ page, context }) => {
  let first = true;
  await page.route("/api/guest/session", async (route) => {
    if (first) {
      first = false;
      return route.abort();
    }
    const response = await route.fetch();
    await context.clearCookies(); // route.fetch() stores the cookie in this context itself
    const headers = { ...response.headers() };
    delete headers["set-cookie"];
    await route.fulfill({ response, headers });
  });
  await page.goto(`/g#${token()}`);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("status")).toContainText(NOT_REMEMBERED);
  expect(new URL(page.url()).hash).toBe(`#${token()}`);
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "memories" })).toBeVisible();
});

test("the exchange refuses a missing header or a foreign Origin (CSRF, design 1 §1)", async ({ request }) => {
  const data = { token: token() };
  const ip = randomIp();
  const noHeader = await request.post("/api/guest/session", { data, headers: { ...GUEST_POST, "x-vegenus-guest": "", "x-forwarded-for": ip } });
  expect(noHeader.status()).toBe(403);
  const foreign = await request.post("/api/guest/session", { data, headers: { ...GUEST_POST, origin: "https://other.site", "x-forwarded-for": ip } });
  expect(foreign.status()).toBe(403);
  expect(foreign.headers()["set-cookie"]).toBeUndefined();
});

test("a wrong token, a malformed body and the rate limit give one generic answer", async ({ request }, info) => {
  // Its own address, outside randomIp(): this test uses up the bucket, which must not hit another test.
  const ip = `192.0.2.${info.project.name === "webkit" ? 2 : 1}`;
  const post = (data: unknown) => request.post("/api/guest/session", { data, headers: { ...GUEST_POST, "x-forwarded-for": ip } });
  const wrong = await post({ token: "A".repeat(43) });
  expect(wrong.status()).toBe(404);
  const generic = await wrong.text();
  expect(await (await post({ nothing: true })).text()).toBe(generic);

  // 100 per IP per 15 minutes (owner, 2026-10-29); three used above and below.
  expect((await post({ token: token() })).status()).toBe(200);
  for (let i = 0; i < 97; i++) await post({ token: "A".repeat(43) });
  const limited = await post({ token: token() });
  expect(limited.status()).toBe(404);
  expect(await limited.text()).toBe(generic);
  expect(limited.headers()["set-cookie"]).toBeUndefined();
});

// E21, design 7 §3: guest responses are never indexed, cached or sent as a referrer.
test("guest responses carry noindex, no-referrer and no-store", async ({ page, request }) => {
  const shell = await request.get("/g");
  const exchange = await request.post("/api/guest/session", { data: { token: token() }, headers: { ...GUEST_POST, "x-forwarded-for": randomIp() } });
  await page.goto(`/g#${token()}`);
  await expect(page).toHaveURL("/g/home");
  const home = await page.request.get("/g/home", { maxRedirects: 0 });
  expect(home.status()).toBe(200);
  for (const [name, res] of Object.entries({ shell, exchange, home })) {
    expect(res.headers()["referrer-policy"], name).toBe("no-referrer");
    expect(res.headers()["x-robots-tag"], name).toBe("noindex");
    expect(res.headers()["cache-control"], name).toContain("no-store");
  }
});

// E27: the token never reaches a server log line (playwright.config.ts writes the server's output here).
test("no server log line contains the token", async ({ page }) => {
  await page.goto(`/g#${token()}`);
  await expect(page).toHaveURL("/g/home");
  expect(readFileSync(".next/server.log", "utf8")).not.toContain(token());
});
