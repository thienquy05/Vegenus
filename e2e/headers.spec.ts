import { expect, test } from "@playwright/test";

// Design 7 §3 and §7: the security header baseline on a guest route, the owner area, the token
// exchange and an owner API route, and the guest cookie flags.
const ORIGIN = "http://localhost:3000";
const BASELINE = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
};

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}` });
});

test("pages send the baseline and a strict nonce CSP", async ({ request }) => {
  for (const path of ["/", "/login", "/g", "/app"]) {
    const headers = (await request.get(path, { maxRedirects: 0 })).headers();
    expect(headers, path).toMatchObject(BASELINE);
    expect(headers["permissions-policy"], path).toContain("camera=()");
    expect(headers["x-powered-by"], path).toBeUndefined();
    const csp = headers["content-security-policy"] ?? "";
    expect(csp, path).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp, path).toContain("frame-ancestors 'none'");
    expect(csp, path).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  }
});

test("route handlers send the baseline and a CSP that allows nothing", async ({ request }) => {
  for (const path of ["/api/guest/session", "/api/owner/token"]) {
    const headers = (await request.post(path, { headers: { origin: ORIGIN } })).headers();
    expect(headers, path).toMatchObject({ ...BASELINE, "content-security-policy": "default-src 'none'; frame-ancestors 'none'" });
  }
});

test("guest routes keep no-referrer, owner pages a cross-origin-safe referrer", async ({ request }) => {
  expect((await request.get("/g")).headers()["referrer-policy"]).toBe("no-referrer");
  expect((await request.post("/api/guest/session", { headers: { origin: ORIGIN } })).headers()["referrer-policy"]).toBe("no-referrer");
  expect((await request.get("/login")).headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
});

// The nonce must reach Next's own scripts: a page that cannot hydrate under the CSP reports a violation.
test("pages hydrate under the CSP without violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
  for (const path of ["/", "/login", "/g"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  // The login form is a client component: it answers input only once hydrated.
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeEditable();
  expect(violations).toEqual([]);
});

test("the guest cookie is HttpOnly and SameSite=Lax", async ({ page, context }) => {
  await page.goto(`/g#${process.env.E2E_GUEST_TOKEN}`);
  await expect(page).toHaveURL("/g/home");
  const cookie = (await context.cookies()).find((c) => c.name === "vegenus_g");
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
});
