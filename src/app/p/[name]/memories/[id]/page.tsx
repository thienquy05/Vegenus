import { notFound } from "next/navigation";
import { requireVisitor } from "@/lib/guest";
import { isUuid } from "@/lib/owner-api";
import { GuestApp } from "../../../../g/guest-app";

// G3 at its own address, as under /g; the album reads the memory through /api/guest/item, which says when it is gone.
export default async function VisitorMemoryPage({ params }: { params: Promise<{ name: string; id: string }> }) {
  const { name, id } = await params;
  if (!isUuid(id)) notFound(); // before the name's redirect, so only a well-formed id is carried over
  const summary = await requireVisitor(name, `/memories/${id}`);
  if (!summary.sections.includes("memories")) notFound();
  return <GuestApp summary={summary} section="memories" item={id} cred={{ page: name }} />;
}
