import { expect, test } from "@playwright/test";
import { HANDLER_METHODS, ROUTES } from "../src/lib/routes";

// E31: with no session and no token, every route in the table gives only its allowed result.
// Pages are fetched with GET; route handlers with each listed method and one unlisted method.
// The build refuses dynamic routes until this file gets concrete URLs for them (src/lib/routes.ts).
// ponytail: guest routes expect not-found until T1.5 brings the first one
for (const [path, routeClass] of Object.entries(ROUTES)) {
  const methods = HANDLER_METHODS[path];
  if (methods) {
    test(`${routeClass} handler ${path} without credentials`, async ({ request }) => {
      // No Origin and no session: login and logout refuse before doing anything.
      for (const method of methods) {
        expect((await request.fetch(path, { method, maxRedirects: 0 })).status(), method).toBe(403);
      }
      const other = methods.includes("GET") ? "PUT" : "GET";
      expect((await request.fetch(path, { method: other, maxRedirects: 0 })).status(), other).toBe(405);
    });
    continue;
  }
  test(`${routeClass} route ${path} without credentials`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 });
    if (routeClass === "owner") {
      expect(res.status()).toBe(307);
      expect(res.headers().location).toBe(`/login?next=${encodeURIComponent(path)}`);
    } else {
      expect(res.status()).toBe(routeClass === "public" ? 200 : 404);
    }
  });
}

// E37, E56: guessed paths get the same not-found as any unknown path, revealing nothing.
// `/app` is an owner route now: login redirect, covered above.
test("guessed paths are the generic not-found", async ({ request }) => {
  const unknown = await request.get("/no-such-page");
  expect(unknown.status()).toBe(404);
  for (const path of ["/home", "/admin", "/dashboard"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(404);
    expect(await res.text(), path).toBe(await unknown.text());
  }
});
