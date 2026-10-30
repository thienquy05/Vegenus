"use client";
import { MIN_TARGET_PX } from "@/lib/ui";

// Read-failure state of the common contract (owner UI §3) for every owner page, e.g. an Auth outage
// thrown by requireOwner. retry() re-fetches the page from the server; reset() would only re-render it.
export default function OwnerError({ retry }: { error: unknown; reset: () => void; retry: () => void }) {
  return (
    <main>
      <p role="alert">Couldn’t load this. Try again. / Chưa tải được. Thử lại.</p>
      <button type="button" style={{ minHeight: MIN_TARGET_PX, minWidth: MIN_TARGET_PX }} onClick={() => retry()}>
        Try again / Thử lại
      </button>
    </main>
  );
}
