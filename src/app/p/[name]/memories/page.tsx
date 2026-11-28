import { notFound } from "next/navigation";
import { requireVisitor } from "@/lib/guest";
import { GuestApp } from "../../../g/guest-app";

// A disabled section asked for by URL is not found, with no data (E5), as under /g.
export default async function VisitorMemoriesPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const summary = await requireVisitor(name, "/memories");
  if (!summary.sections.includes("memories")) notFound();
  return <GuestApp summary={summary} section="memories" cred={{ page: name }} />;
}
