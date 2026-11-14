# Owner UI design: setup, content, moderation and account

**Status:** v1.0, **Approved by the owner 2026-10-28 (Phase 0 sign-off).** Documentation only; no application code. Lead design by Codex, edited by Claude. Placeholders only (rule 3).
**Look:** one plain look for every theme (PRD Q56), system fonts, no themed backgrounds, one shared account for both partners (Q35). Guest previews inside the owner area use the guest composition in a neutral shell. Related: [screens](vegenus_screens.md) (O1-O15 and the responsive matrix), [guest UI](vegenus_guest_ui.md) (shared shell and state contract in §6), [guest motion](vegenus_guest_motion.md) (owner micro-motions in §10.2).
**Canvas:** page 10, boards OwnerDash, OwnerQueue, OwnerSetup, OwnerLogin at phone, tablet and laptop (plus the older DashNeutral, DashThemed, EditA, EditLapA). DashThemed is obsolete after Q56. Not yet built as boards: O4 content list, O5 item editor, O6 upload, O10 usage, O14 email, O15 guest accounts (modules inside OwnerDash only).

## 1. Owner area — O1–O16 in scope (O18 in §2)

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
| **O3 — Setup wizard** | Five steps (Q128; the revision section below wins): default language and the two partner names (1–40 characters each, required; they fill the wording tokens), time zone, sections, wording, visibility and review; visible “Step [N] of 5 / Bước [N]/5”, Back/Next and review. The page stays Private until the last step succeeds. **Wording step:** explains in one line that guests read these texts, shows a sample of the greeting, the days line and the Wishes button in both languages, and offers “Use the suggested wording / Dùng lời văn gợi ý” (selected by default; editing every field is done later in O18). Phone: sample stacked above a collapsible guest preview with A–D preview buttons and an EN/VI switch; tablet and laptop: options beside the live preview. Nothing is published at this step; finishing the wizard (last step, “Finish and publish / Hoàn tất và đăng”) publishes the wording and sets the visibility in one server action. **Failure:** the page stays Private, every choice is kept, an inline error says nothing was published with Retry and Back; a retry is safe to repeat; offline disables Finish with an explanation; a second session finishing first shows the conflict prompt. Token-only is the visibility default offered. Browser time zone is a proposal to verify, not silently publish. Failed finish retains choices; abandoning unsaved setup requires a clear discard choice. |
| **O4 — Content list** | Section picker, New action, draft/published status, language and date metadata. Phone records; tablet/laptop rows with consistent action positions. Empty: “Add your first memory / Thêm kỷ niệm đầu tiên.” Reorder has Move up/down buttons alongside any drag enhancement. Save order explicitly; a failed operation leaves confirmed order intact. Publish/unpublish status updates only on server success. |
| **O5 — Item editor** | Phone: title/date/language fields, album-page list, selected layout and slots, media, preview, save actions. Tablet/laptop use the frame above. “Save draft / Lưu bản nháp”, “Publish / Đăng”, separate destructive Delete. Preserve approved album layouts and + slots. Layout changes that would drop content are blocked with explanation. Missing translation is allowed with guest fallback. Conflict: “This item changed elsewhere / Nội dung đã được sửa ở nơi khác”; show comparison and retain local input, never overwrite silently. |
| **O6 — Upload** | Picker plus file queue; each row shows name, type, measured size, preparation/upload status, Retry/Cancel. Phone rows stack; larger screens may show a details column. States: queued, processing, uploading, complete, failed, canceled, storage full. Show “Location data removed / Đã xóa dữ liệu vị trí” only after successful processing. Corrupt/unsupported files explain recovery. Session loss pauses further writes; cancellation does not claim server cleanup or reclaimed capacity immediately. |
| **O7 — Wish moderation** | Pending queue, approved/rejected history views where supported; full plain-text message, display name, language and submitted metadata. Phone one record at a time; tablet/laptop list plus reading panel. “Approve / Duyệt” and “Reject / Từ chối” are explicit buttons; no swipe-only moderation. Empty: “All caught up / Đã xử lý hết lời chúc.” Move an entry only after confirmation; failure retains it. After removal, focus next entry or the empty heading. Never rewrite the guest’s words. |
| **O10 — Usage** | Storage and egress panels with numeric used/limit values and labelled meters; warnings at 60% and 80% per inventory/plan. Phone stacks; tablet/laptop compare side by side. Include storage held by uploads or pending deletion where available. “Usage unavailable / Chưa tải được mức sử dụng” is distinct from zero. Show last successful refresh, not invented live precision. Link full storage to O4/O6; no automatic deletion or purchase. |
| **O12/O11 — Account** | O12 contains account language, replay O13 and Log out. O11 is a subsection, “Shared account / Tài khoản dùng chung”: password change and Google linking, not an invitation screen. Phone one column; larger screens max 640 px. Changes use verified server flows; errors preserve nonsecret form context. Logout clears protected UI and prevents Back from revealing it. No partner-role toggle. |
| **O14 — Email settings** | Reminder lead time, wish digest toggle, Save, last sends/failures and explicit “Send test to my address / Gửi thử đến email của tôi”. Empty history is not an error. Delivery states: queued, sent, failed, suppressed. When Q37 readiness is unresolved, explain unavailability and disable sending; never claim owner-only mail works. Proposed 7-day lead remains a proposal, not an approved limit. Adds a switch “Notify subscribers about new memories / Thông báo cho người đăng ký khi có kỷ niệm mới” (default off, Q81), the active subscriber count against the cap and the last digest time; owner mail is always sent before subscriber mail when the daily limit is short. Disabled with an explanation while Q37 is unresolved. |
| **O15 — Registered guests and subscribers** | Cap counter `[N]/50` counts accounts plus open and reserved codes (Q38, Q79). List with account identity (display name, signed-up date, updates on/off) and explicit Remove; separate Remove all with confirmation. A second list, “Email subscribers / Người đăng ký email”, shows count against its cap, confirmed date and Remove; addresses are shown only here and never copied into docs, logs or Codex (rule 3). Phone labelled records; laptop table. Empty: “No registered guests yet / Chưa có khách đăng ký.” Removing accounts does not rotate the guest link; rotating the link does not remove accounts. State these consequences in the confirmation. Before email is available (Q37), explain availability rather than offering a broken flow. |
| **O16 — Invite codes** | Phone: labelled records; tablet/laptop: table (label, state, created, expires, reserved until, actions). Header shows `[N]/50` (accounts + open + reserved codes). Primary “Create code / Tạo mã mời” opens a small dialog: optional private label (up to 40 characters, “never a real name in shared files”), optional expiry (None, 7 days, 30 days). After creating, a **show-once** panel displays the code (`[CODE]` in docs), “Copy / Sao chép”, and a warning: “This is the only time the code is shown. / Đây là lần duy nhất mã được hiển thị.” Closing it hides the code for good. States: open, reserved (until time), redeemed, revoked, expired. “Revoke / Thu hồi” with confirm on open and reserved codes; redeemed codes link to Remove account in O15. Empty: “No codes yet. Create one to invite someone. / Chưa có mã. Tạo mã để mời một người.” Cap reached: Create disabled with “You’ve reached the limit of accounts and codes. / Đã đạt giới hạn tài khoản và mã.” Email unavailable (Q37): a persistent warning that people can’t finish sign-up yet; codes can still be made. Error and offline follow the common contract. A lost code is revoked and replaced, never recovered. |
| **O13 — First-run tour** | Three steps: setup, first memory, guest link. Phone bottom sheet; tablet/laptop anchored dialog that falls back to centered when space is tight. “Next / Tiếp”, “Back / Quay lại”, “Skip / Bỏ qua”, “Done / Xong”; Escape closes. It never creates, publishes or sends anything automatically. Account-level completion follows Q40; replay from O12. Missing targets use descriptive fallback content. |

