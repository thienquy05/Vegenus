import type { Metadata } from "next";
import { headers } from "next/headers";
import { Standalone } from "./standalone";

// P1 standalone (T3.2c; privacy design §3.1): no token needed, the neutral look, never indexed; it names no one.
export const metadata: Metadata = { title: "Privacy · Vegenus", robots: { index: false } };

export default async function Privacy() {
  const accept = (await headers()).get("accept-language") ?? "";
  return <Standalone initial={/^vi\b/i.test(accept.trim()) ? "vi" : "en"} />;
}
