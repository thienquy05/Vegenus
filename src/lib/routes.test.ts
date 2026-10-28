import { expect, test } from "vitest";
import { buildProblems, ROUTES, type BuildEntryPoints } from "./routes";

const clean: BuildEntryPoints = {
  appRoutes: { "/page": "/", "/_not-found/page": "/_not-found", "/_global-error/page": "/_global-error" },
  pagesRoutes: ["/404", "/500"],
  serverActions: 0,
  proxy: false,
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

test("a route handler is refused until the crawler covers its methods", () => {
  const built = { ...clean, appRoutes: { ...clean.appRoutes, "/api/x/route": "/api/x" } };
  expect(buildProblems(built, { "/": "public", "/api/x": "public" })).toEqual([
    "Route handler /api/x is not supported yet: add crawler cases for every method first.",
  ]);
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

test("server actions and a proxy are reported", () => {
  expect(buildProblems({ ...clean, serverActions: 2, proxy: true }, { "/": "public" })).toEqual([
    "2 server action(s) found; server actions are not classified in the route table yet.",
    "A proxy (middleware) is not classified in the route table yet.",
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
