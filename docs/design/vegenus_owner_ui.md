# Owner UI design: setup, content, moderation and account

**Status:** DRAFT v1.0, 2026-10-26, branch `docs/guest-screens-v3`. Split out of the former `vegenus_remaining_sections.md`. Documentation only; no application code. Lead design by Codex, edited by Claude. Placeholders only (rule 3).
**Look:** one plain look for every theme (PRD Q56), system fonts, no themed backgrounds, one shared account for both partners (Q35). Guest previews inside the owner area use the guest composition in a neutral shell. Related: [screens](vegenus_screens.md) (O1-O15 and the responsive matrix), [guest UI](vegenus_guest_ui.md) (shared shell and state contract in §6), [guest motion](vegenus_guest_motion.md) (owner micro-motions in §10.2).
**Canvas:** page 10, boards OwnerDash, OwnerQueue, OwnerSetup, OwnerLogin at phone, tablet and laptop (plus the older DashNeutral, DashThemed, EditA, EditLapA). DashThemed is obsolete after Q56. Not yet built as boards: O4 content list, O5 item editor, O6 upload, O10 usage, O14 email, O15 guest accounts (modules inside OwnerDash only).

## 1. Owner area — O1–O15 in scope

**Purpose:** a practical workspace for the couple’s shared account, Q35. Both partners see the same permissions and controls. Guests never receive these screens or data; guest-looking previews remain clearly inside the owner workspace.

**Neutral shell:** theme D’s neutral color/radius basis with system fonts, Q56. Plain round menu button and the same responsive fan behavior; owner items are Overview, Content, Wishes and Settings. No separate co-editor invitation or restricted partner dashboard.

### Responsive frame

| Size | Owner layout |
|---|---|
| Phone 390 × 844 | 88 px reserved bar; 16 px gutters; 358 px content width; stacked cards and fields; full-width primary action. Long action groups wrap. |
| Tablet 820 × 1180 | 24 px gutters; 772 px content region; editors may use 248 px navigation + 24 px gap + 500 px work area. Forms remain single-column when labels need room. |
| Laptop 1440 × 900 | Centered maximum 1200 px content; editors use 240 px navigation + 24 px gap + 600 px editor + 24 px gap + 312 px inspector. Simple forms stay ≤640 px. |
| 320 px / 200% text | One column; tables become labelled records; reorder controls remain available; no fixed-height editor or horizontal toolbar dependency. |

### Screens, content and states

The common loading/error/offline/rate-limit contract applies to every server-backed screen. No fabricated rate-limit numbers are introduced for owner actions.

