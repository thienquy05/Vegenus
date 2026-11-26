import { notFound } from "next/navigation";
import { requireGuest } from "@/lib/guest";
import { GuestApp } from "../guest-app";

// A disabled section asked for by URL is not found, with no data (E5).
export default async function GuestWishesPage() {
  const summary = await requireGuest();
  if (!summary.sections.includes("guestbook")) notFound();
  return <GuestApp summary={summary} section="guestbook" />;
}
