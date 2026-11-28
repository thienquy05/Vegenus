import { notFound } from "next/navigation";
import { requireVisitor } from "@/lib/guest";
import { GuestApp } from "../../../g/guest-app";

// A disabled section asked for by URL is not found, with no data (E5), as under /g.
export default async function VisitorTogetherPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const summary = await requireVisitor(name);
  if (!summary.sections.includes("together")) notFound();
  return <GuestApp summary={summary} section="together" cred={{ page: name }} />;
}
