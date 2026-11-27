import { notFound } from "next/navigation";
import { requireGuest } from "@/lib/guest";
import { GuestApp } from "../guest-app";

// A disabled section asked for by URL is not found, with no data (E5).
export default async function GuestMemoriesPage() {
  const summary = await requireGuest();
  if (!summary.sections.includes("memories")) notFound();
  return <GuestApp summary={summary} section="memories" />;
}
