# Guest UI design: sections, status and specifications

**Status:** v1.0 consolidation, 2026-10-26, branch `docs/guest-screens-v3`. This file replaces `vegenus_guest_screens_v3.md` and the guest half of `vegenus_remaining_sections.md` (both removed). Documentation only; no application code. Rule 3: placeholders only.
**Where things live:** screen inventory and responsive matrix: [screens](vegenus_screens.md). Owner area: [owner UI](vegenus_owner_ui.md). Motion and signature entrances: [guest motion](vegenus_guest_motion.md). Themes, menu, tokens: [theme system](vegenus_theme_system.md). 3D and Zodiac scene: [3D approach](vegenus_3d_approach.md). Image prompts: [Codex image brief](vegenus_codex_image_brief.md). Logo: [assets/logo](../../assets/logo/README.md).
**Canvas:** "Theme Preview" on the owner's claude.ai account (not in Git). Boards were built by scratchpad generators that are not in the repo; the Wishes, Leave a wish, Settings and Owner generator is stored on the canvas as the asset `anni-gen-pages7-10.txt`. Decision comparison boards (Q71-Q74) are page 13.

## 1. Section status

| Section | Canvas page | Status (2026-10-26) | Specification |
|---|---|---|---|
| Home G1 | 1 | Approved 2026-10-24 (phone, tablet, laptop, four themes) | [screens](vegenus_screens.md) G1; [motion §4](vegenus_guest_motion.md#4-section-handoffs), [§10.2](vegenus_guest_motion.md#1022-section-signatures); PRD Q64 |
| Menu | 2 | Rule final: circular fan everywhere; phone flips the page, tablet and laptop blur it; label review open | [theme system §2](vegenus_theme_system.md); [motion §3](vegenus_guest_motion.md#3-menu-choreography) |
| Zodiac Z2 | 3 | Approved 2026-10-24 | [3D approach §5.1](vegenus_3d_approach.md), [theme system §6](vegenus_theme_system.md); tests in §5 below; PRD Q61-Q62 |
| Memories G2 | 4 | Approved; PRD Q74 asks whether to drop parallax and Ken Burns | progress 2026-10-24 "Memories v4" |
| Memory detail G3 | 5 | Album direction chosen; Codex review clean (round 7); Q66 limits open | [screens](vegenus_screens.md) G3; PRD Q66-Q68 |
| Together G4 | 6 | Approved v5.2, 2026-10-24; entrance proposed | PRD Q63; [motion §10.1](vegenus_guest_motion.md#101-together-signature-entrance--a-little-world-lands) |
| Wishes G5 | 7 | Rebuilt 2026-10-26 (Codex lead design); owner review pending | §7 below |
| Leave a wish G6/G7 | 8 | Same | §8 below |
| Settings G8 | 9 | Same | §9 below |
| Owner area | 10 | Rebuilt; plain look (Q56) | [owner UI](vegenus_owner_ui.md) |
| Nav icons | 11 | Approved 2026-10-23 | [theme system §2](vegenus_theme_system.md) |
| Logo | 12 | Approved emblem; canvas page updated 2026-10-26 | [assets/logo](../../assets/logo/README.md); PRD Q60 |
| Decisions | 13 | Comparison boards for Q71-Q74 (being built) | PRD §12 |

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
- **"Circular menu" (Q65).** Only the button was redesigned; the round item bubbles are unchanged. Owner to say if the items should change too.

## 4. References looked at (21st.dev, owner suggestion)
- Draggable Photo Stack by @laziekiki (MIT): swipe physics, fan view, shuffle. Reference for the real G1 stack (drag to throw, not only tap). https://21st.dev/@laziekiki/components/draggable-photo-stack
- mapcn MarkerTooltip and Expand Map: real-map components (MapLibre based), useful only for the pin and expand pattern since the owner chose an illustrated map. https://21st.dev/@mapcn/components/mapcn-marker-tooltip , https://21st.dev/@jatin-yadav05/components/expand-map
- Nothing was installed or copied (rule 1). Any template that ships needs its licence checked and an install approval.

## 5. Tests to write first (approved sections)
1. G1: tapping the photo or "next" advances the counter and wraps 5 → 1; "previous" wraps 1 → 5; the counter is announced; reduced motion shows no fly-out.
2. Menu: after close, no menu item is focusable (Tab skips them) and the nav is `aria-hidden`; open → close → open leaves no item stuck mid-animation.
3. Together: every pin has a DOM chip equivalent; opening a pin moves focus to the sheet heading; Esc and × close it and return focus to the pin; previous / next wrap.
4. Zodiac (v4, 2026-10-24): the reading is six message tiles (real `<button>`s, ≥ 44 px) that each open one message; tile and dialog text keep ≥ 4.5:1 contrast over the sky; the sign images keep alt text; on a 390 × 844 phone all six tiles are visible without scrolling, laid out in flow (no absolute positions), with equal gaps.
5. Zodiac message dialog (Codex review 2026-10-24): opening moves focus into the dialog (its heading or close button), the page behind is `inert`, Tab stays inside, Escape and × close it, focus returns to the tile that opened it; previous / next keep focus in the dialog; the page-turn or unroll effect (v4.3, owner's pick) never moves focus or hides the buttons; swipe left / right turns the page and the buttons do the same for keyboard and switch users; reduced motion shows the page without the flip, roll or slide. The circular menu keeps design 4 test 12 (inert page, focus, Escape, close on selection, no tilt under reduced motion).

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

**Purpose:** a calm, generous collection of approved wishes. Guests read newest first. Eligible token/account guests can compose; visitors to a Published page without credentials receive a read-only explanation. Owner and partner see exactly the approved guest collection in preview; moderation lives in O7.

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
| Public read-only | “Tap the tag or scan the QR code to leave a wish.” / “Chạm thẻ hoặc quét mã QR để gửi lời chúc.” | Preview shows this state when public-reader access is selected. |
| More-load failure | Keep existing wishes; replace only the loading footer with Retry. | Same preview behavior. |

Use semantic list items/articles, not a carousel. Load more keeps focus on its button and politely announces “[N] more wishes / Đã tải thêm [N] lời chúc.” No automatic live insertion while somebody is reading.

Links: G6 from the CTA; G8 for language; menu to Home, Zodiac, Memories and Together. Do not restore the superseded Home “latest wish” strip.

## 8. Leave a wish and confirmation — G6/G7

**Purpose:** a short, trusted submission flow. No account is required for a valid token guest. A guest account may write when available under the approved account flow. Owner preview demonstrates the form with placeholders and a clearly labelled sample confirmation.

### Layout and fields

Phone: bottom sheet, full available width, 16 px padding, 56 px heading/Close row; name input 48 px high; message textarea initially 160 px high; counters, privacy note and 48 px Send button in natural flow. Tablet: centered 560 px dialog. Laptop: centered 600 px dialog. Maximum height follows the visible viewport; the interior scrolls without hiding errors behind the keyboard.

Fields:

- **“Display name / Tên hiển thị”**, required, Q34c cap **40**.
- **“Your wish / Lời chúc của bạn”**, required, Q34c cap **500**.
- Visible counters `[N]/40` and `[N]/500`; describe counters to fields without announcing every keystroke.
- Plain text only; no attachments, formatting toolbar or guest photo upload.
- No language switch outside G8, following Q67. Submission language metadata initially follows G8; arbitrary message text is not translated automatically.

The older G6 inventory lists a language field. Removing that selector is the recommended reconciliation with Q67; confirm metadata behavior in the decisions table.

Privacy copy:

> **EN:** “We briefly check your network address to prevent spam. We never store the address.”  
> **VI:** “Chúng tôi kiểm tra nhanh địa chỉ mạng để ngăn spam và không lưu địa chỉ này.”

### State and submission behavior

| State | Required presentation |
|---|---|
| Blank | Persistent labels and short prompts; Send validates rather than silently doing nothing. |
| Invalid | Inline message: “Enter a display name.” / “Nhập tên hiển thị.”; “Write a wish.” / “Viết lời chúc.” Focus the first invalid field after submission. |
| Over limit | Preserve the text and explain the relevant cap; never silently truncate pasted text. Unicode counting must match server validation. |
| Sending | “Sending…” / “Đang gửi…”; prevent duplicate submission. Close/navigation remain available with appropriate draft protection. |
| Rate-limited | Q43 (under review, Q75): **3 posts per 10 minutes per device and per IP; 50 per page per day**; the owner's direction is 3 per day with a notification pop-up and no rule text on the form ("Daily limit notice" boards pending). Use returned `[WAIT]`, including page-day exhaustion. |
| Shared-network block | “People on the same Wi-Fi may share this limit.” / “Những người dùng chung Wi-Fi có thể dùng chung giới hạn này.” |
| Offline | Keep the draft in memory; disable sending with explanation. No automatic upload after reconnection. |
| Uncertain response | “We couldn’t confirm whether it was sent.” / “Chưa thể xác nhận lời chúc đã được gửi.” Do not silently resend; deduplication is an open implementation contract. |
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
| D1, D2, D9 | Together entrance direction, replay policy, "Use device setting" | PRD Q71; [motion §10.1.4](vegenus_guest_motion.md#1014-replay-policy) |
| D3 | Elegant gold hairline | PRD Q72 |
| D4, D5, D6 | Character counting, stored language, retry de-duplication | PRD Q73; §8 |
| D7 | Album quota limits | PRD Q66 |
| D8 | Memories parallax and Ken Burns | PRD Q74 |
| D10 | Email readiness and reminder defaults | PRD Q37; [owner UI](vegenus_owner_ui.md) |
