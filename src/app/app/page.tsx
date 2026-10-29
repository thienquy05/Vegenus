import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";

// Owner area entry. The dashboard (O2) and the setup wizard come with T2.1; this unit only gates it.
export const metadata: Metadata = { title: "Vegenus", robots: { index: false } };

export default async function OwnerHome() {
  await requireOwner("/app");
  return (
    <main>
      <h1>Vegenus</h1>
      <form method="post" action="/api/owner/logout">
        <button type="submit">Log out / Đăng xuất</button>
      </form>
    </main>
  );
}
