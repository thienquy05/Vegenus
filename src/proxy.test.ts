import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const getUser = vi.fn();
vi.mock("./lib/auth", () => ({ supabaseAuth: vi.fn(() => ({ auth: { getUser } })) }));

const { supabaseAuth } = await import("./lib/auth");
const { proxy } = await import("./proxy");

beforeEach(() => vi.clearAllMocks());

const csp = async (path: string) => (await proxy(new NextRequest(`http://localhost:3000${path}`))).headers.get("content-security-policy") ?? "";
const nonceOf = (policy: string) => policy.match(/'nonce-([^']+)'/)?.[1];

// Design 7 §3: a strict CSP on every page (no 'unsafe-inline' scripts, no framing), with a fresh nonce
// that Next.js applies to its own scripts.
test.each(["/", "/login", "/g", "/g/home", "/app"])("%s gets a strict nonce CSP", async (path) => {
  const policy = await csp(path);
  const script = policy.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
  expect(nonceOf(script)).toBeTruthy();
  expect(script).toContain("'strict-dynamic'");
  expect(script).not.toContain("'unsafe-inline'");
  for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) {
    expect(policy).toContain(directive);
  }
});

test("each request gets its own nonce, and rendering sees it", async () => {
  const response = await proxy(new NextRequest("http://localhost:3000/g"));
  const nonce = nonceOf(response.headers.get("content-security-policy") ?? "");
  // Next.js reads the nonce from the forwarded request CSP header (x-middleware-request-*).
  expect(response.headers.get("x-middleware-request-content-security-policy")).toContain(`'nonce-${nonce}'`);
  expect(nonceOf(await csp("/g"))).not.toBe(nonce);
});

// Over plain http (the local server e2e uses) the upgrade would send every script to https and break the page.
test("insecure requests are upgraded only on https", async () => {
  expect(await csp("/g")).not.toContain("upgrade-insecure-requests");
  expect((await proxy(new NextRequest("https://vegenus.example/g"))).headers.get("content-security-policy")).toContain("upgrade-insecure-requests");
});

test("only owner routes refresh the session", async () => {
  await proxy(new NextRequest("http://localhost:3000/g/home"));
  await proxy(new NextRequest("http://localhost:3000/login"));
  expect(supabaseAuth).not.toHaveBeenCalled();
  await proxy(new NextRequest("http://localhost:3000/app"));
  expect(getUser).toHaveBeenCalledOnce();
});

afterEach(() => vi.unstubAllEnvs()); // also after a failed assertion

// O5 previews (owner UI "O4 Content list and O5 Item editor"): owner pages show images signed by Supabase Storage, so
// their img-src names the Supabase origin; no other page does, and nothing else is loosened.
test("owner pages may show images from the Supabase origin; other pages may not", async () => {
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.example/");
  const img = (policy: string) => policy.split(";").find((d) => d.trim().startsWith("img-src"))?.trim();
  expect(img(await csp("/app"))).toBe("img-src 'self' blob: data: https://project.supabase.example");
  for (const path of ["/", "/login", "/g", "/g/home"]) expect(img(await csp(path)), path).toBe("img-src 'self' blob: data:");
  expect(await csp("/app")).toContain("connect-src 'self';");
});
