// Runs after `next build` (npm postbuild): fails on any request entry point that the route
// table does not classify (design 1 §9, E32). Reads the build output, not the source tree,
// so no routing convention can hide a route from the check.
import { readFileSync } from "node:fs";
import { buildProblems } from "../src/lib/routes.ts";

const manifest = (file: string) => JSON.parse(readFileSync(`.next/${file}`, "utf8"));

const actions = manifest("server/server-reference-manifest.json");
const { beforeFiles, afterFiles, fallback } = manifest("routes-manifest.json").rewrites;
const problems = buildProblems({
  appRoutes: manifest("app-path-routes-manifest.json"),
  pagesRoutes: Object.keys(manifest("server/pages-manifest.json")),
  serverActions: Object.keys(actions.node).length + Object.keys(actions.edge).length,
  rewrites: beforeFiles.length + afterFiles.length + fallback.length,
});

for (const problem of problems) console.error(problem);
if (problems.length) process.exit(1);
