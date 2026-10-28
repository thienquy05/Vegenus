# Guest UI design: sections, status and specifications

**Status:** v1.0 consolidation, 2026-10-26. This is the single guest-UI design document (it absorbed the earlier guest-screens notes and the Wishes, Leave a wish and Settings specifications). Documentation only; no application code. Rule 3: placeholders only.
**Where things live:** screen inventory and responsive matrix: [screens](vegenus_screens.md). Owner area: [owner UI](vegenus_owner_ui.md). Motion and signature entrances: [guest motion](vegenus_guest_motion.md). Themes, menu, tokens: [theme system](vegenus_theme_system.md). 3D and Zodiac scene: [3D approach](vegenus_3d_approach.md). Image prompts: [Codex image brief](vegenus_codex_image_brief.md). Logo: [assets/logo](../../assets/logo/README.md).
**Canvas:** "Theme Preview" on the owner's claude.ai account (not in Git). Boards were built by scratchpad generators that are not in the repo; the Wishes, Leave a wish, Settings and Owner generator is stored on the canvas as the asset `anni-gen-pages7-10.txt`. Decision comparison boards (Q71-Q74) are page 13.

## 1. Section status

| Section | Canvas page | Status (2026-10-27) | Specification |
|---|---|---|---|
| Home G1 | 1 | Approved 2026-10-24 (phone, tablet, laptop, four themes) | [screens](vegenus_screens.md) G1; [motion §4](vegenus_guest_motion.md#4-section-handoffs), [§10.2](vegenus_guest_motion.md#1022-section-signatures); PRD Q64 |
| Menu | 2 | Rule final: circular fan everywhere; phone flips the page, tablet and laptop blur it; label review open | [theme system §2](vegenus_theme_system.md); [motion §3](vegenus_guest_motion.md#3-menu-choreography) |
| Zodiac Z2 | 3 | Approved 2026-10-24 | [3D approach §5.1](vegenus_3d_approach.md), [theme system §6](vegenus_theme_system.md); tests in §5 below; PRD Q61-Q62 |
| Memories G2 | 4 | Approved; owner answered Q74 (2026-10-26): parallax and photo pan removed | progress 2026-10-24 "Memories v4" |
| Memory detail G3 | 5 | Album direction chosen; Codex review clean (round 7); Q66 limits open | [screens](vegenus_screens.md) G3; PRD Q66-Q68 |
| Together G4 | 6 | Approved v5.2, 2026-10-24; entrance proposed | PRD Q63; [motion §10.1](vegenus_guest_motion.md#101-together-signature-entrance--a-little-world-lands) |
| Wishes G5 | 7 | Generated 2026-10-26 (Codex lead design); Codex review done, most findings fixed, canvas version 95; owner review pending | §7 below |
| Leave a wish G6/G7 | 8 | Same, with the daily-limit notice (page 14) and example wording | §8 below |
| Settings G8 | 9 | Same, plus the language-not-set-up state; Claude's Playwright check of 72 boards found no page errors | §9 below |
| Owner area | 10 | Rebuilt; plain look (Q56). O18 Wording built at three sizes (canvas version 93-95, rendered check and some slots still open: editable wording §6); O16 specified here and in owner UI, **no boards yet** | [owner UI](vegenus_owner_ui.md) |
| Nav icons | 11 | Approved 2026-10-23 | [theme system §2](vegenus_theme_system.md) |
| Logo | 12 | Approved emblem; canvas page updated 2026-10-26 | [assets/logo](../../assets/logo/README.md); PRD Q60 |
| Decisions | 13 | Built, checked in Playwright and **answered by the owner 2026-10-26** (Q71-Q74); page 14 "Daily limit notice" boards (12) built for Q75 | PRD §12 |
| Sign in, invite code, updates G20–G26 | none | **Specified (§11), including the confirmation consent change; canvas boards not built**, so this design is not complete under the complete-designs rule | §11 below |

## 2. History: owner feedback of the 2026-10-23 round (superseded where later rounds say so)

| Area | Owner said | Done (all four themes) |
|---|---|---|
| G1 Home | "4 containers same as the menu is useless"; greet guests with photos; no "start the tour" button, let them explore | Section tiles removed. Under the names: a stack of 5 photos (tap the photo or the arrows; counter "n / 5", polite live region). Below: a welcome note signed by the couple (sample text). The page scrolls inside the phone (content 1180 px) |
| Menu open | Keep the idea, make the motion smoother when the page steps back | Page eases over 0.72 s (`cubic-bezier(.22,1,.36,1)`), slight extra tilt, dims a little, returns on the same curve. Items now fly back to the button on close (reverse stagger) instead of vanishing; nav is `visibility: hidden` and `aria-hidden` when closed. Reduced motion: unchanged rule, no tilt or fly-out |
| Menu button | "Looks like a ball, be creative" | A crescent glass moon with three stars; B ringed planet with an orbiting moon; C isometric toy block with a heart; D a bookmark ribbon hanging from the top edge with "&". Each morphs into a theme × when open. Owner area: plain round button, new motion |
| Zodiac | Galaxy/universe as the background, picture on top, more room for long text | Night sky is the whole page in every theme; galaxy and 12-sign ring scaled up behind; the two sign images float on top; the reading is a scrolling glass card (3 sample paragraphs) |
| G4 Together | A simple 3D map with photo pins that open a modal (place, date, time, note) | Illustrated made-up map (owner: not a real map) tilted in 3D; 4 photo pins stand on it; tap a pin or a chip under the map to open a sheet: photo, place, date · time, note, "see memories here", previous / next, close. Two buttons turn the map in 45° steps |
| Memories, G5, G6, G8 | "Seems okay" / "looks okay" | Only the new button and motion |

## 3. Decisions that touched approved designs (Q61-Q65, all answered 2026-10-24; see PRD §12)
- **Text over the 3D box (Q61).** Design 4 §3 decor rule and design 5 §4.2 say text never sits inside a View box. The new Zodiac puts the sign art and the reading card on top of the galaxy. Proposal: allowed only for Zodiac, text always inside a card at 72 % night glass with blur, contrast checked against the brightest frame of the scene.
- **Generated art (Q62).** Design 5 principle 4 is "procedural before assets" with 0 texture bytes in Page mode. Owner wants Codex images instead of code-drawn shapes. Proposal: images become the Page-mode art within the byte targets in the brief; procedural/SVG stays as Static fallback.
- **Map positions (Q63).** The map is a drawing, not geography, so a pin stores x/y on the drawing, never coordinates. Guests never receive a real location from the map.
- **Home photos and note (Q64).** Which photos feed the stack and who writes the note.
- **"Circular menu" (Q65).** Only the button was redesigned; the round item bubbles are unchanged (owner agreed, 2026-10-24).

## 4. References looked at (21st.dev, owner suggestion)
- Draggable Photo Stack by @laziekiki (MIT): swipe physics, fan view, shuffle. Reference for the real G1 stack (drag to throw, not only tap). https://21st.dev/@laziekiki/components/draggable-photo-stack
- mapcn MarkerTooltip and Expand Map: real-map components (MapLibre based), useful only for the pin and expand pattern since the owner chose an illustrated map. https://21st.dev/@mapcn/components/mapcn-marker-tooltip , https://21st.dev/@jatin-yadav05/components/expand-map
- Nothing was installed or copied (rule 1). Any template that ships needs its licence checked and an install approval.

## 5. Tests to write first (approved sections)
1. G1: tapping the photo or "next" advances the counter and wraps [N] → 1; "previous" wraps 1 → [N] (N = the owner's 3-7 photos, Q64; test with 3 and 7); the counter is announced; reduced motion shows no fly-out.
2. Menu: after close, no menu item is focusable (Tab skips them) and the nav is `aria-hidden`; open → close → open leaves no item stuck mid-animation.
3. Together: every pin has a DOM chip equivalent; opening a pin moves focus to the sheet heading; Esc and × close it and return focus to the pin; previous / next wrap.
4. Zodiac (v4, 2026-10-24): the reading is six message tiles (real `<button>`s, ≥ 44 px) that each open one message; tile and dialog text keep ≥ 4.5:1 contrast over the sky; the sign images keep alt text; on a 390 × 844 phone all six tiles are visible without scrolling, laid out in flow (no absolute positions), with equal gaps.
5. Zodiac message dialog: opening moves focus into the dialog (its heading or close button), the page behind is `inert`, Tab stays inside, Escape and × close it, focus returns to the tile that opened it; previous / next keep focus in the dialog; the page-turn or unroll effect (v4.3, owner's pick) never moves focus or hides the buttons; swipe left / right turns the page and the buttons do the same for keyboard and switch users; reduced motion shows the page without the flip, roll or slide. The circular menu keeps design 4 test 12 (inert page, focus, Escape, close on selection, no tilt under reduced motion).

## 6. Shared shell, surfaces and state contract (Wishes, Leave a wish, Settings)

These specifications inherit approved Home backgrounds, Zodiac’s full night sky, Memories’ size-specific layouts, the G3 album and Together v5.2. They do not add a second navigation system.

- **Navigation:** circular fan top-left; phone page flips aside, tablet/laptop page blurs in place. G8 mirrors the corner. Use the labelled list fallback whenever the fan cannot fit.
- **Overlay edge:** phone bottom sheet; tablet/laptop centered dialog. G6 and G8 use this same edge. Phone sheets may become full-height below the safe area for keyboards or enlarged text.
- **Q68:** while any overlay is open, the menu button is hidden and unfocusable. Background is inert; Escape and a visible ≥44 px Close control work; focus returns to the invoker.
- **Type:** existing theme fonts and tokens; 16 px minimum inputs/body, 1.5 body line height. Titles use the shared scale and expand naturally for Vietnamese marks.
- **Targets:** ≥44 × 44 px, 8 px minimum separation; 48 px primary buttons; menu remains 56 px.
- **Reflow:** 16/24/32 px phone/tablet/laptop gutters unless a narrower centered form applies. At 320 px or 200% text, use one column, wrapped actions and natural vertical scrolling. Never require horizontal page scrolling.
- **Content:** long names and URLs wrap; no essential message truncation. Decorative cards may grow. Reading order follows visual order.
- **Guest preview:** owner/partner can select A–D in a scoped preview. The neutral owner shell remains unchanged. Label “Guest preview / Xem như khách”; previews cannot submit wishes or modify public state.

### Common states and bilingual copy

Apply these states to every section below, with screen-specific substitutions.

| State | Behavior | English / Vietnamese |
|---|---|---|
| Loading | Stable reserved surface, readable status; static placeholders, no shimmer | “Loading…” / “Đang tải…” |
| Empty | Explain the missing content and show only permitted actions | “Nothing here yet.” / “Chưa có nội dung.” |
| Read failure | Inline Retry; preserve surrounding usable controls | “Couldn’t load this. Try again.” / “Chưa tải được. Thử lại.” |
| Write failure | Keep input; never show success prematurely | “Not saved. Your changes are still here.” / “Chưa lưu được. Nội dung bạn sửa vẫn còn ở đây.” |
| Rate-limited | Show server-provided wait; no automatic retry or per-second announcement | “Try again in [WAIT].” / “Thử lại sau [WAIT].” |
| Offline | Retain already-loaded authorized content and in-memory input; no new persistent content cache | “You’re offline. Reconnect to continue.” / “Bạn đang ngoại tuyến. Kết nối lại để tiếp tục.” |
| Permission lost | Remove protected content immediately; use neutral access/login state | “Access is no longer available.” / “Quyền truy cập không còn hiệu lực.” |
| Missing translation | Show original, mark its language, retain settings choice | “Shown in the original language.” / “Đang hiển thị ngôn ngữ gốc.” |

Read-only screens do not invent posting quotas. If a server throttles reads, use the common wait state. Local Settings changes have no network rate limit.

## 7. Wishes — G5

**Purpose:** a calm, generous collection of approved wishes. Guests read newest first. Anyone who can see the page can compose: a token holder, a registered guest, or (Q78) a visitor with no credential on a Published page. On a Token-only or Private page without access the page itself is not shown (G-E1), so there is no form. Owner and partner see exactly the approved guest collection in preview; moderation lives in O7.

### Layout

| Size | Arrangement |
|---|---|
| Phone | 88 px bar; title and short introduction; full-width 48 px “Leave a wish” button; one 358 px-wide card column with 16 px gaps; Load more at the end. Button scrolls with content. |
| Tablet | 24 px gutters; heading/action row; centered list up to 720 px wide. Cards remain one reading column, with roomier 24 px padding. |
| Laptop | Centered 1120 px region: 280 px introduction/action column, 32 px gap, 808 px message column. The introduction may remain sticky below the bar while the document scrolls. |
| Narrow/enlarged text | All content becomes one column; action wraps below heading; no masonry reading-order ambiguity. |

Each card contains `[DISPLAY_NAME]`, `[WISH_TEXT]` and optional existing display metadata. Show the complete 500-character message; avoid a second dialog merely to read a wish.

**Theme treatments:** A dark glass letter cards with an ornamental ribbon outside the text; B navy cards with small constellation corner brackets; C white paper notes with stitched margins and handwriting restricted to short labels; D ivory editorial entries divided by hairlines. Use body fonts for messages in every theme.

| State | Guest treatment | Owner/partner treatment |
|---|---|---|
| No approved wishes | “Be the first to leave a wish.” / “Hãy gửi lời chúc đầu tiên.” Eligible guests get the CTA. | Preview stays empty even if O7 has pending entries. |
| Pending | Never returned in G5, including the sender’s own wish: Q34d. | Visible only in O7 with “Pending / Chờ duyệt.” |
| Approved | Appears in normal newest-first order on an authorized refresh/load. | “Approved / Đã duyệt”; guest preview matches. |
| Rejected | Absent; no rejection marker or private status query. | Visible only in moderation history if provided; retention 30 days, Q45. |
| No access (Token-only page, no token) | The “tap the tag” notice (G-E1) instead of this page: “Tap the tag or scan the QR code to see this page.” / “Chạm thẻ hoặc quét mã QR để xem trang này.” No wishes list and no form (E47). On a Published page every visitor sees the list and the CTA, Q78. | Preview shows this state when Token-only is selected. |
| More-load failure | Keep existing wishes; replace only the loading footer with Retry. | Same preview behavior. |

Use semantic list items/articles, not a carousel. Load more keeps focus on its button and politely announces “[N] more wishes / Đã tải thêm [N] lời chúc.” No automatic live insertion while somebody is reading.

Links: G6 from the CTA; G8 for language; menu to Home, Zodiac, Memories and Together. Do not restore the superseded Home “latest wish” strip.

## 8. Leave a wish and confirmation — G6/G7

**Purpose:** a short, trusted submission flow. No account is required: a token guest, a registered guest and (on a Published page) a visitor with no credential can all send a wish, rate-limited (Q78). The sent state carries the optional updates card (§11, G26). Owner preview demonstrates the form with placeholders and a clearly labelled sample confirmation.

### Layout and fields

Phone: bottom sheet, full available width, 16 px padding, 56 px heading/Close row; name input 48 px high; message textarea initially 160 px high; counters, privacy note and 48 px Send button in natural flow. Tablet: centered 560 px dialog. Laptop: centered 600 px dialog. Maximum height follows the visible viewport; the interior scrolls without hiding errors behind the keyboard.

Fields:

- **“Display name / Tên hiển thị”**, required, Q34c cap **40**.
- **“Your wish / Lời chúc của bạn”**, required, Q34c cap **500**.
- Visible counters `[N]/40` and `[N]/500`; describe counters to fields without announcing every keystroke.
- Plain text only; no attachments, formatting toolbar or guest photo upload.
- No language switch outside G8, following Q67. Submission language metadata initially follows G8; arbitrary message text is not translated automatically.

Privacy copy:

> **EN:** “We briefly check your network address to prevent spam and never store the address.”
> **VI:** “Chúng tôi kiểm tra nhanh địa chỉ mạng để ngăn spam và không lưu địa chỉ này.”

### State and submission behavior

| State | Required presentation |
|---|---|
| Blank | Persistent labels and short prompts; Send validates rather than silently doing nothing. |
| Invalid | Inline message: “Enter a display name.” / “Nhập tên hiển thị.”; “Write a wish.” / “Viết lời chúc.” Focus the first invalid field after submission. |
| Over limit | Preserve the text and explain the relevant cap; never silently truncate pasted text. Unicode counting must match server validation. |
| Sending | “Sending…” / “Đang gửi…”; prevent duplicate submission. Close/navigation remain available with appropriate draft protection. |
| Rate-limited | Q75 (answered) and Q78: **3 wishes per device per rolling 24 hours** (the window starts at the first wish and ends 24 hours later); a per-IP limit that is **higher** because a venue shares one address (20 per rolling 24 hours, Q78); **50 per page per day**. No rule text on the form: a notification pop-up ("Daily limit notice" boards) gives the exact come-back time. Use returned `[WAIT]` from the latest-expiring exceeded limit, including page-day exhaustion. |
| Shared-network block | “People on the same Wi-Fi may share this limit.” / “Những người dùng chung Wi-Fi có thể dùng chung giới hạn này.” |
| Offline | Keep the draft in memory; disable sending with explanation. No automatic upload after reconnection. |
| Uncertain response | “We couldn’t confirm whether it was sent.” / “Chưa thể xác nhận lời chúc đã được gửi.” Do not silently resend. The form keeps one `submission_id` per composed wish; if the person taps Send again, the server returns the first result and counts it once (data model §3.9, Q73). |
| Confirmed success | Replace the form with G7 only after the server accepts the pending entry. |

G7 copy:

> **“Wish sent / Đã gửi lời chúc”**
> “Thank you. Your wish will appear after [OWNER] approves it.”
> “Cảm ơn bạn. Lời chúc sẽ hiển thị sau khi [OWNER] duyệt.”

Show **“Back to wishes / Về lời chúc”**. Do not repeat the pending message body, create a public pending card, promise approval or imply delivery by email.

A–D use the envelope/seal family from [motion §10.2.2](vegenus_guest_motion.md#1022-section-signatures). Confirmation remains fully readable before its decoration finishes. On success, focus the G7 heading; avoid a duplicate live-region announcement of the same heading.

Closing a nonempty unsent form offers **“Keep writing / Viết tiếp”** and **“Discard / Bỏ nội dung”**. No draft is written to localStorage by this proposal. A deliberate Settings visit may retain the draft in memory and return to it; Q67 must not make language changes destroy input.

## 9. Settings — G8

**Purpose:** personal presentation controls, remembered on this device. Guests cannot change the couple’s theme, visibility or published content here. Owner/partner guest-preview settings affect the preview only; account language belongs to O12.

### Layout

Phone: bottom sheet, 16 px padding, heading/Close row, vertically stacked groups. Tablet: centered 560 px dialog. Laptop: centered 600 px dialog. Rows have a minimum 56 px height and grow for labels/help. At enlarged text, radio choices stack; the whole panel scrolls.

Use the current theme’s surface and edge treatment, with a still background. A–D differ through existing type, surface, radius and divider tokens, not different control placement.

| Group | English / Vietnamese | Behavior |
|---|---|---|
| Language | “Language / Ngôn ngữ”; “English”; “Tiếng Việt” | Immediate UI update, preserve focus and draft. Q67: the only guest language-switch location. |
| Mode | “View / Chế độ xem”; “Page / Trang”, “Static / Tĩnh”, “World / Thế giới” | Show World only once available. Keep design 5’s capability and downgrade rules. |
| Motion | “Reduce motion / Giảm chuyển động” | Starts from system preference unless explicitly set. G8 choice overrides system; effective On forces Static. |
| Preference origin | “Using device setting / Theo cài đặt thiết bị”; “Use device setting / Dùng cài đặt thiết bị” | Proposed reset clears the explicit motion override without changing intro history. |
| Intros | “Intro animations / Hiệu ứng mở đầu”; “Always / Luôn bật”, “First time only / Chỉ lần đầu”, “Off / Tắt” | Policy in [motion §10.1.4](vegenus_guest_motion.md#1014-replay-policy); retain preference while Static suppresses its execution. |
| Menu | “Menu corner / Góc menu”; “Top left / Trên trái”, “Top right / Trên phải” | Mirror the closed control and inward-facing fan after closing Settings. |
| Tour | “Replay tour / Xem lại hướng dẫn” | Close G8, start G9 at a stable destination; do not reset intro flags. |
| Device note | “Saved on this device / Lưu trên thiết bị này” | If persistence fails: “Applies to this visit only / Chỉ áp dụng trong lần truy cập này.” |

No Save button: changes apply immediately. Use grouped native radio/switch semantics and explicit labels. Focus begins at the first control, as the existing menu contract requires.

Loading preferences uses system motion settings and a stable shell; never briefly animate before discovering Reduce motion. Local controls remain available offline. Unsupported 3D and runtime downgrade have explanatory text, not a silent disabled option. No network rate limit applies.

**Empty state:** not applicable; settings always have effective defaults. **Long text:** helper copy wraps beneath its control. **Error:** persistence failure is a small status, not a blocking modal.

## 10. Open decisions from the Codex lead design and where they live

| Codex id | Question | Lives in |
|---|---|---|
| D1, D2, D9 | Together entrance: option 1 chosen, per-theme fall styles designed (motion §10.1.3), replay policy default "first time only" confirmed (2026-10-26) | PRD Q71; [motion §10.1.4](vegenus_guest_motion.md#1014-replay-policy) |
| D3 | Elegant gold hairline: accepted | PRD Q72 |
| D4, D5, D6 | Character counting, stored language, retry de-duplication: defaults adopted | PRD Q73; §8 |
| D7 | Album quota limits | PRD Q66 |
| D8 | Memories parallax and Ken Burns: removed | PRD Q74 |
| D10 | Email readiness and reminder defaults | PRD Q37; [owner UI](vegenus_owner_ui.md) |
| D11 | Sign-in redesign: no gate, invite codes, email updates | PRD Q77-Q81; §11; [token flow §10](vegenus_token_flow.md) |

## 11. Sign in, invite code and email updates — G20–G26 (owner decision 2026-10-26, Q77-Q81)

**Purpose:** optional doors that never block reading. There is **no entry gate** (Q77): a tap on the tag, or a visit with no token, goes straight to the page. Everything below is reached from the menu item “Sign in / Đăng nhập”, a row in Settings (G8), or the card shown after a wish is sent. Q37 (a verified sending domain) must exist before any mail leaves; until then every screen that needs mail shows the “email not available” state. Placeholders only (rule 3): `[EMAIL]`, `[CODE]`.

### 11.1 Layout, themes and shared rules

- **Container:** the shared sheet from §6/§9. Phone: bottom sheet, 16 px padding, 56 px heading/Close row, 48 px inputs and 48 px primary button, body scrolls above the keyboard, errors never hide behind it. Tablet: centered 560 px dialog. Laptop: centered 600 px dialog. At 320 px width and 200 % text everything stacks and the panel scrolls.
- **Themes:** these screens are sheets over a page whose theme is known, so they use it. Opened as a standalone route (email link, `/signin`, password reset, unsubscribe landing) they use the neutral set until `account_open` returns the theme ([screens](vegenus_screens.md), theme system §2). A–D differ only through the existing type, surface, radius, divider and edge tokens (A glass card, B navy card with constellation brackets, C paper note with stitched margin, D ivory sheet with hairlines), never through control placement. Body fonts in every theme; the display face only for the heading. Backgrounds stay still behind the sheet.
- **Order of actions:** primary action first and visually strongest, one secondary text action, Close always in the top-right of the heading row. No marketing copy, no countdowns.
- **Autofill and input:** email `autocomplete="email"`, password `new-password` (create) or `current-password` (sign in), code field `autocomplete="off"`, `autocapitalize="characters"`, spell-check off, accepts lower case, spaces and a dash and normalises them. “Show password” toggle on every password field. A password manager must work.
- **Sessions:** account session is an HttpOnly cookie. “Remember me” is not offered; the session lasts as long as the vendor default and ends on sign-out.

### 11.2 Screens

| ID | Screen | Content (English / Vietnamese) and behaviour |
|---|---|---|
| **G20** | Entry points | Menu item “Sign in / Đăng nhập” (signed out) or “Account / Tài khoản” (signed in). Settings row group “Account / Tài khoản”: “Sign in / Đăng nhập”, “I have an invite code / Tôi có mã mời”, “Get updates by email / Nhận tin qua email”. Never a pop-up on arrival. If a visitor dismisses the invite card after a wish, remember it on this device and do not show it again. |
| **G21** | Invite code | Heading “Enter your invite code / Nhập mã mời”. Field “Invite code / Mã mời”, help “Each code works once. Ask the couple if you need one. / Mỗi mã chỉ dùng một lần. Hãy hỏi cặp đôi nếu bạn cần mã.” Primary “Continue / Tiếp tục”. Text action “Back / Quay lại”. |
| **G22** | Create account | Heading “Create your account / Tạo tài khoản”. Fields: “Email / Email”, “Display name (optional) / Tên hiển thị (không bắt buộc)”. Password and updates consent are chosen by the mailbox holder on the confirmation page (G24). Primary “Continue / Tiếp tục”. The code is reserved for at most 30 minutes, ending sooner if the invite expires (design 1 §10.3); sending again from G23 reuses the reservation. |
| **G23** | Check your email | “Check your email / Kiểm tra email của bạn”. “We sent a link to [EMAIL]. It works until [TIME]. / Chúng tôi đã gửi liên kết tới [EMAIL]. Liên kết có hiệu lực đến [TIME].” ([TIME] is the original reservation expiry, which a resend does not extend; after it, “Start again with your code”.) Actions: “Send again / Gửi lại” (after a cooldown, shown as a plain text hint, no exact seconds), “Use a different email / Dùng email khác”, which is offered only after [TIME] (the reservation holds the first address until then; before it the action explains “You can change the address after [TIME] / Bạn có thể đổi địa chỉ sau [TIME]”). The same screen appears whether the address is new or existing (no enumeration). |
| **G24** | Confirm and welcome | Landing opened from the email: heading “Confirm your account / Xác nhận tài khoản”, a “Password / Mật khẩu” field (help “At least 10 characters / Ít nhất 10 ký tự”, Show password button), an unchecked “Email me updates / Gửi cho tôi tin cập nhật” checkbox with the consent and unsubscribe text, and one button “Confirm / Xác nhận” (a bare link never confirms, E48; the password is chosen only here). Success: “You’re in. Welcome. / Bạn đã vào. Chào mừng bạn.” then “Continue to the page / Tiếp tục vào trang”. Expired or used link: “This link can’t be used any more. Start again with your code. / Liên kết này không còn dùng được. Hãy bắt đầu lại với mã của bạn.” |
| **G25** | Sign in / forgot password | “Sign in / Đăng nhập”, email, password, “Forgot password? / Quên mật khẩu?”, primary “Sign in / Đăng nhập”, secondary “I have an invite code / Tôi có mã mời”. Wrong credentials: one message, “Email or password isn’t right. / Email hoặc mật khẩu chưa đúng.” Forgot password asks for the email and always answers “If that address has an account, we sent a link. / Nếu địa chỉ này có tài khoản, chúng tôi đã gửi liên kết.” The owner does not sign in here; the owner’s page is `/login` (O1). |
| **G26** | Updates card and subscribe | Shown inside the sent state (G7) and after other interactions (for example a first like or favourite, if those exist), once per device unless the person asks again in Settings. “Want to hear when we add new memories? / Muốn nhận tin khi có kỷ niệm mới?” Field email, unchecked consent box with the unsubscribe note, primary “Send me a confirmation / Gửi email xác nhận”, text action “Not now / Để sau”. After sending: “Check your email to finish. / Hãy kiểm tra email để hoàn tất.” Confirm landing (button) and unsubscribe landing (button, “You won’t get any more updates. / Bạn sẽ không nhận thêm tin cập nhật.”) follow G24. Settings has the same form under “Get updates by email”. |

### 11.3 States (every screen above)

| State | Treatment |
|---|---|
| Default | As described; focus lands on the first field, or the heading for confirmation screens. |
| Empty / invalid input | Inline text under the field, linked with `aria-describedby`, never colour alone; first invalid field receives focus on submit. |
| Submitting | The primary button shows a spinner and “Sending… / Đang gửi…”, stays 48 px high, fields are read-only, and a second press is ignored. |
| Wrong, used, revoked or expired code | One message for all four: “That code can’t be used. Check it, or ask the couple for a new one. / Mã này không dùng được. Hãy kiểm tra lại hoặc xin mã mới.” |
| Too many attempts (code, sign-in, subscribe) | “Too many tries. Please try again later. / Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.” No counts, no timers, the form is disabled. |
| Email not available (Q37 unresolved) | “Email isn’t available yet, so sign-up and updates are paused. / Email chưa khả dụng nên đăng ký và nhận tin đang tạm dừng.” Code check can still run; the form is disabled; nothing implies the code was used. |
| Offline | Banner “You’re offline / Bạn đang ngoại tuyến”, form kept, submit disabled, retries when back online. |
| Server error | “Something went wrong. Nothing was saved. Try again. / Đã xảy ra lỗi. Chưa lưu gì cả. Hãy thử lại.” |
| Page not Published, no token (E47) | G-E1 notice only; none of G20–G26 is reachable from it. |
| Long Vietnamese text | Labels and helper text wrap; buttons grow in height, never truncate; 320 px and 200 % text checked. |
| Signed in | Menu shows “Account”, the Settings group shows the display name (first 24 characters, then an ellipsis) and “Sign out / Đăng xuất”. Sign-out clears the cookie and the screen returns to the page. |

### 11.4 Motion and accessibility

- **Motion:** the sheet uses the existing sheet entrance (motion §6 tokens). Field errors change border colour and show text in 160 ms (no shake). Success shows a check that fades and scales in 200 ms. **Reduced motion:** sheets appear without movement, success is a static check, spinner replaced by the text “Sending…”. Nothing here plays on page arrival.
- **Accessibility:** labelled fields, visible focus ring, Esc closes (if the person typed something, a small confirm “Discard what you typed? / Bỏ nội dung đã nhập?”), focus is trapped in the sheet and restored to the opener, status messages in a polite live region, targets at least 44 px (48 px used), contrast checked per theme including text over the sheet (not yet rendered: the boards are a later step), password fields never autofocus, no CAPTCHA. Tab order follows reading order; Show password is a real button with a pressed state.
- **Privacy:** screens never show a full address after submission beyond the one the person typed; no real names, tokens or codes appear in docs, screenshots or fixtures (rule 3).

## 12. Editable wording in guest context (local previews, 2026-10-27)

The catalogue and verification status live in [editable wording §6.1](vegenus_editable_copy.md#61-local-completion-prepared-2026-10-27-canvas-synchronization-pending). These revisions are prepared locally; they are not yet synchronized to Theme Preview.

- **Home:** greeting above the names in A–D. Render the entire tokenized days sentence in its written order. Phone content flows vertically; tablet retains its two-column hero/note with a photo fan, and laptop its three-part composition. Missing photos and a missing note are separate fixed system notices (Q83); absent content never gets sample photos, a sample signature or a misleading photo counter.
- **Memories:** intro in the reading flow below the fixed heading area on every size. Empty uses the saved `memories.empty` wording; no sample cards, featured memory or content-only controls. Read failure, loading and offline are distinct states.
- **Together:** intro on every size, beneath the heading on phone/tablet and beneath the list heading on laptop. Phone/tablet allow additional vertical scrolling rather than shrinking the calibrated map box. No pins uses saved `together.empty`; read failure has Retry. Existing pin coordinates, zoom and entrance logic are retained; live-art/placement checks still need the current canvas.
- **G7 / G26:** the updates question appears in every Write receipt. Email has a persistent label, consent starts unchecked and its label supplies a 44 px target. Invalid email focuses the email field; missing consent focuses the checkbox; errors describe the relevant input. Simulated confirmation focuses its status. The prototype sends no email and says so. Sending, failure, offline and throttled states preserve the form; consent and other system text are fixed.
- **Outside the page:** 12 new destination boards show browser-tab title, shared-link title/description and the email greeting. Phone stacks the examples, tablet uses two columns and laptop separates updates, link and email. A–D use their existing palettes and fonts. Generic counts and page/unsubscribe labels illustrate email structure; no memory body or credential appears. These visual examples do not change the page access or sharing rules.

The new wording surfaces add no motion. Existing menu/sheet focus containment, Escape and reduced-motion rules still apply. Empty collections are distinguished from loading, offline and failed reads. No new editable keys are added: 27 per language.