| Screen | Final design specification |
|---|---|
| **O1 — Login** | Centered 400 px form: “Sign in / Đăng nhập”, email, password, Show password, primary Sign in, Google fallback. Phone fills available width. No sign-up link, Q30. Generic “Couldn’t sign in. Check your details.” / “Chưa đăng nhập được. Kiểm tra thông tin.” prevents account enumeration. Offline keeps typed fields; do not claim authentication succeeded. Reset-email affordance follows Q41 readiness. |
| **O2 — Dashboard** | Empty: “Make room for your memories / Tạo nơi lưu giữ kỷ niệm”, one “Set up your page / Thiết lập trang” action and three concise setup steps. Populated: visibility, enabled sections, pending-wish count, usage, links to Content, O7, O8 Share and O9 visibility. Phone stacks; tablet uses two columns; laptop uses three. Failed widgets show their own retry, never misleading zeros. “View as guest / Xem như khách” opens scoped preview. |
| **O3 — Setup wizard** | Five steps: theme, default language, time zone, sections, visibility; visible “Step [N] of 5 / Bước [N]/5”, Back/Next and review. Theme step: phone one large preview with four labelled choices; tablet/laptop choice list beside preview. Preview changes A–D without changing surrounding tokens. Token-only is the visibility default. Browser time zone is a proposal to verify, not silently publish. Failed finish retains choices; abandoning unsaved setup requires a clear discard choice. |
| **O4 — Content list** | Section picker, New action, draft/published status, language and date metadata. Phone records; tablet/laptop rows with consistent action positions. Empty: “Add your first memory / Thêm kỷ niệm đầu tiên.” Reorder has Move up/down buttons alongside any drag enhancement. Save order explicitly; a failed operation leaves confirmed order intact. Publish/unpublish status updates only on server success. |
| **O5 — Item editor** | Phone: title/date/language fields, album-page list, selected layout and slots, media, preview, save actions. Tablet/laptop use the frame above. “Save draft / Lưu bản nháp”, “Publish / Đăng”, separate destructive Delete. Preserve approved album layouts and + slots. Layout changes that would drop content are blocked with explanation. Missing translation is allowed with guest fallback. Conflict: “This item changed elsewhere / Nội dung đã được sửa ở nơi khác”; show comparison and retain local input, never overwrite silently. |
| **O6 — Upload** | Picker plus file queue; each row shows name, type, measured size, preparation/upload status, Retry/Cancel. Phone rows stack; larger screens may show a details column. States: queued, processing, uploading, complete, failed, canceled, storage full. Show “Location data removed / Đã xóa dữ liệu vị trí” only after successful processing. Corrupt/unsupported files explain recovery. Session loss pauses further writes; cancellation does not claim server cleanup or reclaimed capacity immediately. |
| **O7 — Wish moderation** | Pending queue, approved/rejected history views where supported; full plain-text message, display name, language and submitted metadata. Phone one record at a time; tablet/laptop list plus reading panel. “Approve / Duyệt” and “Reject / Từ chối” are explicit buttons; no swipe-only moderation. Empty: “All caught up / Đã xử lý hết lời chúc.” Move an entry only after confirmation; failure retains it. After removal, focus next entry or the empty heading. Never rewrite the guest’s words. |
| **O10 — Usage** | Storage and egress panels with numeric used/limit values and labelled meters; warnings at 60% and 80% per inventory/plan. Phone stacks; tablet/laptop compare side by side. Include storage held by uploads or pending deletion where available. “Usage unavailable / Chưa tải được mức sử dụng” is distinct from zero. Show last successful refresh, not invented live precision. Link full storage to O4/O6; no automatic deletion or purchase. |
| **O12/O11 — Account** | O12 contains account language, replay O13 and Log out. O11 is a subsection, “Shared account / Tài khoản dùng chung”: password change and Google linking, not a Members invitation screen. Phone one column; larger screens max 640 px. Changes use verified server flows; errors preserve nonsecret form context. Logout clears protected UI and prevents Back from revealing it. No partner-role toggle. |
| **O14 — Email settings** | Reminder lead time, wish digest toggle, Save, last sends/failures and explicit “Send test to my address / Gửi thử đến email của tôi”. Empty history is not an error. Delivery states: queued, sent, failed, suppressed. When Q37 readiness is unresolved, explain unavailability and disable sending; never claim owner-only mail works. Proposed 7-day lead remains a proposal, not an approved limit. |
| **O15 — Guest accounts** | Cap counter `[N]/50`, Q38; list with account identity and explicit Remove; separate Remove all with confirmation. Phone labelled records; laptop table. Empty: “No saved guest accounts / Chưa có tài khoản khách.” Before Phase B, explain availability rather than offering a broken registration flow. Removing accounts does not rotate the guest link; rotating the link does not remove accounts. State these consequences in confirmation copy. |
| **O13 — First-run tour** | Three steps: setup, first memory, guest link. Phone bottom sheet; tablet/laptop anchored dialog that falls back to centered when space is tight. “Next / Tiếp”, “Back / Quay lại”, “Skip / Bỏ qua”, “Done / Xong”; Escape closes. It never creates, publishes or sends anything automatically. Account-level completion follows Q40; replay from O12. Missing targets use descriptive fallback content. |

### Limits and owner preview behavior

- **Confirmed:** wishes 40/500, Q34c; pending hidden, Q34d; anonymous wish limits, Q43; guest-account cap 50, Q38; video ≤50 MB and approximately 25 MB target, Q27.
- **Existing project budget:** 1 GB storage, PRD §8 via plan §3. Display server accounting, including reservations and pending deletion; do not estimate free space from visible files alone.
- **Unapproved Q66 proposal:** 12 album pages, 24 photos, one video, one voice note, 600 characters per text box, three stickers per page. Label these proposed in design boards; do not present them as settled product limits.
- **Owner preview:** distinguish published guest view from draft preview. Theme switching in preview does not save the page theme, publish drafts or expose birth data. Offer phone/tablet/laptop frames on larger screens; phone preview uses the actual available width.
- **Moderation states:** only O7 receives pending/rejected bodies. G5 preview obeys the same approved-only boundary as guests.
- **Keyboard:** semantic headings, labelled forms, visible focus, keyboard reorder alternatives, modal focus containment and restoration. Progress announcements describe meaningful stages rather than every percentage point.
- **Cross-links:** O5→O6 media; O2/O6→O10 usage; O2→O7 moderation; O12→O11/O14/O15; O13→O3/O4/O8. O8/O9 retain existing access and confirmation rules.
