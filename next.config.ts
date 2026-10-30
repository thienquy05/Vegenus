import type { NextConfig } from "next";

// Every response (design 7 §3). The page CSP is set per request in src/proxy.ts; route handlers
// answer JSON or redirects only, so they get a CSP that allows nothing.
const BASELINE = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];
const API_CSP = [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" }];

// Guest routes (design 1 §4, §8; E21, E27): never indexed, cached or sent as a referrer.
const GUEST_HEADERS = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex" },
  { key: "Cache-Control", value: "no-store" },
];

const config: NextConfig = {
  poweredByHeader: false,
  // Later entries win for the same header, so the guest Referrer-Policy overrides the baseline.
  async headers() {
    return [
      { source: "/:path*", headers: BASELINE },
      { source: "/api/:path*", headers: API_CSP },
      ...["/g", "/g/:path*", "/api/guest/:path*"].map((source) => ({ source, headers: GUEST_HEADERS })),
    ];
  },
};

export default config;