### O2 and O3 revision for T2.1b (2026-11-01, approved by the owner 2026-11-02, Q119)

Where this section and the O2/O3 rows above disagree, this section wins (PRD Q111-Q121). Boards: OwnerSetup and OwnerDash at phone, tablet and laptop, revised from the approved Phase 0 boards (layout and owner look kept; Codex lead design, Claude review); local working copies and the copy table live in the git-ignored `.design/o2-o3/`.

- **Shell:** the round menu button is hidden until a second owner screen exists (Q120); Log out stays on the dashboard as a native form POST with no failure state. Owner strings are inline "English / Vietnamese" pairs, the English part in `lang="en"` (Q118). Tokens: the neutral set of theme_system §4 (radius 0, `#555555` muted, `#1a1a1a` line); type on the §3.1 scale; owner feedback motion 120 ms opacity and 80 ms press, 0 ms under reduced motion.
- **O3 steps (five since Q128: guests choose the theme, the owner never does in setup):** 1 default language and the two partner names (required, 1-40 characters after trim and NFC, no control or bidirectional characters, a wrapped echo shows the full name; the language starts from the browser, `vi` or else `en`; the first Next creates the Private page with the names and the browser time zone, or UTC when the browser's zone is not offered); 2 time zone (prefilled; an unavailable zone shows an empty "Choose / Chọn" option and an error); 3 sections (Home on and disabled with its reason; Memories, Together, Wishes off; no Zodiac); 4 wording (the sample and the inert guest preview, with four A-D preview buttons that change only the preview, start on the owner's suggested theme if any, and save nothing; previews use the A-D token sets with §8.2 fallback fonts, no scene art; "Use the suggested wording" is the only path); 5 visibility and review (Token-only stated as a fact, not a choice; every saved value with a "Change" link to its step; the review is the time-zone confirmation; "Finish and publish / Hoàn tất và đăng").
- **O3 states:** each step save re-sends every field and names the version it read; one conflict prompt covers a stale save and a create race (409 `changed_elsewhere`), and reloading saved choices is a real re-read; 409 `setup_finished` shows "already set up" and leads to O2; a 400 shows one generic message (the route returns no body) and offers no retry of the same body; Finish names the version the review showed, and a newer page or a name or wording field emptied by another session gets the conflict prompt (409 `changed_elsewhere`, Q125, Q130; Keep mine saves the reviewed choices and stays on the review), and only its own 503 `not_published` is a confirmed failure (Q126); 401 returns to login; 403 shows access lost with Log out; 503 keeps the draft with "Try again / Thử lại". Offline blocks saving until the connection returns. Finish (API with T2.7/T2.1b): saving; a server-confirmed failure ("nothing was published", one retry); an uncertain outcome (never claims nothing was published; its single retry survives Back, Leave and resume and shows only on step 5); success leads to O2 done. Back keeps unsaved edits in memory without saving; Leave asks to discard only when the current step has unsaved input. A resumed setup opens at step 1 when a name is missing, otherwise step 5 (Q121, Q128); a page resumed on UTC keeps the fallback flag on steps 2 and 5 until a zone is chosen or step 2 is confirmed in that session (the database stores no confirmation, R1). Limit reached: not applicable (no server limit on setup saves).
- **O2 states:** loading; empty (no page: three steps and "Set up your page"); resumed setup (Private, "Continue setup"); done after Finish (only names, Token-only, sections, Log out; tablet two columns, laptop three); read failure (the shipped `src/app/app/error.tsx` copy and "Try again / Thử lại"); offline; access lost (with Log out); long Vietnamese. A read that never succeeded is never shown as empty.
- **Accessibility:** real controls with visible labels; 44 px targets with 8 px spacing, 48 px primary buttons; focus moves to the new step heading after Next and to the first invalid field after a failed submit; dialogs are native modals (Esc takes the non-destructive choice, focus returns to the opener); persistent polite and alert regions announce saves and errors once; checked at 320 px with 200 % text by an automated reflow render (Q119): no page scroll, no clipped container, no target under 44 px.
- **Hallmark:** the app-screen rules were applied as a check (genre modern-minimal). Recorded exception: theme A Dreamy's approved gradient ground in the previews (Floor gate 2a); Hallmark does not govern the guest themes.

