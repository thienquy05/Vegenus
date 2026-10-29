import type { NextConfig } from "next";

// Guest routes (design 1 §4, §8; E21, E27): never indexed, cached or sent as a referrer.
// The full header baseline (design 7 §3) comes with its own unit before the Phase 1 audit.
const GUEST_HEADERS = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex" },
  { key: "Cache-Control", value: "no-store" },
];

const config: NextConfig = {
  async headers() {
    return ["/g", "/g/:path*", "/api/guest/:path*"].map((source) => ({ source, headers: GUEST_HEADERS }));
  },
};

export default config;
