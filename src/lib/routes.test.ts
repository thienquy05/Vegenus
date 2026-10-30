import { expect, test } from "vitest";
import { config as proxyConfig } from "../proxy";
import { buildProblems, HANDLER_METHODS, ROUTES, safeNext, type BuildEntryPoints } from "./routes";

const clean: BuildEntryPoints = {
  appRoutes: { "/page": "/", "/_not-found/page": "/_not-found", "/_global-error/page": "/_global-error" },
  pagesRoutes: ["/404", "/500"],
  serverActions: 0,
  rewrites: 0,
};

test("the current build has no problems", () => {
  expect(buildProblems(clean, { "/": "public" })).toEqual([]);
});

test("a built route missing from the table is reported (E32)", () => {
  const built = { ...clean, appRoutes: { ...clean.appRoutes, "/admin/page": "/admin" } };
  expect(buildProblems(built, { "/": "public" })).toEqual(["Route /admin is not in the route table (src/lib/routes.ts)."]);
});

test("object prototype names are not classified routes", () => {
  const built = { ...clean, appRoutes: { "/constructor/page": "/constructor" } };
  expect(buildProblems(built, {})).toHaveLength(1);
});

test("a route handler is refused until its methods are listed for the crawler", () => {
  const built = { ...clean, appRoutes: { ...clean.appRoutes, "/api/x/route": "/api/x" } };
  expect(buildProblems(built, { "/": "public", "/api/x": "public" }, {})).toEqual([
    "Route handler /api/x has no methods in HANDLER_METHODS (src/lib/routes.ts).",
  ]);
  expect(buildProblems(built, { "/": "public", "/api/x": "public" }, { "/api/x": ["POST"] })).toEqual([]);
});

test("every listed handler is a route in the table", () => {
  expect(Object.keys(HANDLER_METHODS).filter((path) => !Object.hasOwn(ROUTES, path))).toEqual([]);
});

// E35: after login only an owner route of our own table is followed; anything else goes to /app.
test.each([
  [undefined, "/app"],
  ["/app", "/app"],
  ["https://other.site", "/app"],
  ["//other.site", "/app"],
  ["/\\other.site", "/app"],
  ["javascript:alert(1)", "/app"],
  ["/login", "/app"],
  ["/", "/app"],
  ["constructor", "/app"],
  ["/api/owner/token", "/app"],
])("safeNext(%s) is %s", (next, expected) => {
  expect(safeNext(next)).toBe(expected);
});

// The proxy sets the page CSP (design 7 §3), so it runs on every page and never on route handlers.
test("the proxy runs on every page and no route handler", () => {
  const sources = proxyConfig.matcher.map((m) => new RegExp(`^${m.source}$`));
  for (const route of Object.keys(ROUTES)) {
    expect(sources.some((s) => s.test(route)), route).toBe(!Object.hasOwn(HANDLER_METHODS, route));
  }
});

test("a dynamic route is refused until the crawler has a concrete URL for it", () => {
  const built = { ...clean, appRoutes: { ...clean.appRoutes, "/r/[id]/page": "/r/[id]" } };
  expect(buildProblems(built, { "/": "public", "/r/[id]": "guest" })).toEqual([
    "Dynamic route /r/[id] is not supported yet: add a concrete crawler URL first.",
  ]);
});

test("Pages Router routes beyond the built-in error pages are reported", () => {
  const built = { ...clean, pagesRoutes: [...clean.pagesRoutes, "/_app", "/api/legacy"] };
  expect(buildProblems(built, { "/": "public" })).toEqual(["Pages Router route /api/legacy is not allowed; use the App Router."]);
});

test("server actions are reported", () => {
  expect(buildProblems({ ...clean, serverActions: 2 }, { "/": "public" })).toEqual([
    "2 server action(s) found; server actions are not classified in the route table yet.",
  ]);
});

test("config rewrites are reported", () => {
  expect(buildProblems({ ...clean, rewrites: 1 }, { "/": "public" })).toEqual([
    "1 rewrite(s) in the Next config; rewrites are not classified in the route table yet.",
  ]);
});

test("the landing page is public", () => {
  expect(ROUTES["/"]).toBe("public");
});
