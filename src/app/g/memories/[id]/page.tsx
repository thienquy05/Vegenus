import { notFound } from "next/navigation";
import { requireGuest } from "@/lib/guest";
import { isUuid } from "@/lib/owner-api";
import { GuestApp } from "../../guest-app";

// G3 at its own address (T3.1c). Memories disabled, or an id that is not a uuid, is not found (E5); the album itself
// reads the memory through /api/guest/item, which says when it is gone.
export default async function GuestMemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const summary = await requireGuest();
  const { id } = await params;
  if (!summary.sections.includes("memories") || !isUuid(id)) notFound();
  return <GuestApp summary={summary} section="memories" item={id} />;
}
