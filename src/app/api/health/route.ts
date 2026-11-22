import { NextResponse } from "next/server";
import { healthOk } from "@/lib/server-db";

// Health for the scheduled GitHub check (T2.5a; PRD Q145 6, 7; E23). Class `public`: no credentials by design, so it
// answers no data: 200 while the daily job succeeded in the last 26 hours, else 503 (an outage included), empty body.
// Reading it also wakes the database (a second keep-alive).
// shortcut: no rate limit (one indexed read per call); add one with Phase 6's rate limits if it is ever abused
export async function GET() {
  let ok = false;
  try {
    ok = await healthOk();
  } catch (error) {
    console.error("health read failed", error);
  }
  const res = new NextResponse(null, { status: ok ? 200 : 503 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