### O6 Upload for T2.3b (2026-11-14, boards drawn; owner sign-off pending)

Boards: OwnerUpload, OwnerUploadTab and OwnerUploadLap on canvas page 10 "Owner area" (Theme Preview version 112), each with a `reviewState` picker for 28 states. Codex lead design, Claude review and render; working copies, generator and checks in the git-ignored `.design/o6/`. Open points decided as defaults pending the owner: PRD Q139.

- **Placement and flow:** opened from one item in O5 ("Add photos or video"); Back and Done return to that item. Owner look and tokens as O2/O3. The owner picks files, then "Start uploads"; each file is prepared in the browser (`src/lib/media.ts`), uploaded and confirmed.
- **Compositions:** phone stacks the picker, queue rows and storage panel; tablet adds a selected-file details column with storage; laptop adds the item context column (item title) on the left. Tablet and laptop fall back to one column below 700 px.
- **Row states:** Waiting; Preparing photo / Preparing video (no percent: the browser gives none); Photo prepared (the "Location data removed" note appears only from here on); Uploading (a `<progress>` showing the value, its accessible name holds the file name); Confirming with the server; Saved (only a server-confirmed file is called saved); Unsupported, with HEIC and "this browser can't compress video" variants (Remove only, no Try again); Too large (video over 50 MB after compression); Upload interrupted or expired (Try again starts a new upload, Q139); Canceled ("Space is freed after cleanup."); Not saved (503, Try again).
- **Screen states:** default; empty; loading; read failure; count cap (25th photo or 2nd video refused by name); storage at 80 % (amber) and full (nothing added; deleted media keep counting until cleanup; View usage); offline (queue kept, new uploads paused, resumes on reconnect; connectivity is tracked apart from other blocks, so reconnecting never lifts a 401, 403 or storage-full block); session expired (401: queue kept, uploads paused, sign in again); access lost (403 with Log out); remove confirmation and leave-while-uploading dialogs (native modals, Esc keeps the file or stays); long Vietnamese; all done (the notice clears as soon as an unconfirmed file is added). Server numbers only, never an estimate.
- **Accessibility:** one polite region announces each stage change once (never every percent; simultaneous changes in one update); an alert region announces blocking errors once; a failing row never takes focus; when the focused control disappears or is disabled, focus moves to the same row's next action, else the selected file, else Back; filenames inherit the page language; the two side panels are named landmarks.
- **Checks (2026-11-14):** the board logic checks (84 board and state cases plus 18 regression checks per board (R1-R12, V1-V6), each seen failing first) pass; rendered in Chromium 156 and WebKit 27.2, every state of every board at its own size and at 320 px with a 200 % root font: no sideways scroll, no clipped box, no target under 44 px, no axe violation, no console error (168 cases per engine). Codex adversarial review: five rounds, every finding fixed except round 5's two, stopped there at the owner's request (2026-11-14) and kept as known issues for the screen build: the recovery buttons (Try again after a read failure, Reconnect, Sign in again) leave focus on the document after the redraw, and three bilingual `aria-label`s (the two side panels and the progress bar) have no language boundary, so the screen should use `aria-labelledby` on `lang`-marked text.

