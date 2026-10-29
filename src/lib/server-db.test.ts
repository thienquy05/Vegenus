import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

// Design 3 §3.9: the vegenus_server connection is used only by the server routes listed here.
const ALLOWED = ["src/app/api/guest/session/route.ts", "src/app/api/owner/login/route.ts"];

test("only the listed routes import server-db", () => {
  const files = readdirSync("src", { recursive: true, encoding: "utf8" })
    .map((f) => join("src", f))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") && f !== join("src", "lib", "server-db.ts"));
  const importers = files.filter((f) => /from\s+["'][^"']*server-db["']|import\s+["'][^"']*server-db["']/.test(readFileSync(f, "utf8")));
  expect(importers.sort()).toEqual(ALLOWED);
});
