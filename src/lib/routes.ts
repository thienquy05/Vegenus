// Route table, deny by default (design 1 §9, layer 1). Every route the build contains
// needs a class here; `npm run build` fails otherwise (scripts/check-routes.ts, E32).
// The class names the handler check the route starts with: requireGuest(), requireOwner()
// or requireMachine(); `public` routes need none.
export type RouteClass = "public" | "guest" | "owner" | "machine";

export const ROUTES: Record<string, RouteClass> = {
  "/": "public",
  "/login": "public",
  "/app": "owner",
  // The guest shell shows G-E1 or exchanges the fragment; the guest pages need the token cookie.
  "/g": "public",
  "/g/home": "guest",
  // Login, logout and the token exchange check Origin themselves; logout without a session only clears cookies.
  "/api/owner/login": "public",
  "/api/owner/logout": "public",
  "/api/guest/session": "public",
  // Checks Origin, then the owner session; the database checks the page owner.
  "/api/owner/token": "owner",
  "/api/owner/visibility": "owner",
};

// The methods each route handler exports. The crawler (e2e/routes.spec.ts) checks each one without
// credentials and expects 405 for every other method.
export const HANDLER_METHODS: Record<string, string[]> = {
  "/api/owner/login": ["POST"],
  "/api/owner/logout": ["POST"],
  "/api/guest/session": ["POST"],
  "/api/owner/token": ["POST"],
  "/api/owner/visibility": ["POST"],
};

// E35: where login may send the owner afterwards. Only an exact owner page from this table (never a
// route handler), so no absolute, protocol-relative or backslash URL can get through.
// ponytail: exact match only; owner routes with ids or a query need a pattern check when they exist
export function safeNext(next: string | undefined): string {
  return next && Object.hasOwn(ROUTES, next) && ROUTES[next] === "owner" && !Object.hasOwn(HANDLER_METHODS, next) ? next : "/app";
}

// Every request entry point the build emits, read from the .next manifests. The proxy is not listed:
// src/proxy.ts only refreshes the owner session, and a unit test keeps its matcher on owner routes.
export type BuildEntryPoints = {
  appRoutes: Record<string, string>; // app-path-routes-manifest.json: "/x/page" or "/x/route" -> "/x"
  pagesRoutes: string[]; // server/pages-manifest.json keys
  serverActions: number;
  rewrites: number; // routes-manifest.json: beforeFiles + afterFiles + fallback
};

// Built by Next itself, not addressable app routes.
const FRAMEWORK_ROUTES = ["/_not-found", "/_global-error"];
const FRAMEWORK_PAGES = ["/_app", "/_document", "/_error", "/404", "/500"];

// ponytail: dynamic routes, server actions and rewrites are refused outright; each gets its own
// classification and crawler cases when the first one lands
export function buildProblems(built: BuildEntryPoints, table = ROUTES, methods = HANDLER_METHODS): string[] {
  const problems: string[] = [];
  for (const [file, route] of Object.entries(built.appRoutes)) {
    if (FRAMEWORK_ROUTES.includes(route)) continue;
    if (!Object.hasOwn(table, route)) problems.push(`Route ${route} is not in the route table (src/lib/routes.ts).`);
    else if (file.endsWith("/route") && !Object.hasOwn(methods, route)) problems.push(`Route handler ${route} has no methods in HANDLER_METHODS (src/lib/routes.ts).`);
    else if (route.includes("[")) problems.push(`Dynamic route ${route} is not supported yet: add a concrete crawler URL first.`);
  }
  for (const page of built.pagesRoutes) {
    if (!FRAMEWORK_PAGES.includes(page)) problems.push(`Pages Router route ${page} is not allowed; use the App Router.`);
  }
  if (built.serverActions) problems.push(`${built.serverActions} server action(s) found; server actions are not classified in the route table yet.`);
  if (built.rewrites) problems.push(`${built.rewrites} rewrite(s) in the Next config; rewrites are not classified in the route table yet.`);
  return problems;
}
