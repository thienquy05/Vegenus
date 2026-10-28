import { expect, test } from "@playwright/test";
import { ROUTES } from "../src/lib/routes";

// E31: with no session and no token, every route in the table gives only its allowed result.
// Only static page routes with GET: the build refuses dynamic routes and route handlers until
// this file gets concrete URLs and per-method cases for them (src/lib/routes.ts).
// ponytail: non-public routes expect not-found; owner routes switch to the login redirect with T1.4
for (const [path, routeClass] of Object.entries(ROUTES)) {
  test(`${routeClass} route ${path} without credentials`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status()).toBe(routeClass === "public" ? 200 : 404);
  });
}

// E37, E56: guessed paths get the same not-found as any unknown path, revealing nothing.
test("guessed paths are the generic not-found", async ({ request }) => {
  const unknown = await request.get("/no-such-page");
  expect(unknown.status()).toBe(404);
  for (const path of ["/home", "/admin", "/dashboard", "/app"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(404);
    expect(await res.text(), path).toBe(await unknown.text());
  }
});