Drafted copy for the owner's approval (EN and VI as drawn; shipped strings marked as such in `.design/o6/COPY.md`):

| Key | English | Vietnamese |
|---|---|---|
| `title` | Add photos or video | Thêm ảnh hoặc video |
| `back` | Back | Quay lại |
| `close` | Close | Đóng |
| `logout` | Log out | Đăng xuất |
| `retry` | Try again | Thử lại |
| `loading` | Loading… | Đang tải… |
| `read` | Couldn’t load this. Try again. | Chưa tải được. Thử lại. |
| `offline` | You’re offline. Reconnect to continue. | Bạn đang ngoại tuyến. Kết nối lại để tiếp tục. |
| `access` | Access is no longer available. | Quyền truy cập không còn hiệu lực. |
| `location` | Location data removed | Đã xóa dữ liệu vị trí |
| `queue` | Upload queue | Hàng đợi tải lên |
| `details` | File details | Chi tiết tệp |
| `context` | Memory item | Mục kỷ niệm |
| `usage` | Page storage | Dung lượng trang |
| `used` | [612] MB of [900] MB used | Đã dùng [612] MB trên [900] MB |
| `warnUsed` | [720] MB of [900] MB used | Đã dùng [720] MB trên [900] MB |
| `fullUsed` | [900] MB of [900] MB used | Đã dùng [900] MB trên [900] MB |
| `limits` | Up to 24 photos and 1 video per memory. Video must be 50 MB or less after compression. | Mỗi kỷ niệm có tối đa 24 ảnh và 1 video. Video sau khi nén phải có dung lượng không quá 50 MB. |
| `process` | Photos are prepared as WebP or JPEG with EXIF and location data removed. Video is compressed to 720p H.264. | Ảnh được chuyển sang WebP hoặc JPEG và xóa EXIF cùng dữ liệu vị trí. Video được nén thành H.264 ở độ phân giải 720p. |
| `picker` | Choose files | Chọn tệp |
| `start` | Start uploads | Bắt đầu tải lên |
| `done` | Done | Hoàn tất |
| `empty` | No files yet. Choose photos or a video for this item. | Chưa có tệp nào. Chọn ảnh hoặc video cho mục này. |
| `queued` | Waiting | Đang chờ |
| `preparingPhoto` | Preparing photo… | Đang chuẩn bị ảnh… |
| `preparingVideo` | Preparing video… | Đang chuẩn bị video… |
| `prepared` | Photo prepared | Đã chuẩn bị ảnh |
| `uploading` | Uploading | Đang tải lên |
| `saving` | Confirming with the server… | Đang xác nhận với máy chủ… |
| `ready` | Saved | Đã lưu |
| `unsupported` | Can’t read this file. Save as JPEG/PNG or MP4, or try another browser. | Không đọc được tệp này. Lưu lại dưới dạng JPEG/PNG hoặc MP4, hoặc thử trình duyệt khác. |
| `heic` | Can’t read this HEIC file. Save as JPEG/PNG, or try another browser. | Không đọc được tệp HEIC này. Lưu lại dưới dạng JPEG/PNG hoặc thử trình duyệt khác. |
| `videoUnsupported` | This browser can’t compress video. Save as MP4, or try another browser. | Trình duyệt này không thể nén video. Lưu lại dưới dạng MP4 hoặc thử trình duyệt khác. |
| `large` | Video is over 50 MB after compression. Trim it or pick a shorter clip. | Video sau khi nén vượt quá 50 MB. Hãy cắt bớt hoặc chọn đoạn ngắn hơn. |
| `failed` | Upload interrupted or expired. Try again to restart the upload. | Lượt tải lên bị gián đoạn hoặc đã hết hạn. Thử lại để tải lên từ đầu. |
| `canceled` | Canceled. Space is freed after cleanup. | Đã hủy. Dung lượng được giải phóng sau khi dọn dẹp. |
| `notSaved` | Not saved. The server or network could not confirm this file. Try again. | Chưa lưu. Máy chủ hoặc mạng chưa thể xác nhận tệp này. Hãy thử lại. |
| `remove` | Remove | Xóa |
| `cancel` | Cancel | Hủy |
| `photo` | Photo | Ảnh |
| `video` | Video | Video |
| `size` | Measured size | Dung lượng đã đo |
| `original` | Source size; prepared size appears after preparation. | Dung lượng tệp nguồn; dung lượng sau xử lý sẽ hiện khi chuẩn bị xong. |
| `pause` | Queue kept. New uploads are paused; uploads resume when you reconnect. | Hàng đợi được giữ lại. Tạm dừng lượt tải mới; các lượt tải tiếp tục khi kết nối lại. |
| `session` | Session expired. Queue kept; further uploads are paused. Sign in again to continue. Unconfirmed files are not marked as saved. | Phiên đăng nhập đã hết hạn. Hàng đợi được giữ lại; tạm dừng các lượt tải tiếp theo. Đăng nhập lại để tiếp tục. Tệp chưa được xác nhận không được đánh dấu là đã lưu. |
| `signin` | Sign in again | Đăng nhập lại |
| `warning` | Storage is at 80%. Check page usage before adding more. | Đã dùng 80% dung lượng. Kiểm tra dung lượng trang trước khi thêm tệp. |
| `full` | Storage is full. Nothing was added. Delete something to make room. Deleted media keep counting until cleanup. | Dung lượng đã đầy. Không có tệp nào được thêm. Xóa bớt nội dung để có chỗ trống. Nội dung đã xóa vẫn chiếm dung lượng cho đến khi dọn dẹp. |
| `viewUsage` | View usage | Xem dung lượng |
| `refused` | photo-25.jpg was not added: 24-photo limit reached. video-02.mp4 was not added: 1-video limit reached. | Không thêm photo-25.jpg: đã đạt giới hạn 24 ảnh. Không thêm video-02.mp4: đã đạt giới hạn 1 video. |
| `allDone` | All files are confirmed. Return to the item to continue editing. | Tất cả tệp đã được xác nhận. Quay lại mục để tiếp tục chỉnh sửa. |
| `return` | Returned to the item editor. | Đã quay lại trình chỉnh sửa mục. |
| `removeTitle` | Remove this saved file? | Xóa tệp đã lưu này? |
| `removeBody` | The file will be removed from this item. Space is freed after cleanup. | Tệp sẽ bị xóa khỏi mục này. Dung lượng được giải phóng sau khi dọn dẹp. |
| `keep` | Keep file | Giữ tệp |
| `leaveTitle` | Leave uploads? | Rời màn hình tải lên? |
| `leaveBody` | Leaving cancels unfinished uploads. Confirmed files stay on the item. Space is freed after cleanup. | Rời màn hình sẽ hủy các lượt tải chưa hoàn tất. Tệp đã được xác nhận vẫn ở trong mục. Dung lượng được giải phóng sau khi dọn dẹp. |
| `stay` | Stay here | Ở lại đây |
| `leave` | Leave and cancel | Rời đi và hủy |
| `select` | Select file | Chọn tệp |
| `savedCount` | Only Saved files are confirmed by the server. | Chỉ tệp có trạng thái Đã lưu mới được máy chủ xác nhận. |
| `long` | The upload could not finish because the connection was interrupted before the server confirmed that this file was saved. Try again to restart the upload. | Không thể hoàn tất lượt tải lên vì kết nối đã bị gián đoạn trước khi máy chủ xác nhận rằng tệp này đã được lưu thành công. Hãy thử lại để bắt đầu tải tệp lên từ đầu. |
| `queueCounts` | Photos {photos} of 24 · Video {videos} of 1 | Ảnh {photos}/24 · Video {videos}/1 |
| `capPhoto` | Not added: the 24-photo limit has been reached. | Không được thêm: đã đạt giới hạn 24 ảnh. |
| `capVideo` | Not added: the 1-video limit has been reached. | Không được thêm: đã đạt giới hạn 1 video. |

