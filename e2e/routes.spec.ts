import { expect, test } from "@playwright/test";
import { CRAWL_URLS, HANDLER_METHODS, ROUTES } from "../src/lib/routes";

// E31: with no session and no token, every route in the table gives only its allowed result.
// Pages are fetched with GET; route handlers with each listed method and one unlisted method.
// A dynamic route is requested at its concrete URL (CRAWL_URLS, src/lib/routes.ts); the build refuses one without.
for (const [path, routeClass] of Object.entries(ROUTES)) {
  const methods = HANDLER_METHODS[path];
  if (path === "/api/health") {
    // The one public handler without credentials by design (Q145 6): 200 or 503 by the daily job's last success,
    // never a body, never cached.
    test(`public handler ${path} answers no data`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([200, 503]).toContain(res.status());
      expect(await res.text()).toBe("");
      expect(res.headers()["cache-control"]).toBe("no-store");
      expect((await request.fetch(path, { method: "PUT", maxRedirects: 0 })).status()).toBe(405);
    });
    continue;
  }
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
    const url = CRAWL_URLS[path] ?? path;
    const res = await request.get(url, { maxRedirects: 0 });
    if (routeClass === "owner") {
      expect(res.status()).toBe(307);
      expect(res.headers().location).toBe(`/login?next=${encodeURIComponent(url)}`);
    } else if (routeClass === "guest") {
      // No token cookie: back to the tap notice, which reveals nothing (G-E1).
      expect(res.status()).toBe(307);
      expect(res.headers().location).toBe("/g");
    } else {
      expect(res.status()).toBe(routeClass === "public" ? 200 : 404);
    }
  });
}

// E37, E56: guessed paths get the same not-found as any unknown path, revealing nothing.
// `/app` is an owner route now: login redirect, covered above.
// Pages render per request for the CSP nonce (src/proxy.ts): bodies are compared without the nonce
// and without the requested path, which the RSC payload echoes back ("c":["","home"]).
test("guessed paths are the generic not-found", async ({ request }) => {
  const body = async (res: { text(): Promise<string> }) =>
    (await res.text()).replace(/(nonce=|nonce\\":\\)"[^"\\]*/g, '$1"').replace(/\\"c\\":\[[^\]]*\]/g, '\\"c\\":[]');
  const unknown = await request.get("/no-such-page");
  expect(unknown.status()).toBe(404);
  for (const path of ["/home", "/admin", "/dashboard"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(404);
    expect(await body(res), path).toBe(await body(unknown));
  }
  // A capitalized name redirects whether or not a page has it, so the redirect reveals nothing either.
  const capital = await request.get("/p/No-Such-Page", { maxRedirects: 0 });
  expect([capital.status(), capital.headers().location]).toEqual([308, "/p/no-such-page"]);
  // A bad album id is the not-found before any redirect, so only a well-formed id is carried over.
  expect((await request.get(`/p/No-Such-Page/memories/not-a-uuid`, { maxRedirects: 0 })).status()).toBe(404);
  // T3.1pc: a name that is no Published page is a 404 too (Next streams it from the page, so its body is not the static
  // one); that it says nothing about the name is checked against a real page in page-visibility.spec.ts.
  for (const path of ["/p/no-such-page", "/p/no-such-page/memories", "/p/not%20a%20name", "/p/x"]) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
  }
});
