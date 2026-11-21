import { expect, test } from "vitest";
import { daysTogether } from "./counter";

// E14 (design 3 §3.3, Q44): the start date is day 1; before it has begun in the page's time zone there is no
// counter; today is the page's date, never the server's or the guest's.
const at = (iso: string) => new Date(iso);

test("the start date is day 1 and the next day is day 2", () => {
  expect(daysTogether("2026-11-21", "UTC", at("2026-11-21T00:00:00Z"))).toBe(1);
  expect(daysTogether("2026-11-21", "UTC", at("2026-11-21T23:59:59Z"))).toBe(1);
  expect(daysTogether("2026-11-21", "UTC", at("2026-11-22T00:00:00Z"))).toBe(2);
});

test("before the start date there is no counter", () => {
  expect(daysTogether("2026-11-22", "UTC", at("2026-11-21T23:59:59Z"))).toBeNull();
  expect(daysTogether("2030-01-01", "UTC", at("2026-11-21T12:00:00Z"))).toBeNull();
});

test("today is the page's date: the same moment is day 1 east of the date line and no counter west of it", () => {
  const moment = at("2026-11-21T20:00:00Z");
  expect(daysTogether("2026-11-22", "Asia/Ho_Chi_Minh", moment)).toBe(1);
  expect(daysTogether("2026-11-22", "Pacific/Kiritimati", moment)).toBe(1);
  expect(daysTogether("2026-11-22", "UTC", moment)).toBeNull();
  expect(daysTogether("2026-11-22", "Pacific/Pago_Pago", moment)).toBeNull();
  expect(daysTogether("2026-11-21", "Pacific/Pago_Pago", moment)).toBe(1);
});

test("leap days count, and a 29 February start keeps counting in common years", () => {
  expect(daysTogether("2020-02-28", "UTC", at("2020-03-01T12:00:00Z"))).toBe(3);
  expect(daysTogether("2020-02-29", "UTC", at("2021-02-28T12:00:00Z"))).toBe(366);
  expect(daysTogether("2020-02-29", "UTC", at("2021-03-01T12:00:00Z"))).toBe(367);
});

test("a daylight-saving change does not shift the count", () => {
  expect(daysTogether("2026-03-07", "America/New_York", at("2026-03-09T12:00:00Z"))).toBe(3);
  expect(daysTogether("2026-10-24", "Europe/London", at("2026-10-26T12:00:00Z"))).toBe(3);
});

test("long spans count every day", () => {
  expect(daysTogether("2000-01-01", "UTC", at("2026-01-01T00:00:00Z"))).toBe(9498);
});