### Limits and owner preview behavior

- **Confirmed:** wishes 40/500, Q34c; pending hidden, Q34d; wish limits, Q75 and Q78 (per-IP limit 20); guest-account cap 50, Q38; video ≤50 MB and approximately 25 MB target, Q27.
- **Existing project budget:** 1 GB storage, PRD §8 via plan §3. Display server accounting, including reservations and pending deletion; do not estimate free space from visible files alone.
- **Unapproved Q66 proposal:** 12 album pages, 24 photos, one video, one voice note, 600 characters per text box, three stickers per page. Label these proposed in design boards; do not present them as settled product limits.
- **Owner preview:** distinguish published guest view from draft preview. Theme switching in preview does not save the page theme, publish drafts or expose birth data. Offer phone/tablet/laptop frames on larger screens; phone preview uses the actual available width.
- **Moderation states:** only O7 receives pending/rejected bodies. G5 preview obeys the same approved-only boundary as guests.
- **Keyboard:** semantic headings, labelled forms, visible focus, keyboard reorder alternatives, modal focus containment and restoration. Progress announcements describe meaningful stages rather than every percentage point.
- **Cross-links:** O5→O6 media; O2/O6→O10 usage; O2→O7 moderation; O12→O11/O14/O15; O13→O3/O4/O8. O8/O9 retain existing access and confirmation rules.

## 2. O18 — Wording preview completion (prepared locally, 2026-10-27)

The editing contract and 27-field catalogue live in [editable wording §4](vegenus_editable_copy.md). The plain owner shell contains four labelled A–D preview buttons with pressed states and 44 px minimum targets. Switching them preserves draft text, progress, editing language and publication state; it does not change the page theme. No new modal or animation is introduced, so focus stays on the chosen button and Escape has nothing new to dismiss.

Phone keeps the collapsible preview after the form. Tablet places form and preview alongside one another. Laptop keeps section navigation, form and preview in three columns; below laptop width it removes the navigation rail, and at narrow widths the preview follows the form. Context snippets show section intros and empty wording, updates, a browser tab, a shared link and an email. Empty editor fields remain visibly incomplete rather than silently using the example as saved content.

The three revised O18 boards are local review artifacts. Canvas synchronization and live-art checks remain pending; see [editable wording §6.1](vegenus_editable_copy.md#61-local-completion-prepared-2026-10-27-canvas-synchronization-pending).
