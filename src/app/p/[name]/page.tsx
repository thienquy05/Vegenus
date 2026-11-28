import { requireVisitor } from "@/lib/guest";
import { GuestApp } from "../../g/guest-app";

// A Published page at its name (T3.1pc, Q155): the T3.1 views, read through the public_* functions; an unknown name or
// a page that is not Published is the ordinary not-found. Indexable: no X-Robots-Tag here (next.config.ts).
export default async function VisitorHomePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <GuestApp summary={await requireVisitor(name)} section="home" cred={{ page: name }} />;
}
