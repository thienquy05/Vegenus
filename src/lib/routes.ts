// Route table, deny by default (design 1 §9, layer 1). Every route the build contains
// needs a class here; `npm run build` fails otherwise (scripts/check-routes.ts, E32).
// The class names the handler check the route starts with: requireGuest(), requireOwner()
// or requireMachine(); `public` routes need none.
export type RouteClass = "public" | "guest" | "owner" | "machine";

export const ROUTES: Record<string, RouteClass> = {
  "/": "public",
};

// Every request entry point the build emits, read from the .next manifests.
export type BuildEntryPoints = {
  appRoutes: Record<string, string>; // app-path-routes-manifest.json: "/x/page" or "/x/route" -> "/x"
  pagesRoutes: string[]; // server/pages-manifest.json keys
  serverActions: number;
  proxy: boolean;
  rewrites: number; // routes-manifest.json: beforeFiles + afterFiles + fallback
};

// Built by Next itself, not addressable app routes.
const FRAMEWORK_ROUTES = ["/_not-found", "/_global-error"];
const FRAMEWORK_PAGES = ["/_app", "/_document", "/_error", "/404", "/500"];

// ponytail: route handlers, dynamic routes, server actions, a proxy and rewrites are refused outright;
// each gets its own classification and crawler cases when the first one lands
export function buildProblems(built: BuildEntryPoints, table = ROUTES): string[] {
  const problems: string[] = [];
  for (const [file, route] of Object.entries(built.appRoutes)) {
    if (FRAMEWORK_ROUTES.includes(route)) continue;
    if (!Object.hasOwn(table, route)) problems.push(`Route ${route} is not in the route table (src/lib/routes.ts).`);
    else if (file.endsWith("/route")) problems.push(`Route handler ${route} is not supported yet: add crawler cases for every method first.`);
    else if (route.includes("[")) problems.push(`Dynamic route ${route} is not supported yet: add a concrete crawler URL first.`);
  }
  for (const page of built.pagesRoutes) {
    if (!FRAMEWORK_PAGES.includes(page)) problems.push(`Pages Router route ${page} is not allowed; use the App Router.`);
  }
  if (built.serverActions) problems.push(`${built.serverActions} server action(s) found; server actions are not classified in the route table yet.`);
  if (built.proxy) problems.push("A proxy (middleware) is not classified in the route table yet.");
  if (built.rewrites) problems.push(`${built.rewrites} rewrite(s) in the Next config; rewrites are not classified in the route table yet.`);
  return problems;
}
