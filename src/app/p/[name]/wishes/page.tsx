import { notFound } from "next/navigation";
import { requireVisitor } from "@/lib/guest";
import { GuestApp } from "../../../g/guest-app";

// Visitors leave wishes here too (T3.2, Q157); a disabled section asked for by URL is not found (E5), as under /g.
export default async function VisitorWishesPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const summary = await requireVisitor(name, "/wishes");
  if (!summary.sections.includes("guestbook")) notFound();
  return <GuestApp summary={summary} section="guestbook" cred={{ page: name }} />;
}
