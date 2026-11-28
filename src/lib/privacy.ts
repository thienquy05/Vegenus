// P1 Privacy & cookies (T3.2c; privacy design §2, §3.4): fixed text, kind D, the same on every copy, naming no one
// (§3.3). Approved on the P1 boards; the storage names follow the code (§2). [en, vi] pairs.
export type Pair = readonly [en: string, vi: string];

// The notice version and its date. The database requires this version with each wish (privacy_notice_version());
// a change that needs new consent bumps both, in a new migration.
export const PRIVACY = { version: 1, updated: "2026-11-27" } as const;

// The guest's saved settings on the device (the table's row; guest-app writes it, /privacy reads its language).
export const PREFS_KEY = "vegenus_prefs";

export const NOTICE = {
  title: ["Privacy & cookies", "Quyền riêng tư & cookie"],
  updated: ["Last updated {date}", "Cập nhật lần cuối {date}"],
  contents: ["Contents", "Nội dung"],
  header: ["Privacy", "Quyền riêng tư"],
  back: ["Back", "Quay lại"],
  sections: [
    {
      heading: ["Who we are", "Chúng tôi là ai"],
      table: false,
      blocks: [
        [
          "This is a personal, non-commercial page made by the couple who run it, for family and friends.",
          "Đây là trang cá nhân, phi thương mại do cặp đôi quản lý trang này tạo cho gia đình và bạn bè.",
        ],
      ],
    },
    {
      heading: ["What we collect", "Chúng tôi thu thập gì"],
      table: false,
      blocks: [
        [
          "For a wish, we collect the name you type, your message, language, time and consent. For a Member account, we collect your email, display name, password and email choices. Our sign-in provider stores your password in a scrambled form.",
          "Với lời chúc, chúng tôi thu thập tên bạn nhập, nội dung, ngôn ngữ, thời gian và sự đồng ý của bạn. Với tài khoản Thành viên, chúng tôi thu thập email, tên hiển thị, mật khẩu và lựa chọn nhận email. Nhà cung cấp đăng nhập lưu mật khẩu dưới dạng đã mã hóa.",
        ],
        [
          "For email updates, we collect your email, language and consent. We keep a scrambled code made from your network address and a random device ID for 24 hours, only to stop spam and code guessing. We also store what the couple uploads about themselves.",
          "Để gửi tin cập nhật qua email, chúng tôi thu thập email, ngôn ngữ và sự đồng ý của bạn. Chúng tôi giữ một mã đã mã hóa từ địa chỉ mạng và một mã thiết bị ngẫu nhiên trong 24 giờ, chỉ để chặn spam và dò mã. Chúng tôi cũng lưu nội dung cặp đôi tải lên về chính họ.",
        ],
        [
          "We never ask for your birthday, location, contacts or photos.",
          "Chúng tôi không bao giờ yêu cầu ngày sinh, vị trí, danh bạ hoặc ảnh của bạn.",
        ],
      ],
    },
    {
      heading: ["Why", "Vì sao"],
      table: false,
      blocks: [
        [
          "We use this data to show the page, publish wishes after approval, send email you asked for, stop spam and keep the page secure. Nothing is sold, used for ads or used to build a profile of you.",
          "Chúng tôi dùng dữ liệu để hiển thị trang, đăng lời chúc sau khi duyệt, gửi email bạn yêu cầu, chặn spam và bảo vệ trang. Không có dữ liệu nào được bán, dùng cho quảng cáo hoặc lập hồ sơ về bạn.",
        ],
      ],
    },
    {
      heading: ["Cookies and storage", "Cookie và lưu trữ"],
      table: true,
      blocks: [
        [
          "We don't use analytics or advertising cookies, so there is nothing to accept or refuse. If that changes, we will ask first.",
          "Chúng tôi không dùng cookie phân tích hoặc quảng cáo, nên không có gì cần chấp nhận hay từ chối. Nếu điều đó thay đổi, chúng tôi sẽ hỏi trước.",
        ],
        [
          "We don't track you across sites, so a Do Not Track signal changes nothing here.",
          "Chúng tôi không theo dõi bạn trên các trang khác, nên tín hiệu Do Not Track không làm thay đổi điều gì ở đây.",
        ],
        [
          "We do not use analytics, advertising, social widgets, session recordings or fingerprinting. Fonts and scripts are not loaded from other sites: the page uses your device's own fonts.",
          "Chúng tôi không dùng công cụ phân tích, quảng cáo, tiện ích mạng xã hội, ghi lại phiên truy cập hoặc nhận dạng thiết bị bằng dấu vân tay. Phông chữ và mã lệnh không được tải từ trang khác: trang dùng phông chữ có sẵn trên thiết bị của bạn.",
        ],
      ],
    },
    {
      heading: ["Who sees it", "Ai thấy thông tin"],
      table: false,
      blocks: [
        [
          "Guests see only approved wishes: the name and message. The couple sees pending wishes, Members and subscribers. Services run the site on our behalf: Vercel for hosting; Supabase for the database, sign-in and files; Resend for email, once email starts.",
          "Khách chỉ thấy tên và nội dung lời chúc đã duyệt. Cặp đôi thấy lời chúc chờ duyệt, Thành viên và người đăng ký email. Các dịch vụ vận hành trang thay chúng tôi gồm Vercel để lưu trữ trang; Supabase cho cơ sở dữ liệu, đăng nhập và tệp; Resend cho email, khi tính năng email bắt đầu hoạt động.",
        ],
        [
          "Their servers may be outside Vietnam. Nobody else sees the data unless the law requires it.",
          "Máy chủ của các dịch vụ này có thể nằm ngoài Việt Nam. Không ai khác được xem dữ liệu, trừ khi pháp luật yêu cầu.",
        ],
      ],
    },
    {
      heading: ["How long", "Lưu bao lâu"],
      table: false,
      blocks: [
        [
          "Approved and pending wishes stay until the couple deletes them or you ask us to delete them. Rejected wishes stay for 30 days. Spam-protection codes and unconfirmed email-updates sign-ups stay for 24 hours.",
          "Lời chúc đã duyệt và chờ duyệt được lưu đến khi cặp đôi xóa hoặc bạn yêu cầu xóa. Lời chúc bị từ chối được lưu 30 ngày. Mã chống spam và đăng ký nhận tin chưa xác nhận được lưu 24 giờ.",
        ],
        [
          "Unfinished Member sign-ups stay for at most 30 minutes, or until a half-finished account is cleaned up. Unsubscribed addresses stay for 30 days. After that, only a scrambled code stays so we do not add you again by mistake. Email records stay for 90 days, without the address.",
          "Đăng ký Thành viên chưa hoàn tất được lưu tối đa 30 phút, hoặc đến khi tài khoản tạo dở được dọn dẹp. Địa chỉ đã hủy đăng ký được lưu 30 ngày. Sau đó chỉ giữ mã đã mã hóa để tránh thêm lại bạn do nhầm lẫn. Nhật ký email được lưu 90 ngày, không kèm địa chỉ.",
        ],
        [
          "Of a deleted page's public address, only a scrambled code stays. It can confirm an address someone already knows, but it cannot list or reveal any address, so that address can never open someone else's page.",
          "Với địa chỉ công khai của trang đã xóa, chỉ giữ lại một mã đã mã hóa từ địa chỉ đó. Mã này có thể xác nhận một địa chỉ mà ai đó đã biết, nhưng không thể liệt kê hay tiết lộ địa chỉ nào, nên địa chỉ đó không bao giờ mở được trang của người khác.",
        ],
        [
          "Hosting and database logs stay for at most 30 days where the service lets us set this, and never more than 90 days.",
          "Nhật ký lưu trữ trang và cơ sở dữ liệu được giữ tối đa 30 ngày khi dịch vụ cho phép cài đặt, và không bao giờ quá 90 ngày.",
        ],
        [
          "When the page is deleted, its content and accounts are removed at once. Files and sign-in records follow as soon as the cleanup job confirms them. The scrambled codes for unsubscribed addresses stay so those addresses are never emailed again.",
          "Khi trang bị xóa, nội dung và tài khoản của trang được xóa ngay. Tệp và bản ghi đăng nhập được xóa tiếp khi tác vụ dọn dẹp xác nhận. Mã đã mã hóa của địa chỉ hủy đăng ký được giữ lại để không gửi email đến các địa chỉ đó nữa.",
        ],
      ],
    },
    {
      heading: ["Your choices", "Quyền của bạn"],
      table: false,
      blocks: [
        [
          "You can ask to see, correct or delete what you sent, withdraw consent, or ask what we hold about you. Deleting a wish withdraws its consent. Every email has an unsubscribe link. Members can remove their account through the couple.",
          "Bạn có thể yêu cầu xem, sửa hoặc xóa nội dung đã gửi, rút lại sự đồng ý hoặc hỏi chúng tôi đang giữ thông tin gì về bạn. Xóa lời chúc là rút lại sự đồng ý cho lời chúc đó. Mỗi email đều có liên kết hủy đăng ký. Thành viên có thể nhờ cặp đôi xóa tài khoản.",
        ],
        [
          "Ask the couple who run this page. They answer within 30 days. Withdrawing consent does not undo what was lawfully done before. If something goes wrong with your data, we will tell you as the law requires.",
          "Hãy hỏi trực tiếp cặp đôi quản lý trang này. Họ trả lời trong 30 ngày. Việc rút lại sự đồng ý không hủy những gì đã được thực hiện hợp pháp trước đó. Nếu dữ liệu của bạn gặp sự cố, chúng tôi sẽ thông báo theo yêu cầu của pháp luật.",
        ],
      ],
    },
    {
      heading: ["Children", "Trẻ em"],
      table: false,
      blocks: [
        [
          "This page is not meant for children. If you are under 16, ask a parent or guardian before leaving a wish or an email. If we learn that a child under 13 sent something, we delete it.",
          "Trang này không dành cho trẻ em. Nếu dưới 16 tuổi, hãy hỏi cha mẹ hoặc người giám hộ trước khi gửi lời chúc hoặc email. Nếu biết trẻ dưới 13 tuổi đã gửi nội dung, chúng tôi sẽ xóa nội dung đó.",
        ],
      ],
    },
    {
      heading: ["Changes", "Thay đổi"],
      table: false,
      blocks: [
        [
          "The date at the top shows when this notice was last updated. If a change needs new consent, we will ask you again.",
          "Ngày ở đầu trang cho biết lần cập nhật gần nhất của thông báo này. Nếu thay đổi cần sự đồng ý mới, chúng tôi sẽ hỏi lại bạn.",
        ],
      ],
    },
  ],
  table: {
    caption: [
      "Cookies and browser storage",
      "Cookie và lưu trữ trong trình duyệt",
    ],
    head: [
      ["Name", "Tên"],
      ["Kind", "Loại"],
      ["Set by", "Được đặt bởi"],
      ["Why", "Lý do"],
      ["How long", "Thời hạn"],
      ["Needed?", "Có cần thiết?"],
    ],
    rows: [
      [
        ["vegenus_g", "vegenus_g"],
        [
          "Cookie, HttpOnly, Secure, SameSite=Lax",
          "Cookie, HttpOnly, Secure, SameSite=Lax",
        ],
        [
          "Our server, after a tag tap or QR scan.",
          "Máy chủ của chúng tôi, sau khi chạm thẻ hoặc quét QR.",
        ],
        [
          "Remembers the guest link so the page opens again without a new tap.",
          "Nhớ liên kết khách để mở lại trang mà không cần chạm thẻ lần nữa.",
        ],
        ["30 days.", "30 ngày."],
        [
          "Strictly necessary: the service the guest asked for.",
          "Rất cần thiết: dịch vụ khách đã yêu cầu.",
        ],
      ],
      [
        ["vegenus_d", "vegenus_d"],
        [
          "Cookie, HttpOnly, Secure, SameSite=Lax",
          "Cookie, HttpOnly, Secure, SameSite=Lax",
        ],
        [
          "Our server, at the token exchange or when a wish is sent or limited.",
          "Máy chủ của chúng tôi, khi đổi mã truy cập hoặc khi một lời chúc được gửi hay bị giới hạn.",
        ],
        [
          "A random ID only for the spam limit: 3 wishes per device per 24 hours. It identifies nothing outside this site.",
          "Mã ngẫu nhiên chỉ để giới hạn spam: 3 lời chúc mỗi thiết bị trong 24 giờ. Mã không nhận dạng gì ngoài trang này.",
        ],
        ["24 hours from its last use.", "24 giờ kể từ lần dùng cuối."],
        ["Strictly necessary: security.", "Rất cần thiết: bảo mật."],
      ],
      [
        ["sb-…-auth-token (owner)", "sb-…-auth-token (chủ trang)"],
        [
          "Cookie, HttpOnly, Secure, SameSite=Lax",
          "Cookie, HttpOnly, Secure, SameSite=Lax",
        ],
        [
          "Supabase Auth, through our server.",
          "Supabase Auth, qua máy chủ của chúng tôi.",
        ],
        ["Keeps the couple signed in.", "Giữ cặp đôi đăng nhập."],
        [
          "Until the browser closes.",
          "Đến khi đóng trình duyệt.",
        ],
        [
          "Strictly necessary: the couple's sign-in.",
          "Rất cần thiết: đăng nhập của cặp đôi.",
        ],
      ],
      [
        ["sb-…-auth-token.0, .1 …", "sb-…-auth-token.0, .1 …"],
        [
          "Cookie, HttpOnly, Secure, SameSite=Lax",
          "Cookie, HttpOnly, Secure, SameSite=Lax",
        ],
        [
          "Supabase Auth, when a session is too large for one cookie.",
          "Supabase Auth, khi phiên quá lớn cho một cookie.",
        ],
        [
          "Parts of the same sign-in cookie.",
          "Các phần của cùng một cookie đăng nhập.",
        ],
        [
          "Same lifetime as the sign-in cookie they split.",
          "Cùng thời hạn với cookie đăng nhập được chia nhỏ.",
        ],
        [
          "Strictly necessary: the couple's sign-in.",
          "Rất cần thiết: đăng nhập của cặp đôi.",
        ],
      ],
      [
        ["vegenus_prefs (local storage)", "vegenus_prefs (lưu trữ cục bộ)"],
        [
          "Browser storage, never sent to a server",
          "Lưu trong trình duyệt, không gửi đến máy chủ",
        ],
        ["The page.", "Trang này."],
        [
          "Language, theme, reduce motion and menu corner.",
          "Ngôn ngữ, giao diện, giảm chuyển động và góc menu.",
        ],
        [
          "Until cleared in the browser.",
          "Đến khi xóa trong trình duyệt.",
        ],
        [
          "Strictly necessary: preferences the visitor sets.",
          "Rất cần thiết: lựa chọn khách cài đặt.",
        ],
      ],
      [
        ["Guest link in memory", "Liên kết khách trong bộ nhớ"],
        ["Page memory only", "Chỉ trong bộ nhớ trang"],
        [
          "The page, when cookies are blocked.",
          "Trang này, khi cookie bị chặn.",
        ],
        ["Lets that one visit work.", "Cho phép lần truy cập đó hoạt động."],
        ["Until the tab closes.", "Đến khi đóng thẻ trình duyệt."],
        ["Strictly necessary.", "Rất cần thiết."],
      ],
      [
        ["Guest link in the address bar", "Liên kết khách trên thanh địa chỉ"],
        [
          "The #… part of the URL, left only when cookies are blocked.",
          "Phần #… của URL, chỉ giữ khi cookie bị chặn.",
        ],
        ["The browser.", "Trình duyệt."],
        [
          "Lets a reload or “Open in browser” work.",
          "Cho phép tải lại hoặc “Mở trong trình duyệt” hoạt động.",
        ],
        [
          "As long as the browser keeps the address in history or restores the tab. The browser controls this, not us.",
          "Đến khi trình duyệt không còn giữ địa chỉ trong lịch sử hoặc khôi phục thẻ. Trình duyệt quyết định điều này, không phải chúng tôi.",
        ],
        ["Strictly necessary.", "Rất cần thiết."],
      ],
    ],
  },
} as const;
