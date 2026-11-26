// Fixed guest strings (T3.1b), [English, Vietnamese]: guest UI §6 common states, §7, §9 and theme system §2. The
// couple's own words come from the published wording (`copy` in guest_open), not from here.
export const COPY = {
  "menu.open": ["Open menu", "Mở menu"],
  "menu.close": ["Close menu", "Đóng menu"],
  "nav.home": ["Home", "Trang chủ"],
  "nav.memories": ["Memories", "Kỷ niệm"],
  "nav.guestbook": ["Wishes", "Lời chúc"],
  "nav.settings": ["Settings", "Cài đặt"],
  "state.loading": ["Loading…", "Đang tải…"],
  "state.readFailed": ["Couldn’t load this. Try again.", "Chưa tải được. Thử lại."],
  "state.retry": ["Try again", "Thử lại"],
  "state.offline": ["You’re offline. Reconnect to continue.", "Bạn đang ngoại tuyến. Kết nối lại để tiếp tục."],
  "state.gone": ["Access is no longer available.", "Quyền truy cập không còn hiệu lực."],
  "list.more": ["Load more", "Tải thêm"],
  "wishes.loaded": ["{n} more wishes", "Đã tải thêm {n} lời chúc"],
  "home.photo": ["Photo {n} of {total}", "Ảnh {n}/{total}"],
  "settings.close": ["Close", "Đóng"],
  "settings.language": ["Language", "Ngôn ngữ"],
  "settings.motion": ["Reduce motion", "Giảm chuyển động"],
  "settings.usingDevice": ["Using device setting", "Theo cài đặt thiết bị"],
  "settings.useDevice": ["Use device setting", "Dùng cài đặt thiết bị"],
  "settings.corner": ["Menu corner", "Góc menu"],
  "settings.left": ["Top left", "Trên trái"],
  "settings.right": ["Top right", "Trên phải"],
  "settings.saved": ["Saved on this device", "Lưu trên thiết bị này"],
  "settings.visitOnly": ["Applies to this visit only", "Chỉ áp dụng trong lần truy cập này"],
} as const;
export type CopyKey = keyof typeof COPY;
export type Lang = "en" | "vi";

export const say = (key: CopyKey, lang: Lang, vars: Record<string, string | number> = {}) =>
  Object.entries(vars).reduce<string>((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), COPY[key][lang === "en" ? 0 : 1]);

// Text with two languages (the wording, a note, a title, alt text): the shown language if it has text, else the
// other with its own `lang`, else nothing (owner UI "Guest Home states"; Q67 fallback in full with T3.3).
export function pickLang(lang: Lang, options: [Lang | null | undefined, string | null | undefined][]) {
  const found = options.find(([l, t]) => l === lang && t) ?? options.find(([l, t]) => l && t);
  return found ? { text: found[1] as string, lang: found[0] as Lang } : null;
}
