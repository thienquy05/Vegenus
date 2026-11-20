// Runs on every page (never on route handlers or static files). It sets the page CSP with a fresh
// nonce (design 7 §3), which Next.js applies to its own scripts; pages are rendered per request for it.
// On owner pages it also refreshes the session cookie (server components cannot write cookies). It
// gates nothing: requireOwner() in each page does (design 1 §9: never the only gate).
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAuth } from "./lib/auth";

// Inline style attributes stay allowed (the 44 px targets use them); scripts and <style> need the nonce.
// upgrade-insecure-requests only over https: on the local http server it would break every script.
// Owner pages also show preview images signed by Supabase Storage (O5), so only they name its origin.
const policy = (nonce: string, https: boolean, owner: boolean) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' blob: data:${owner && process.env.SUPABASE_URL ? ` ${new URL(process.env.SUPABASE_URL).origin}` : ""}`,
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

export async function proxy(request: NextRequest) {
  const https = request.nextUrl.protocol === "https:";
  const { pathname } = request.nextUrl;
  const owner = pathname === "/app" || pathname.startsWith("/app/");
  const csp = policy(Buffer.from(crypto.randomUUID()).toString("base64"), https, owner);
  // Built after any cookie refresh, so the forwarded request carries both the CSP and the new cookies.
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("content-security-policy", csp);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("content-security-policy", csp);
    return response;
  };
  let response = next();
  if (!owner) return response;
  const supabase = supabaseAuth(
    {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = next();
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
    https,
  );
  await supabase.auth.getUser();
  return response;
}

// Every page; route handlers, static files and next/link prefetches are left out (src/lib/routes.test.ts).
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
