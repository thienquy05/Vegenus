import type { ReactNode } from "react";
import type { GuestSummary } from "@/lib/guest";

// ponytail: placeholder guest home (enabled sections only); the themed views G1-G8 come with T3.1 and
// Vietnamese with T3.3, so the text is English and marked as such.
export function GuestHome({ summary, children }: { summary: GuestSummary; children?: ReactNode }) {
  return (
    <main lang="en">
      {children}
      <h1>Vegenus</h1>
      <ul>
        {summary.sections.map((section) => (
          <li key={section}>{section}</li>
        ))}
      </ul>
    </main>
  );
}
