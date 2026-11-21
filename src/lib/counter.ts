// The days-together counter (E14; design 3 §3.3, Q44): the start date (YYYY-MM-DD) is day 1, counted in the page's
// time zone, never the server's or the guest's. null before the start date has begun there: no counter.
export function daysTogether(startDate: string, timeZone: string, now = new Date()): number | null {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const n = (type: string) => Number(part.find((p) => p.type === type)!.value);
  // Both dates as UTC midnights, so the difference is whole days whatever the zone's daylight saving does.
  const days = (Date.UTC(n("year"), n("month") - 1, n("day")) - Date.parse(startDate)) / 86_400_000;
  return days < 0 ? null : days + 1;
}
