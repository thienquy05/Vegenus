// The one safe zone formatter for Share, Usage, Home and the counter (owner UI O19, T2.8). A saved zone the browser
// rejects formats in UTC with a visible "(UTC)" label; the saved identifier is left as it is (only Settings repairs it).
export function safeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return { zone, utc: false };
  } catch {
    return { zone: "UTC", utc: true };
  }
}

export const zoneKnown = (zone: string) => !safeZone(zone).utc;

// shortcut: the browser's own zone list (ICU names) plus UTC; the database checks the name again (O3 and O19)
export const offeredZones = () => {
  try {
    return [...new Set([...Intl.supportedValuesOf("timeZone"), "UTC"])];
  } catch {
    return ["UTC"];
  }
};

export function zoneFormat(iso: string, timeZone: string, lang: "en" | "vi", options: Intl.DateTimeFormatOptions) {
  const { zone, utc } = safeZone(timeZone);
  const text = new Intl.DateTimeFormat(lang, { ...options, timeZone: zone }).format(new Date(iso));
  return utc ? `${text} (UTC)` : text;
}
