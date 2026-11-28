import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";
import { DEVICE_COOKIE, GUEST_COOKIE } from "./guest";
import { NOTICE, PREFS_KEY, PRIVACY } from "./privacy";

// T3.2c (privacy design §3.4, §8 test 6): the notice is fixed text in both languages; its version is the one the
// database requires with each wish, and its date belongs to that version.
const pairs = (value: unknown): (readonly [string, string])[] =>
  Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === "string")
    ? [value as unknown as readonly [string, string]]
    : Array.isArray(value) ? value.flatMap(pairs)
    : value && typeof value === "object" ? Object.values(value).flatMap(pairs)
    : [];

test("every notice string exists in English and Vietnamese", () => {
  const all = pairs(NOTICE);
  expect(all.length).toBeGreaterThan(80); // a sanity floor: the extraction did not drop the text
  for (const [en, vi] of all) {
    expect(en.trim()).not.toBe("");
    expect(vi.trim()).not.toBe("");
  }
  expect(NOTICE.sections).toHaveLength(9);
});

test("the notice version is the database's, and its date is a real past date", () => {
  const dir = "supabase/migrations";
  const latest = readdirSync(dir).sort().map((f) => readFileSync(`${dir}/${f}`, "utf8"))
    .filter((sql) => sql.includes("function public.privacy_notice_version()")).at(-1)!;
  expect(Number(/privacy_notice_version\(\) returns smallint[\s\S]*?select (\d+)::smallint/.exec(latest)?.[1])).toBe(PRIVACY.version);
  expect(PRIVACY.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(new Date(`${PRIVACY.updated}T00:00:00Z`).toISOString().slice(0, 10)).toBe(PRIVACY.updated);
});

test("How long names the scrambled code kept of a deleted page's public address (§3.4 item 6, Q159)", () => {
  const howLong = NOTICE.sections[5].blocks.flat().join(" ");
  // "only" bounds the address, not the page: the unsubscribe codes stay too; the notice's own word "scrambled code"
  // (Vietnamese "mã đã mã hóa"), since section 4 denies fingerprinting.
  expect(howLong).toMatch(/Of a deleted page's public address, only a scrambled code stays\./);
  expect(howLong).toMatch(/Với địa chỉ công khai của trang đã xóa, chỉ giữ lại một mã đã mã hóa từ địa chỉ đó\./);
  expect(howLong).not.toMatch(/fingerprint|dấu vân tay/);
});

test("the storage table names what the code sets (design §2: the final names come from the code)", () => {
  const names = NOTICE.table.rows.map((row) => row[0][0]);
  for (const name of [GUEST_COOKIE, DEVICE_COOKIE, PREFS_KEY]) expect(names.some((n) => n.startsWith(name))).toBe(true);
  expect(readFileSync("src/app/g/guest-app.tsx", "utf8")).toMatch(/localStorage\.setItem\(PREFS_KEY/); // the key the guest app writes
  expect(names.join(" ")).not.toMatch(/vegenus\.prefs|name to confirm/);
  // Owner, 2026-11-28: the table lists only what the site sets today; planned rows return with their features.
  expect(names).toEqual([GUEST_COOKIE, DEVICE_COOKIE, "sb-…-auth-token (owner)", "sb-…-auth-token.0, .1 …", `${PREFS_KEY} (local storage)`, "Guest link in memory", "Guest link in the address bar"]);
  const table = pairs(NOTICE.table).flat().join(" ");
  expect(table).not.toMatch(/Keep me signed in|Duy trì đăng nhập|invite|mã mời|intro|mở đầu|Settings|Cài đặt/);
  expect(pairs(NOTICE).flat().join(" ")).not.toMatch(/Phase \d|Giai đoạn|proposed name|tên đề xuất|will be confirmed|sẽ được xác nhận/);
});
