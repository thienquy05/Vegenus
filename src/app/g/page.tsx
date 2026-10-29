import { GuestEntry } from "./guest-entry";

// The /g shell (design 1 §4 step 1): no data, no analytics. Dynamic so it is never cached (no-store).
export const dynamic = "force-dynamic";

export default function GuestShell() {
  return <GuestEntry />;
}
