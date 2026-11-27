// Fixed guest strings (T3.1b), [English, Vietnamese]: guest UI §6 common states, §7, §9 and theme system §2. The
// couple's own words come from the published wording (`copy` in guest_open), not from here.
export const COPY = {
  "menu.open": ["Open menu", "Mở menu"],
  "menu.close": ["Close menu", "Đóng menu"],
  "nav.home": ["Home", "Trang chủ"],
  "nav.memories": ["Memories", "Kỷ niệm"],
  "nav.together": ["Together", "Bên nhau"],
  "nav.guestbook": ["Wishes", "Lời chúc"],
  "nav.settings": ["Settings", "Cài đặt"],
  "state.loading": ["Loading…", "Đang tải…"],
  "state.readFailed": ["Couldn’t load this. Try again.", "Chưa tải được. Thử lại."],
  "state.retry": ["Try again", "Thử lại"],
  "state.offline": ["You’re offline. Reconnect to continue.", "Bạn đang ngoại tuyến. Kết nối lại để tiếp tục."],
  "state.gone": ["Access is no longer available.", "Quyền truy cập không còn hiệu lực."],
  "list.more": ["Load more", "Tải thêm"],
  "wishes.loaded": ["{n} more wishes", "Đã tải thêm {n} lời chúc"],
  "together.one": ["1 place", "1 nơi"],
  "together.count": ["{n} places", "{n} nơi"],
  "together.search": ["Find one of our places", "Tìm một nơi của mình"],
  "together.noMatch": ["No place with that name.", "Không có nơi nào tên như vậy."],
  "together.prev": ["Previous place", "Nơi trước"],
  "together.next": ["Next place", "Nơi tiếp theo"],
  "detail.page": ["Page {n} of {total}", "Trang {n}/{total}"],
  "detail.prev": ["Previous page", "Trang trước"],
  "detail.next": ["Next page", "Trang sau"],
  "detail.contents": ["Contents", "Mục lục"],
  "detail.opening": ["Opening", "Mở đầu"],
  "detail.message": ["Message", "Lời nhắn"],
  "detail.photos": ["Photos", "Ảnh"],
  "detail.video": ["Video", "Video"],
  "detail.voice": ["Voice note", "Lời nhắn thoại"],
  "detail.playVoice": ["Play voice note", "Nghe lời nhắn"],
  "detail.playVideo": ["Play video", "Phát video"],
  "detail.transcript": ["Transcript", "Bản chép lời"],
  "detail.original": ["Shown in the original language.", "Hiển thị bằng ngôn ngữ gốc."],
  "detail.gone": ["This memory is no longer available.", "Kỷ niệm này không còn nữa."],
  "detail.back": ["Back to Memories", "Về Kỷ niệm"],
  "home.prev": ["Previous photo", "Ảnh trước"],
  "home.next": ["Next photo", "Ảnh tiếp theo"],
  "home.shortcuts": ["Sections", "Các mục"],
  "home.noPhotos": ["Photos will appear here once the owners add them.", "Ảnh sẽ xuất hiện ở đây khi chủ trang thêm vào."],
  "home.noNote": ["The owners have not added a welcome note yet.", "Chủ trang chưa thêm lời nhắn chào mừng."],
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
  "theme.title": ["Choose a theme", "Chọn giao diện"],
  "theme.legend": ["Theme", "Giao diện"],
  "theme.help": ["You can change your theme anytime in Settings.", "Bạn có thể đổi giao diện bất cứ lúc nào trong phần Cài đặt."],
  "theme.suggested": ["Suggested", "Được gợi ý"],
  "theme.skip": ["Not now", "Để sau"],
  "theme.continue": ["Continue", "Tiếp tục"],
  "theme.a_dreamy": ["A Dreamy", "A Mơ mộng"],
  "theme.b_cosmic": ["B Cosmic", "B Vũ trụ"],
  "theme.c_cozy": ["C Cozy", "C Ấm áp"],
  "theme.d_elegant": ["D Elegant", "D Thanh lịch"],
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
