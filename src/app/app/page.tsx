import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import Owner from "./owner";

// Owner area entry: the dashboard (O2) and the setup wizard (O3), T2.1b. requireOwner gates the page; the client
// reads the saved setup through /api/owner/page, which checks the session again.
export const metadata: Metadata = { title: "Vegenus", robots: { index: false } };

export default async function OwnerHome() {
  await requireOwner("/app");
  return <Owner />;
}
