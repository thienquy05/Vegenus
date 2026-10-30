import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Vegenus" };

// The page CSP carries a per-request nonce (src/proxy.ts), which a page built ahead of time cannot have.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
