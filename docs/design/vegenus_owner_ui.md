# Owner UI design: setup, content, moderation and account

**Status:** v1.0, **Approved by the owner 2026-10-28 (Phase 0 sign-off).** Documentation only; no application code. Lead design by Codex, edited by Claude. Placeholders only (rule 3).
**Look:** one plain look for every theme (PRD Q56), system fonts, no themed backgrounds, one shared account for both partners (Q35). Guest previews inside the owner area use the guest composition in a neutral shell. Related: [screens](vegenus_screens.md) (O1-O15 and the responsive matrix), [guest UI](vegenus_guest_ui.md) (shared shell and state contract in §6), [guest motion](vegenus_guest_motion.md) (owner micro-motions in §10.2).
**Canvas:** page 10, boards OwnerDash, OwnerQueue, OwnerSetup, OwnerLogin at phone, tablet and laptop (plus the older DashNeutral, DashThemed, EditA, EditLapA). DashThemed is obsolete after Q56. Not yet built as boards: O14 email, O15 guest accounts (modules inside OwnerDash only).

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
| **O10 — Usage** | (Egress and the job panel: see the T2.5 section below, Q145.) Storage and egress panels with numeric used/limit values and labelled meters; warnings at 60% and 80% per inventory/plan. Phone stacks; tablet/laptop compare side by side. Include storage held by uploads or pending deletion where available. “Usage unavailable / Chưa tải được mức sử dụng” is distinct from zero. Show last successful refresh, not invented live precision. Link full storage to O4/O6; no automatic deletion or purchase. |
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

### O6 Upload for T2.3b (2026-11-14, approved by the owner 2026-11-14, Q139)

Boards: OwnerUpload, OwnerUploadTab and OwnerUploadLap on canvas page 10 "Owner area" (Theme Preview version 112), each with a `reviewState` picker for 28 states. Codex lead design, Claude review and render; working copies, generator and checks in the git-ignored `.design/o6/`. Open points decided as defaults pending the owner: PRD Q139.

- **Placement and flow:** opened from one item in O5 ("Add photos or video"); Back and Done return to that item. Owner look and tokens as O2/O3. The owner picks files, then "Start uploads"; each file is prepared in the browser (`src/lib/media.ts`), uploaded and confirmed.
- **Compositions:** phone stacks the picker, queue rows and storage panel; tablet adds a selected-file details column with storage; laptop adds the item context column (item title) on the left. Tablet and laptop fall back to one column below 700 px.
- **Row states:** Waiting; Preparing photo / Preparing video (no percent: the browser gives none); Photo prepared (the "Location data removed" note appears only from here on); Uploading (a `<progress>` showing the value, its accessible name holds the file name); Confirming with the server; Saved (only a server-confirmed file is called saved); Unsupported, with HEIC and "this browser can't compress video" variants (Remove only, no Try again); Too large (video over 50 MB after compression); Upload interrupted or expired (Try again starts a new upload, Q139); Canceled ("Space is freed after cleanup."); Not saved (503, Try again).
- **Screen states:** default; empty; loading; read failure; count cap (25th photo or 2nd video refused by name); storage at 80 % (amber) and full (nothing added; deleted media keep counting until cleanup; View usage); offline (queue kept, new uploads paused, resumes on reconnect; connectivity is tracked apart from other blocks, so reconnecting never lifts a 401, 403 or storage-full block); session expired (401: queue kept, uploads paused, sign in again); access lost (403 with Log out); remove confirmation and leave-while-uploading dialogs (native modals, Esc keeps the file or stays); long Vietnamese; all done (the notice clears as soon as an unconfirmed file is added). Server numbers only, never an estimate.
- **Accessibility:** one polite region announces each stage change once (never every percent; simultaneous changes in one update); an alert region announces blocking errors once; a failing row never takes focus; when the focused control disappears or is disabled, focus moves to the same row's next action, else the selected file, else Back; filenames inherit the page language; the two side panels are named landmarks.
- **Checks (2026-11-14):** the board logic checks (84 board and state cases plus 18 regression checks per board (R1-R12, V1-V6), each seen failing first) pass; rendered in Chromium 156 and WebKit 27.2, every state of every board at its own size and at 320 px with a 200 % root font: no sideways scroll, no clipped box, no target under 44 px, no axe violation, no console error (168 cases per engine). Codex adversarial review: five rounds, every finding fixed except round 5's two, stopped there at the owner's request (2026-11-14) and kept as known issues for the screen build: the recovery buttons (Try again after a read failure, Reconnect, Sign in again) leave focus on the document after the redraw, and three bilingual `aria-label`s (the two side panels and the progress bar) have no language boundary, so the screen should use `aria-labelledby` on `lang`-marked text.

- **Built (2026-11-20, `feature/owner-upload-screen`):** `src/app/app/upload.tsx`, a view of `/app` opened from O5's "Add photos or video" (saved items only); queue rules in `src/lib/upload.ts`; copy under `upload.*` in `copy.ts` (the three "used" lines are one template, "refused" is built per file from capPhoto and capVideo). `processPhoto` and `processVideo` now also return the stored size (and the clip's length) sent with Complete. The amber warning colours are three owner tokens in `themes/neutral/tokens.css`. Round 5's known issues are handled: after a recovery button disappears focus goes to Back, and the side panels and progress bar are named through `aria-labelledby`. Build defaults: Q143.

Copy approved by the owner on 2026-11-14 (EN and VI as drawn; shipped strings marked as such in `.design/o6/COPY.md`):

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

### O4 Content list and O5 Item editor (2026-11-14, boards drawn; approved by the owner 2026-11-20, Q140)

Boards: OwnerContent and OwnerItem at phone, tablet and laptop on canvas page 10 "Owner area" (Theme Preview version 113); 12 O4 states and 30 O5 states in each board's `reviewState` picker. Codex lead design, Claude review and render; working copies, generator and checks in the git-ignored `.design/o4-o5/`. Owner decisions (2026-11-14, Q140): O5 is the simple editor the T2.2 database supports (the album editor with pages, layouts, slots, text boxes and stickers is a later unit); items are listed by date with no manual reorder.

- **O4:** reached from the dashboard's Content link, Back to O2. Two sections: Memories (kind memory, newest first) and Together (milestone and anniversary, oldest first, a timeline). Each row: title (wraps), kind in Together, date at its precision (day, month or year, never a fake day), Draft or Published, and "Unpublished changes" when a published item has saved edits guests do not see yet (derived from the saved version differing from the published one). Open, New item, Publish/Unpublish from the list; a badge changes only after the server confirms. Phone stacks records; tablet two regions; laptop sections, list and the selected item. States: default, empty per section, loading, read failure (never shown as empty), offline (last confirmed list, actions blocked), access lost, status change in progress and confirmed, 409 (the list re-reads; never says which change happened), long Vietnamese. No item-count limit.
- **O5:** new (kind chosen first: Memory, or Milestone or Anniversary in Together; locked after the first save) or existing. Title 1-120 (a wrapped echo shows a long title in full), text up to 5,000, date required with precision (month and year store the first day), Anniversary always day precision with "repeats every year", "remind me" and a non-leap-year hint on 29 Feb; optional second language (a language other than the main one, preselected when switched on; title and text; removing it drops its photo alt text, and the remove action says so). Media through O6 once the item is saved ("Save the draft first to add photos" before that); a thumbnail list with alt text per photo per language (up to 300) and Remove with confirmation ("Space is freed after cleanup."). Save draft and Publish enable only on real changes; Publish saves unsaved edits first; Unpublish; Delete with confirmation (photos and video go too). States: new, editing, validation errors (each on the control that is actually invalid, one summary, focus to the first invalid control), saving, saved draft, publishing, published, published with unpublished changes, unpublish and delete confirmations, conflict 409 (the screen re-reads a complete confirmed item, including media and alt text, and offers Reload saved or Keep mine without saying whether it was edited or deleted), not found (same wording whatever the reason), 400 (one generic message), 503 (input kept, Try again), 401, 403, offline, leave with unsaved changes (Esc keeps writing), long Vietnamese, Anniversary on 29 Feb.
- **Accessibility:** as O6, plus bilingual accessible names through `aria-labelledby` on `lang`-marked text (never a bilingual `aria-label`), user content never marked English, empty headings omitted, radio and checkbox targets measured by their 44 px label.
- **Build needs found in the design:** the item read and list returned no media, and no route updated alt text (done on `feature/owner-content-db`, 2026-11-20: the item read carries finished media with alt text and a signed preview URL; alt text is saved with the item through `owner_item_save(..., alts)` under its version, in place of a separate `owner_media_update`; the list is ordered by date); a new item needs its first save before media can attach (`media.item_id` is required); the album editor and any reorder have no schema or route (out of scope by Q140).
- **Built (2026-11-20, `feature/owner-content-screens`):** `src/app/app/content.tsx` (O4) and `item.tsx` (O5), views of `/app` reached from the dashboard's Content button; rules in `src/lib/content.ts`; copy under `content.*` in `copy.ts`. The owner pages' CSP admits the Supabase origin in `img-src` so signed previews load (guest pages unchanged). Choosing the second language as the main one swaps both languages' title, text and alt text (Q141 default 2). Build defaults: Q142.
- **Checks (2026-11-14):** board logic checks 7,326 assertions across 126 board and state cases, each fix's check seen failing first; rendered in Chromium 156 and WebKit 27.2 for every state at its own size and at 320 px with a 200 % root font: WebKit clean (252 cases), Chromium clean except a long title scrolling inside its input (accepted, as O3's long names: the wrapped echo shows it in full). Codex adversarial review: five rounds (6, 3, 2, 1 findings, then approve with none); all fixed.

Copy approved by the owner on 2026-11-20 (EN and VI as drawn; source `.design/o4-o5/COPY.md`):

| Key | English | Vietnamese |
|---|---|---|
| `content` | Content | Nội dung |
| `editor` | Item editor | Sửa nội dung |
| `back` | Back | Quay lại |
| `close` | Close | Đóng |
| `logout` | Log out | Đăng xuất |
| `memorySection` | Memories | Kỷ niệm |
| `together` | Together | Bên nhau |
| `memory` | Memory | Kỷ niệm |
| `milestone` | Milestone | Cột mốc |
| `anniversary` | Anniversary | Ngày kỷ niệm |
| `loading` | Loading… | Đang tải… |
| `read` | Couldn’t load this. Try again. | Chưa tải được. Thử lại. |
| `retry` | Try again | Thử lại |
| `offline` | You’re offline. Reconnect to continue. | Bạn đang ngoại tuyến. Kết nối lại để tiếp tục. |
| `stale` | This list may be out of date. | Danh sách này có thể chưa được cập nhật. |
| `access` | Access is no longer available. | Quyền truy cập không còn hiệu lực. |
| `notSaved` | Not saved. Your changes are still here. | Chưa lưu được. Nội dung bạn sửa vẫn còn ở đây. |
| `saving` | Saving… | Đang lưu… |
| `firstMemory` | Add your first memory | Thêm kỷ niệm đầu tiên |
| `firstTogether` | Add your first moment together | Thêm dấu mốc bên nhau đầu tiên |
| `save` | Save draft | Lưu bản nháp |
| `publish` | Publish | Đăng |
| `unpublish` | Unpublish | Gỡ đăng |
| `draft` | Draft | Bản nháp |
| `published` | Published | Đã đăng |
| `changes` | Unpublished changes | Thay đổi chưa đăng |
| `changesHint` | Unpublished changes: guests still see the last published version | Thay đổi chưa đăng: khách vẫn thấy phiên bản đã đăng gần nhất |
| `conflict` | This item changed elsewhere | Nội dung đã được sửa ở nơi khác |
| `keepMine` | Keep mine | Giữ bản của tôi |
| `reload` | Reload saved | Tải lại bản đã lưu |
| `conflictHint` | The saved item was re-read. Your input is kept below; choose which version to continue with. | Đã đọc lại nội dung đã lưu. Phần bạn nhập vẫn ở bên dưới; hãy chọn bản để tiếp tục. |
| `listConflict` | This item changed elsewhere. The list has been refreshed. | Nội dung đã được sửa ở nơi khác. Danh sách đã được tải lại. |
| `addMedia` | Add photos or video | Thêm ảnh hoặc video |
| `cleanup` | Space is freed after cleanup. | Dung lượng được giải phóng sau khi dọn dẹp. |
| `newItem` | New item | Nội dung mới |
| `newest` | By date, newest first | Theo ngày, mới nhất trước |
| `oldest` | By date, oldest first | Theo ngày, cũ nhất trước |
| `open` | Open | Mở |
| `sections` | Sections | Các mục |
| `selected` | Selected item | Nội dung đang chọn |
| `preview` | Guest preview | Xem trước cho khách |
| `previewHint` | Working copy only. Guests see changes after Publish succeeds. | Chỉ là bản đang sửa. Khách thấy thay đổi sau khi đăng thành công. |
| `empty` | No items in this section yet. | Mục này chưa có nội dung. |
| `statusPending` | Updating status… | Đang cập nhật trạng thái… |
| `statusDone` | Status updated. | Đã cập nhật trạng thái. |
| `kind` | Kind | Loại nội dung |
| `kindHint` | Kind is locked after the first save. | Loại nội dung cố định sau lần lưu đầu tiên. |
| `title` | Title | Tiêu đề |
| `text` | Text | Nội dung chữ |
| `date` | Date | Ngày tháng |
| `precision` | Date precision | Độ chính xác ngày tháng |
| `day` | Day | Ngày |
| `month` | Month | Tháng |
| `year` | Year | Năm |
| `dateHint` | Enter year, month and day as required by the chosen precision. | Nhập năm, tháng và ngày theo độ chính xác đã chọn. |
| `yearField` | Year | Năm |
| `monthField` | Month | Tháng |
| `dayField` | Day | Ngày |
| `required` | Required · 1–120 characters after trimming | Bắt buộc · 1–120 ký tự sau khi bỏ khoảng trắng đầu và cuối |
| `textHint` | Optional · up to 5,000 characters | Không bắt buộc · tối đa 5.000 ký tự |
| `second` | Add a second language | Thêm ngôn ngữ thứ hai |
| `mainLanguage` | Main language | Ngôn ngữ chính |
| `language` | Second language | Ngôn ngữ thứ hai |
| `secondTitle` | Second-language title | Tiêu đề ngôn ngữ thứ hai |
| `secondText` | Second-language text | Nội dung chữ ngôn ngữ thứ hai |
| `secondHint` | Choose a different language and complete both fields, or remove the second language. | Chọn ngôn ngữ khác và điền cả hai trường, hoặc bỏ ngôn ngữ thứ hai. |
| `removeSecondHint` | Removing the second language also removes its photo alt text from the saved item. | Bỏ ngôn ngữ thứ hai cũng xóa văn bản thay thế ảnh của ngôn ngữ đó khỏi nội dung được lưu. |
| `vi` | Vietnamese | Tiếng Việt |
| `en` | English | Tiếng Anh |
| `repeat` | Repeats every year | Lặp lại hằng năm |
| `remind` | Remind me | Nhắc tôi |
| `leap` | In non-leap years, 29 Feb appears on 28 Feb. | Trong các năm không có ngày 29 tháng 2, ngày này hiển thị vào 28 tháng 2. |
| `media` | Photos and video | Ảnh và video |
| `limits` | Per memory: up to 24 photos and 1 video. | Mỗi kỷ niệm: tối đa 24 ảnh và 1 video. |
| `saveFirst` | Save the draft first to add photos | Lưu bản nháp trước để thêm ảnh |
| `alt` | Photo alt text | Văn bản thay thế cho ảnh |
| `altHint` | Describe what matters in the photo for people who cannot see it. Up to 300 characters per language. | Mô tả điều quan trọng trong ảnh cho người không thể xem ảnh. Tối đa 300 ký tự mỗi ngôn ngữ. |
| `remove` | Remove | Xóa tệp |
| `removeTitle` | Remove this file? | Xóa tệp này? |
| `removeBody` | This file will be removed from the item. | Tệp này sẽ bị xóa khỏi nội dung. |
| `keepFile` | Keep file | Giữ tệp |
| `delete` | Delete | Xóa nội dung |
| `deleteTitle` | Delete this item? | Xóa nội dung này? |
| `deleteBody` | The item and its photos and video will be deleted. | Nội dung cùng ảnh và video sẽ bị xóa. |
| `cancel` | Cancel | Hủy |
| `unpublishTitle` | Unpublish this item? | Gỡ đăng nội dung này? |
| `unpublishBody` | Guests will stop seeing this item after the server confirms. | Khách sẽ ngừng thấy nội dung này sau khi máy chủ xác nhận. |
| `leaveTitle` | Leave without saving? | Rời đi khi chưa lưu? |
| `leaveBody` | Your unsaved changes will be discarded. | Những thay đổi chưa lưu sẽ bị bỏ. |
| `keepWriting` | Keep writing | Tiếp tục viết |
| `discard` | Discard | Bỏ thay đổi |
| `notFound` | This item is no longer available | Nội dung này không còn khả dụng |
| `generic` | Couldn’t save this. Review your input before saving again. | Chưa lưu được. Kiểm tra nội dung nhập trước khi lưu lại. |
| `session` | Sign in again. Your input is kept here. | Đăng nhập lại. Phần bạn nhập vẫn được giữ ở đây. |
| `signin` | Sign in again | Đăng nhập lại |
| `errors` | Check the highlighted fields before saving. | Kiểm tra các trường được đánh dấu trước khi lưu. |
| `titleError` | Enter a title of 1–120 characters. | Nhập tiêu đề từ 1–120 ký tự. |
| `textError` | Use no more than 5,000 characters. | Nhập tối đa 5.000 ký tự. |
| `dateError` | Enter a valid date at the selected precision. | Nhập ngày tháng hợp lệ theo độ chính xác đã chọn. |
| `secondError` | Choose a different language and complete the title and text. | Chọn ngôn ngữ khác và điền đủ tiêu đề cùng nội dung chữ. |
| `altError` | Use no more than 300 characters per language. | Nhập tối đa 300 ký tự mỗi ngôn ngữ. |
| `saved` | Draft saved. | Đã lưu bản nháp. |
| `publishing` | Publishing… | Đang đăng… |
| `publishedDone` | Published. | Đã đăng. |
| `unpublishedDone` | Unpublished. | Đã gỡ đăng. |
| `deleted` | Item deleted. | Đã xóa nội dung. |
| `removing` | Removing… | Đang xóa tệp… |
| `deleting` | Deleting… | Đang xóa nội dung… |
| `removed` | File removed. | Đã xóa tệp. |
| `simulation` | Interactive design only. Server responses and navigation are simulated; no data leaves this board. | Chỉ là thiết kế tương tác. Phản hồi máy chủ và điều hướng được mô phỏng; không có dữ liệu rời bản này. |
| `confirmResponse` | Confirm server success in preview | Xác nhận máy chủ thành công trong bản xem trước |
| `respondConflict` | Respond with 409 in preview | Mô phỏng phản hồi 409 |
| `respond503` | Respond with 503 in preview | Mô phỏng phản hồi 503 |
| `returnEditor` | Return to editor | Trở lại trình sửa |
| `uploadDestination` | O6 · Upload destination | O6 · Nơi thêm tệp |
| `uploadHint` | The approved upload flow opens here after the first save. Return keeps the working copy. | Luồng tải lên đã duyệt mở ở đây sau lần lưu đầu tiên. Khi trở lại, bản đang sửa được giữ nguyên. |
| `dashboard` | O2 · Dashboard destination | O2 · Nơi tổng quan |
| `loginDestination` | Sign-in destination · input kept | Nơi đăng nhập · giữ phần đã nhập |
| `returnSignedIn` | Return signed in | Trở lại sau khi đăng nhập |
| `noMedia` | No media yet. | Chưa có ảnh hoặc video. |
| `savedVersion` | Re-read saved version | Bản đã lưu vừa đọc lại |
| `working` | Working copy | Bản đang sửa |
| `unchanged` | No saved version yet. | Chưa có bản đã lưu. |
| `statusLabel` | Status | Trạng thái |

### O17 Home editor and the O2 Home card for T2.4 (2026-11-20, approved by the owner 2026-11-20, Q144)

Boards: OwnerHome, OwnerHomeTab and OwnerHomeLap (O17, 46 review states each), OwnerDashHome, OwnerDashHomeTab and OwnerDashHomeLap (the approved O2 boards plus a Home card with 8 states) on canvas page 10 "Owner area", and HomeStates A-D at phone, tablet and laptop (the approved G1 boards with the Home states) on the Home page (Theme Preview version 117). Codex lead design, Claude review and render; working copies, brief, checks and reviews in the git-ignored `.design/home/`. Owner decision (2026-11-20, Q144): Home photos are picked from the ready photos of published memories; no upload on Home. The defaults Claude drew (Q144 1-23) were approved by the owner with the boards and copy on 2026-11-20.

- **Entry (O2):** a Home card beside Content. Its states: no Home yet ("Set up Home"), draft not published yet (no counter claim), published, published with unpublished changes, no start date, "Counter starts on [DATE]", "Day [N] together", and read failure with its own Try again (never a misleading zero). O2 reads Home before it shows a status or counter; the card shows the published Home.
- **Editor (O17):** its own view, Back to O2. No title field (the couple title comes from the partner names). Together since (optional date; the page time zone shown read-only beside it, Q115). Welcome note, optional, up to 600 characters per language, main language plus an optional second language (a missing second note falls back to the main one). Photo stack: 3-7 picks recommended (fewer allowed with the hint "Pick 3 to 7 photos."), each with Move up, Move down and Remove from stack; the first guest-visible pick is labelled Cover. Save draft, Publish and Unpublish as O5 (Publish saves first, then publishes, with a status for each step); no Delete. A guest preview column uses the working copy and the published Wording strings (greeting and days line, marked as placeholders); after Unpublish it switches to "What guests see now".
- **Photo picker:** a dialog listing only ready photos of published memories, grouped by memory (title and date); each tile is a real checkbox named by the memory's alt text, or "No description yet" with the hint that descriptions are edited on the memory. Choices are staged until "Use these photos"; Close and Esc discard them and return focus to Choose photos. At 7 the remaining tiles are disabled with the reason; hidden picks use a slot, and the picker says to remove one from the stack. States: default, empty (with a link to Content, behind the unsaved-changes check), limit reached, loading, read failure (Try again reads fresh before announcing success).
- **Hidden and deleted picks:** a pick whose memory is unpublished stays in the owner's stack as "Hidden: its memory is unpublished" and guests skip it; a photo that no longer exists drops out on the next read with one notice giving the count. A failed read keeps the picks and is never treated as deletion. One ordered list of eligible picks gives the guest cover, stack and position total.
- **Guest Home states (HomeStates A-D, 20 review states):** default, no photos, no note, neither (the fixed notices `preview.photos` and `preview.note`), two photos, seven photos, a hidden pick, no start date, future start (no counter), start today (Day 1), unpublished or never published (the couple title and greeting only; the menu and enabled sections stay), all picks hidden, a description in the other language only, a repeated days token, reduced motion, long Vietnamese. Photo alt text uses the shown language, then the other language with its own `lang`, then empty alt; "No description yet" is owner-only.
- **Errors and recovery:** validation (each over-long note marked on its control, one summary, focus to the first), 400 generic, 401 (sign in in a new tab, input kept, Try again resumes), 403 (Log out), 404, 409 (the complete saved Home is re-read; the panel says which of date, note, language, photos and status changed; Reload saved or Keep mine, both disabled until the re-read succeeds), a second session's first create (the existing Home with the 409 panel, review state "Created elsewhere"), 503 and no answer (the operation, its payload and revision are kept; Try again re-reads first and shows Saved, Published or Unpublished if the attempt landed, otherwise resends the original payload; later edits stay unsaved and are never sent with the retry), offline (input kept, actions paused; reconnecting keeps any unresolved failure and its recovery action), leave with unsaved changes, unpublish confirmation (Home will show the couple title and greeting).
- **Accessibility:** as O5 and O6: 44 px targets, visible focus, Esc closes dialogs and returns focus to the opener, focus never drops to the page after a list redraw (a moved pick keeps focus on the same Move button, or its row when that button is now disabled; Remove moves focus to the next pick's Remove, else the previous one's), one polite status region and one alert region, bilingual names through `aria-labelledby` on `lang`-marked text, a focusable scroll region in the picker, reduced motion.
- **Build needs found in the design:** a table for the picks and their order (replacing `cover_media_id`); `owner_item_save` must accept kind `home`; the item status and delete routes do not check the kind (Home has no Delete); the 600-character note cap per language; the Home read must return each pick's photo state and its memory's publication status; design 3 §3.3 and screens G1 to be updated.
- **Checks (2026-11-20):** board logic checks 1,166 assertions on the three O17 boards (each fix's check seen failing first; `.design/home/check-home.cjs`); rendered in Chromium for every review state at the board's own size and, for owner boards, at 320 px with a 200 % root font: OwnerHome 276 cases, OwnerDashHome and guest boards 612 cases, no sideways scroll, no clipped box, no target under 44 px, no axe violation (WCAG 2.2 AA), no console error. WebKit not run locally (missing system libraries); the guest boards are fixed artboards, so their 320 px reflow belongs to the guest build. Codex adversarial review: five rounds plus a confirmation (round 6: approve), every valid finding fixed. Carried to the Phase 3 guest build (behaviours of the approved G1 this design does not change): guest menu focus and Esc, the reduced-motion preference, and guest loading, read failure and offline.

Copy approved by the owner on 2026-11-20 (EN and VI as drawn; shipped strings reused as listed in `.design/home/COPY.md`; braces are interpolation tokens):

| Key | English | Vietnamese |
|---|---|---|
| `home.start` | Together since | Bên nhau từ |
| `home.noDate` | No start date | Chưa có ngày bắt đầu |
| `home.future` | Counter starts on {date} | Bộ đếm bắt đầu vào {date} |
| `home.day` | Day {days} together | Ngày thứ {days} bên nhau |
| `home.note` | Welcome note | Lời nhắn chào mừng |
| `home.noteHint` | Optional · up to 600 characters per language | Không bắt buộc · tối đa 600 ký tự mỗi ngôn ngữ |
| `home.noteError` | Use no more than 600 characters. | Nhập tối đa 600 ký tự. |
| `home.fallback` | Optional · up to 600 characters. If blank, guests see the main-language note. | Không bắt buộc · tối đa 600 ký tự. Nếu bỏ trống, khách thấy lời nhắn bằng ngôn ngữ chính. |
| `home.secondRule` | Choose a different language or remove the second language. | Chọn ngôn ngữ khác hoặc bỏ ngôn ngữ thứ hai. |
| `home.photos` | Photo stack | Chồng ảnh |
| `home.pickHint` | Pick 3 to 7 photos. | Chọn từ 3 đến 7 ảnh. |
| `home.choose` | Choose photos | Chọn ảnh |
| `home.altHint` | Edit photo descriptions on the memory. | Sửa mô tả ảnh trong kỷ niệm. |
| `home.cover` | Cover | Ảnh bìa |
| `home.hidden` | Hidden: its memory is unpublished | Bị ẩn: kỷ niệm chứa ảnh đã gỡ đăng |
| `home.up` | Move up | Đưa lên |
| `home.down` | Move down | Đưa xuống |
| `home.remove` | Remove from stack | Bỏ khỏi chồng ảnh |
| `home.noDescription` | No description yet | Chưa có mô tả |
| `home.next` | Show next photo | Xem ảnh tiếp theo |
| `home.stackUpdated` | Photo stack updated. | Đã cập nhật chồng ảnh. |
| `home.selected` | {count} of 7 photos selected | Đã chọn {count} trên 7 ảnh |
| `home.limit` | Limit reached. Remove a selected photo to choose another. | Đã đạt giới hạn. Bỏ một ảnh đã chọn để chọn ảnh khác. |
| `home.pickerEmpty` | No published photos yet. Publish a memory with photos first. | Chưa có ảnh đã đăng. Hãy đăng một kỷ niệm có ảnh trước. |
| `home.unpublishing` | Unpublishing… | Đang gỡ đăng… |
| `home.new` | No Home yet | Chưa thiết lập Trang chủ |
| `home.edit` | Edit Home | Sửa Trang chủ |
| `home.setup` | Set up Home | Thiết lập Trang chủ |
| `home.reconnect` | Reconnect | Kết nối lại |
| `home.usePhotos` | Use these photos | Dùng những ảnh này |
| `home.saveUnconfirmed` | Save outcome could not be confirmed. Try again to check. | Chưa thể xác nhận kết quả lưu. Chọn Thử lại để kiểm tra. |
| `home.publishUnconfirmed` | Publish outcome could not be confirmed. Try again to check. | Chưa thể xác nhận kết quả đăng. Chọn Thử lại để kiểm tra. |
| `home.unpublishUnconfirmed` | Unpublish outcome could not be confirmed. Try again to check. | Chưa thể xác nhận kết quả gỡ đăng. Chọn Thử lại để kiểm tra. |
| `home.unpublishFailed` | Home was not unpublished. | Trang chủ chưa được gỡ đăng. |
| `home.previewWorking` | Preview switched to Working copy. | Bản xem trước đã chuyển sang bản đang sửa. |
| `home.publishFailed` | Your draft is saved, but Home was not published. | Bản nháp đã được lưu, nhưng Trang chủ chưa được đăng. |
| `home.unpublishBody` | On Home, guests will see the couple title and greeting. Photos, the welcome note and the counter will be hidden. The menu and enabled sections stay available. | Trên Trang chủ, khách thấy tên hai bạn và lời chào. Ảnh, lời nhắn chào mừng và bộ đếm sẽ được ẩn. Menu và các mục đã bật vẫn khả dụng. |
| `home.unpublishOffline` | Reconnect before confirming Unpublish. | Kết nối lại trước khi xác nhận gỡ đăng. |
| `home.hiddenLimit` | Limit reached. Close the picker and remove a hidden photo from the stack to free a slot. | Đã đạt giới hạn. Đóng bộ chọn rồi bỏ một ảnh ẩn khỏi chồng ảnh để có thêm chỗ. |
| `home.deleted` | Deleted photos removed from the stack: {count}. | Số ảnh đã xóa được bỏ khỏi chồng ảnh: {count}. |
| `home.photoMoved` | Moved to position {position}. | Đã chuyển đến vị trí {position}. |
| `home.photoRemoved` | Removed from the stack. | Đã bỏ khỏi chồng ảnh. |
| `home.photoShown` | Showing photo {position}. | Đang xem ảnh {position}. |
| `home.removeSecondHint` | Saving will remove the second-language note. | Khi lưu, lời nhắn bằng ngôn ngữ thứ hai sẽ bị xóa. |
| `home.statusLabel` | Publication status | Trạng thái đăng |
| `home.afterUnpublish` | What guests see now | Nội dung khách đang thấy |
| `home.photosReady` | Published photos loaded. | Đã tải ảnh đã đăng. |
| `home.connected` | Connection restored. | Đã kết nối lại. |
| `home.loaded` | Saved Home loaded. | Đã tải Trang chủ đã lưu. |
| `home.kept` | Your input is kept. | Phần bạn nhập vẫn được giữ. |
| `home.wordingPointer` | The published greeting and days line shown here are Wording placeholders. | Lời chào và dòng đếm ngày đã đăng ở đây là nội dung minh họa cho Lời văn. |
| `home.sessionReady` | Signed in for this preview. Return to Home and choose Try again. | Đã đăng nhập cho bản xem trước này. Quay lại Trang chủ và chọn Thử lại. |
| `home.photoNumber` | Photo {number} | Ảnh {number} |
| O2 draft status | Draft · not published yet | Bản nháp · chưa đăng |
| O2 changed status | Published · Unpublished changes | Đã đăng · Thay đổi chưa đăng |
| O2 Home read result | Home loaded. | Đã tải Trang chủ. |
| `home.created` | Home was created elsewhere | Trang chủ đã được tạo ở nơi khác |
| `home.unpublished` | Unpublished | Đã gỡ đăng |
| `home.position` | Photo {position} of {total} | Ảnh {position} trên {total} |

### O10 Usage and the O2 attention line for T2.5 (2026-11-21, approved by the owner 2026-11-21, Q145)

Boards: OwnerUsage, OwnerUsageTab and OwnerUsageLap (O10, 25 review states each), OwnerDashUsage, OwnerDashUsageTab and OwnerDashUsageLap (the O2 boards with the Home card plus an attention line and a Usage entry) on canvas page 10 "Owner area" (Theme Preview version 119). Codex lead design, Claude review and render; working copies, brief, checks and reviews in the git-ignored `.design/usage/`. Owner decision (2026-11-21): alerts appear in the owner area, plus a scheduled GitHub check that emails the owner; no email vendor (Q37 parked). Claude's defaults: Q145 1-19.

- **Supersedes the O10 row above:** egress is not measured in the app (Supabase shows it only on its organisation usage page). O10 shows the free monthly quota (5 GB, whole Supabase organisation) and an "Open Supabase usage" link (new tab), never a meter or a percentage.
- **One owner read for O2 and O10** returns a snapshot: total, budget, uploading and waiting-to-be-deleted bytes (both included in the total), the server's read time, the page creation time, the page time zone, the last attempt's time and result (200, 200 with a failed deletion, 503), the last success's time and its correction count (orphans plus resized), and whether any run exists. Loading, network failure, 401 and 403 are read outcomes outside the snapshot. The full contract and the derivation rules are in `.design/usage/CHECKS.md`; the boards' `deriveUsage(snapshot)` can be lifted.
- **Storage (O10):** MB as O6 shows them (MiB, the unit of the 900 MiB budget); levels on raw bytes: normal under 60 %, notice at 60 %, warning at 80 %, full at 100 % or more (meter capped); the used figure rounds down; a non-zero amount under 1 MB reads "<1 MB"; a zero budget has its own message and no Content or Add links. The meter fill is neutral below 60 % and has a distinct treatment per level (3:1 against the track); the level is always also stated in text.
- **Daily job (O10):** missed = no successful run in the last 26 hours, measured from the last success (the same rule as the health route), outranking failed; a missed job whose last attempt failed also shows that attempt's time; no run at all is "has not run yet" while the page is under 26 hours old, then missed; failed = the last attempt answered 503 or failed a deletion while a success is under 26 hours old; corrections from the last success are neutral. Missed shows "What to do" (the Vercel cron log); the help line names the GitHub check.
- **O2:** one persistent attention line above the cards, only the highest of job missed, job failed, storage full or no allowance, storage at 80 %, each with View usage; 60 % and corrections show only on O10. A Usage entry shows "Storage [used] of [budget]" and View usage, with its own loading, read failure with Try again (never a zero) and offline states, independent of the Home card's retry.
- **Refresh, cache and recovery:** O2 and O10 share the last accepted snapshot and the last read outcome within the tab; Back (button or browser) shows them; offline and after reconnect the figures stay labelled with their time; cached attention says "Last known"; a read cut short by going offline or by a newer read is dropped; a first read interrupted by going offline restarts on reconnect; a read failure survives offline, reconnect and navigation until a read succeeds; after a 401 or 403 no figures or attention return until a fresh authorized read. 401 opens sign-in in a new tab and Try again resumes; 403 offers Log out, which ends on sign-in with focus on its heading.
- **Accessibility:** 44 px targets; one mounted polite status region announces each accepted refresh once (with "cleared", lower or higher attention) and each read failure; the attention line is static on load; focus stays on a surviving control after a redraw, else goes to Try again (described by the error) or the heading; controls that a connection change disables stay focusable with `aria-disabled` and an action-specific reason, and a press only repeats the reason; Back returns focus to the O2 control that opened O10; reflow at 320 px with 200 % text; reduced motion.
- **Build needs found in the design:** a `job_runs` table and the cron writing one row per run (and purging rows older than 30 days, Q45); the owner usage read above (uploading and deleting bytes are not returned by `owner_page()` today); `usageLevel` gains the 60 % notice and the zero-budget case; the health route and the scheduled workflow (Q145 6-7).
- **Build (T2.5b, 2026-11-21):** O10 offers Content at 80 % and full, as drawn, but no "Add photos or video" link: in the app O6 opens from one item, so adding starts in Content. The shared snapshot is state of the `/app` views (O2 and O10 are views, not pages), not session storage. The meter's 60 % fill is the neutral token `--meter-notice`. Also not built as drawn (found in review, left for a later unit): the browser's Back leaves `/app` (no `/app` view uses history yet, as in T2.1-T2.4); the O2 controls built before T2.5 (setup, Content, Edit Home, Home Try again, Log out) still use `disabled` offline, not the boards' focusable `aria-disabled`; Log out ends on `/login` as it does today, without moving focus to its heading.
- **Checks (2026-11-21):** board logic checks 823 assertions across the six boards (each fix's check seen failing first; `.design/usage/check-usage.cjs`); rendered in Chromium for every review state at the board's own size and at 320 px with a 200 % root font: 342 cases, no sideways scroll, no clipped box, no target under 44 px, no axe violation (WCAG 2.2 AA), no console error; real-browser focus probes (O2 focus kept after a retry; O10 Refresh kept focusable when the connection drops). WebKit not run locally (missing system libraries). Codex design review: 6 rounds, round 6 approve.

Copy approved by the owner on 2026-11-21 (EN and VI as drawn; [TIME] is a date and time in the page time zone; shipped strings reused: `upload.usage`, `upload.viewUsage`, `upload.title`, `content.content`, `navigation.back`, `content.signin`, `dashboard.logout`, `common.accessLost`, `common.offline`, `common.loading`, `common.tryAgain`):

| Key | English | Tiếng Việt |
| --- | --- | --- |
| `usage.title` | Usage | Mức sử dụng |
| `usage.refresh` | Refresh | Làm mới |
| `usage.updated` | Updated [TIME] | Đã cập nhật lúc [TIME] |
| `usage.announced` | Usage updated | Đã cập nhật mức sử dụng |
| `usage.readError` | Usage unavailable | Chưa tải được mức sử dụng |
| `usage.offline` | Offline, numbers from [TIME] | Ngoại tuyến, số liệu lúc [TIME] |
| `usage.refreshOffline` | Reconnect to refresh. | Kết nối lại để làm mới. |
| `usage.storageSummary` | Storage [used] of [budget] | Dung lượng đã dùng [used] trên [budget] |
| `usage.storageUsed` | [used] of [budget] used | Đã dùng [used] trên [budget] |
| `usage.empty` | No files yet. | Chưa có tệp nào. |
| `usage.notice` | Storage has reached 60%. | Dung lượng đã đạt 60%. |
| `usage.over80` | Storage is over 80%. Check page usage before adding more. | Đã dùng hơn 80% dung lượng. Kiểm tra dung lượng trang trước khi thêm tệp. |
| `usage.full` | Storage is full. Remove photos or videos in Content before adding more. Removed files still count until the daily job deletes them. | Dung lượng đã đầy. Hãy xóa ảnh hoặc video trong Nội dung trước khi thêm tệp. Tệp đã gỡ vẫn chiếm dung lượng cho đến khi tác vụ hằng ngày xóa chúng. |
| `usage.zeroBudget` | This page has no storage allowance. Uploads are unavailable. | Trang này không có hạn mức lưu trữ. Không thể tải tệp lên. |
| `usage.uploading` | Uploading: [size] | Đang tải lên: [size] |
| `usage.deleting` | Waiting to be deleted: [size] | Đang chờ xóa: [size] |
| `usage.heldIncluded` | included in the total above | đã tính trong tổng ở trên |
| `usage.egress` | Egress | Dữ liệu truyền ra |
| `usage.quota` | Free monthly quota: 5 GB (whole Supabase organisation) | Hạn mức miễn phí hằng tháng: 5 GB (toàn bộ tổ chức Supabase) |
| `usage.egressHelp` | See egress usage in Supabase. | Xem mức sử dụng dữ liệu truyền ra trên Supabase. |
| `usage.openSupabase` | Open Supabase usage | Mở mức sử dụng trên Supabase |
| `usage.newTab` | opens in a new tab | mở trong thẻ mới |
| `usage.job` | Daily job | Tác vụ hằng ngày |
| `usage.lastSuccess` | Last successful run: [TIME] (page time zone) | Lần chạy thành công gần nhất: [TIME] (múi giờ của trang) |
| `usage.noSuccess` | No successful run yet. | Chưa có lần chạy thành công. |
| `usage.jobOk` | Completed successfully. | Đã chạy thành công. |
| `usage.jobCorrected` | The check corrected [N] files. | Tác vụ kiểm tra đã điều chỉnh [N] tệp. |
| `usage.jobFailed` | The last daily job failed. Files may wait longer to be deleted. Next run around 03:00 UTC. | Lần chạy tác vụ hằng ngày gần nhất thất bại. Tệp có thể phải chờ lâu hơn mới được xóa. Lần chạy tiếp theo vào khoảng 03:00 UTC. |
| `usage.jobMissed` | No successful daily job in the last 26 hours. | Tác vụ hằng ngày chưa chạy thành công trong 26 giờ qua. |
| `usage.jobNever` | The daily job has not run yet. | Tác vụ hằng ngày chưa từng chạy. |
| `usage.jobSchedule` | Runs daily around 03:00 UTC (±1 hour). It keeps the database awake, expires stale uploads, checks stored files against their records and deletes removed files. | Tác vụ chạy mỗi ngày vào khoảng 03:00 UTC (±1 giờ) để giữ cơ sở dữ liệu hoạt động, kết thúc các lượt tải lên quá hạn, đối chiếu tệp đã lưu với bản ghi và xóa các tệp đã được gỡ bỏ. |
| `usage.whatToDo` | What to do | Việc cần làm |
| `usage.cron` | Open your Vercel project’s cron log. | Mở nhật ký tác vụ định kỳ của dự án trên Vercel. |
| `usage.github` | A scheduled GitHub check also emails you when no successful run has happened in 26 hours. | Một lượt kiểm tra định kỳ trên GitHub cũng gửi email cho bạn khi chưa có lần chạy thành công trong 26 giờ. |
| `usage.session` | Your session expired. Sign in again in a new tab, then try again here. | Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại trong thẻ mới, rồi quay lại đây để thử lại. |
| `attention.missed` | No successful daily job in the last 26 hours. | Tác vụ hằng ngày chưa chạy thành công trong 26 giờ qua. |
| `attention.failed` | The last daily job failed. | Lần chạy tác vụ hằng ngày gần nhất thất bại. |
| `attention.zeroBudget` | This page has no storage allowance. Uploads are unavailable. | Trang này không có hạn mức lưu trữ. Không thể tải tệp lên. |
| `attention.full` | Storage is full. | Dung lượng đã đầy. |
| `attention.warning` | Storage has reached 80%. | Dung lượng đã đạt 80%. |
| `usage.lastAttempt` | Last attempt: [TIME] (page time zone) | Lần thử gần nhất: [TIME] (múi giờ của trang) |
| `usage.lastAttemptFailed` | The last attempt failed: [TIME] (page time zone) | Lần thử gần nhất thất bại: [TIME] (múi giờ của trang) |
| `usage.priorCorrections` | The last successful run corrected [N] files. | Lần chạy thành công gần nhất đã điều chỉnh [N] tệp. |
| `usage.connected` | Connection restored. | Đã kết nối lại. |
| `usage.cached` | Last known numbers from [TIME] | Số liệu gần nhất đã biết lúc [TIME] |
| `usage.lastKnown` | Last known: [attention] | Thông tin gần nhất: [attention] |
| `usage.attentionCleared` | Attention cleared. | Đã hết cảnh báo. |
| `usage.attentionLower` | Lower-priority attention: [attention] | Cảnh báo có mức ưu tiên thấp hơn: [attention] |
| `usage.attentionHigher` | Higher-priority attention: [attention] | Cảnh báo có mức ưu tiên cao hơn: [attention] |
| `usage.retryOffline` | Reconnect to try again. | Kết nối lại để thử lại. |
| `usage.signInOffline` | Reconnect to sign in. | Kết nối lại để đăng nhập. |
| `usage.logoutOffline` | Reconnect to log out. | Kết nối lại để đăng xuất. |

### O8 Share and O9 Visibility for T2.6 (2026-11-21, approved by the owner 2026-11-21, Q146)

Boards: OwnerShare, OwnerShareTab and OwnerShareLap (O8, 25 review states each), OwnerVisibility, OwnerVisibilityTab and OwnerVisibilityLap (O9, 21 review states each), OwnerDashShare, OwnerDashShareTab and OwnerDashShareLap (the approved O2 boards plus a Share entry and a Visibility row with Change, 37 review states each) on canvas page 10 "Owner area" (Theme Preview version 122). Codex lead design, Claude review and render; working copies, brief, checks and reviews in the git-ignored `.design/share/`. Owner decisions (2026-11-21, Q146): QR by `qrcode.react`; T2.6 is O8 and O9 only (Settings, Q115, is its own unit); Published is listed but cannot be chosen until the Phase 3 public guest route. Claude's defaults: Q146 1-44.

- **Show once (design 1 §3.2, Q34a):** the link and its QR appear only in the answer to Create or Rotate. Afterwards O8 says when the link was created and shown, never the link. States: no link yet (Create guest link); link shown (Rotate link); "display not confirmed" (`shown_at` empty: Rotate again); the reveal (selectable link that wraps, Copy link with a select-and-copy fallback, QR with Download QR as `guest-link-qr.png`, the QR warning, the tag steps, "This is the only time this link is shown."). Leaving the reveal always asks "Have you saved the link or the QR?" (Yes, leave / Stay, focus on Stay); `beforeunload` is armed while it shows.
- **Credential handling:** the link lives only in the reveal's memory: never in the URL, history, storage, form fields, logs, analytics or status messages; `no-store`; any exit, a replacing read or access loss clears the text, QR, selection and download object URL; a back-forward cache restore reads metadata and never shows a reveal. The reveal stays only while a read's active version equals the revealed one; a replacement says "This link was replaced in another tab and no longer works."
- **Create and Rotate (server contract):** Create expects no active link; Rotate sends the version the owner confirmed. In one transaction the server locks the page, looks up the request id (answers "already rotated" without a credential if that request committed), then checks the expected version ("changed" if it differs), then mutates; the one-time answer carries the new version. A timeout, 5xx or lost connection is "Outcome unknown" (Try again repeats the same request id, also after signing in again); only a confirmed rejection says nothing changed. One idempotent acknowledgement after the reveal renders sets `shown_at` on that version only while it is active; if it fails, the next read shows "display not confirmed".
- **Rotate confirm:** "The current link, the tag and any printed QR stop opening the page…" (Rotate link destructive / Cancel, focus on Cancel). O8 notes a Private page and links to O9; with no link, O9's Token-only help links to O8 ("Create a guest link in Share first.").
- **O9:** two independent panels, each with its own draft, Save and status. Who can open the page: Private (confirm "Make the page private?", focus on Cancel), Token-only, Published shown disabled with "Available once the page can open without a link (coming later)" (readable, 4.5:1). Sections guests see: Home always on; Memories, Together and Wishes switchable; Zodiac hidden until T3.9; turning a section off hides it once saved and deletes nothing.
- **O9 saves (server contract):** visibility saves unconditionally; sections send the flags the draft was based on plus the new flags, and the server answers "conflict" only if the saved flags differ from that base (no page version). Each save carries a request id, recorded under the page lock: a retry of a committed save returns the snapshot without applying twice ("We couldn't confirm the save. Try again to finish it; it won't be applied twice."). Every read and save returns the whole snapshot `{setup_completed, visibility, sections, timezone, link: null | {version, created_at, shown_at}}` (ISO UTC; O8 formats in the page time zone). One save at a time (the other Save says "Wait for the other save to finish."); a dirty panel shows "Changes not saved" plus its saved values; a superseded save says "Your save went through, but these settings were changed again in another tab or session."; Back or the Share shortcut with unsaved changes asks "Discard unsaved changes?". Sections Reload clears only section edits and keeps the checkboxes `aria-disabled` with "Reloading the saved sections…" until the read arrives. "Finish setup first." with a setup link before Finish.
- **O2:** Share entry ("Guest link: not created yet", a strong call to action on a Token-only page; "Guest link created [DATE]"; "New link: display not confirmed. Open Share to rotate again.") and the Visibility row with Change and the enabled sections, all from the one `owner_page()` read (offline values marked "Last known"); the Usage attention line stays independent.
- **Offline, 401, 403:** offline blocks writes, not edits (Save, Create, Rotate, Reload and Try again stay focusable with `aria-disabled` and the reason); losing the connection during Create or Rotate is "Outcome unknown"; 401 signs in in a new tab and keeps drafts; 403 clears drafts and offers Log out, as O10.
- **Accessibility:** 44 px targets; focus to the view heading on entry and back to the O2 opener; pressed controls keep focus while busy; after any redraw focus returns to the same element id, else a fallback written per transition (`.design/share/CHECKS.md` focus table); dialogs trap focus, Escape = Cancel or Stay, focus returns to the opener; one polite status region, each completed action announced once (a repeated Copy again); QR and dialog names use `aria-labelledby` on visible bilingual text; the QR never replaces the text link; reflow at 320 px with 200 % text (only the link breaks mid-word).
- **Build needs found in the design:** `owner_page()` gains `timezone` and the link metadata (never the token); a mark-shown call per version; `owner_rotate_token` gains the expected-version precondition and returns the version; a sections save that a finished page accepts (base flags, request-id idempotency, snapshot return); the visibility save gains request-id idempotency and the snapshot return; install `qrcode.react` (rule 1, exact version and integrity hash).
- **Checks (2026-11-21):** board logic checks 721 assertions across the nine boards (each fix's check seen failing first; `.design/share/check-share.cjs`); rendered in Chromium for every review state at the board's own size and at 320 px with a 200 % root font: 498 cases, no sideways scroll, no clipped box, no target under 44 px, no mid-word break outside the link, no axe violation (WCAG 2.2 AA), no console error. WebKit not run locally. Codex design review: 11 rounds; round 11's single low finding fixed and not re-reviewed.

Copy approved by the owner on 2026-11-21 (EN and VI as drawn; [DATE] [TIME] in the page time zone; shipped strings reused: `dashboard.visibility`, `dashboard.logout`, `visibility.private`, `visibility.token`, `visibility.explain`, `common.loading`, `common.readError`, `common.tryAgain`, `common.offline`, `common.accessLost`, `state.write`, `sections.*`, `save.busy`, `navigation.back`, `content.cancel`, `content.signin`, `upload.done`, `usage.session`, `usage.retryOffline`, `usage.logoutOffline`, `review.change`; review-control labels are tooling and not listed):

| Key | English | Tiếng Việt |
| --- | --- | --- |
| `common.lastKnown` | Last known | Gần nhất đã biết |
| `visibility.createFirst` | Create a guest link in Share first. | Trước tiên, hãy tạo liên kết dành cho khách trong mục Chia sẻ. |
| `visibility.discard` | Discard | Bỏ thay đổi |
| `visibility.discardQuestion` | Discard unsaved changes? | Bỏ các thay đổi chưa lưu? |
| `visibility.setupLink` | Open setup | Mở thiết lập |
| `visibility.setup` | Finish setup first. | Hãy hoàn tất thiết lập trước. |
| `visibility.unconfirmed` | We couldn't confirm the save. Try again to finish it; it won't be applied twice. | Chưa xác nhận được lần lưu. Hãy thử lại để hoàn tất; thay đổi sẽ không được áp dụng hai lần. |
| `visibility.reloadSections` | Reload (clears your unsaved section changes) | Tải lại (xóa thay đổi chưa lưu trong các mục) |
| `visibility.reloadingSections` | Reloading the saved sections… | Đang tải lại các mục đã lưu… |
| `share.replaced` | This link was replaced in another tab and no longer works. | Liên kết này đã được thay thế trong thẻ khác và không còn dùng được. |
| `share.changed` | The guest link changed in another tab or session. Nothing was created here. | Liên kết cho khách đã thay đổi trong thẻ hoặc phiên khác. Không có liên kết nào được tạo ở đây. |
| `share.unknown` | We couldn't confirm whether a new link was made. | Chưa xác nhận được liệu liên kết mới đã được tạo hay chưa. |
| `share.title` | Share | Chia sẻ |
| `share.intro` | Create a guest link. | Tạo liên kết cho khách. |
| `share.create` | Create guest link | Tạo liên kết cho khách |
| `share.creating` | Creating guest link… | Đang tạo liên kết cho khách… |
| `share.shown` | Guest link created [DATE] [TIME], shown on this screen once. It isn't stored, so it can't be shown again. | Liên kết được tạo lúc [TIME] ngày [DATE] và đã hiện một lần trên màn hình này. Liên kết không được lưu nên không thể hiện lại. |
| `share.rotate` | Rotate link | Đổi liên kết |
| `share.again` | Rotate again | Đổi liên kết lần nữa |
| `share.unshown` | A new guest link was made, but this screen couldn't confirm it was shown. If you didn't save it, rotate again. | Liên kết mới đã được tạo, nhưng màn hình này không xác nhận được rằng liên kết đã hiển thị. Nếu chưa lưu, hãy đổi liên kết lần nữa. |
| `share.recover` | If the tag still works, you can read the link with an NFC app. | Nếu thẻ vẫn hoạt động, bạn có thể dùng ứng dụng NFC để đọc lại liên kết. |
| `share.justCreated` | Guest link created | Đã tạo liên kết cho khách |
| `share.justRotated` | Guest link rotated | Đã đổi liên kết cho khách |
| `share.once` | This is the only time this link is shown. | Liên kết này chỉ hiện một lần duy nhất. |
| `share.copy` | Copy link | Sao chép liên kết |
| `share.copied` | Link copied | Đã sao chép liên kết |
| `share.selectAction` | Select link | Chọn liên kết |
| `share.select` | Select the link and copy it | Chọn liên kết rồi sao chép |
| `share.qr` | QR code for your guest link | Mã QR cho liên kết của khách |
| `share.fake` | Illustration only · not scannable | Hình minh họa · không thể quét |
| `share.download` | Download QR | Tải mã QR |
| `share.downloaded` | Placeholder PNG downloaded | Đã tải ảnh PNG minh họa |
| `share.downloadError` | The QR couldn't be saved. Copy the link instead. | Không lưu được mã QR. Hãy sao chép liên kết. |
| `share.warning` | This QR opens your page the same way the link does. Keep it private and delete copies after you rotate. | Mã QR này mở trang giống như liên kết. Hãy giữ kín mã và xóa các bản sao sau khi đổi liên kết. |
| `share.tag` | Write the NFC tag | Ghi vào thẻ NFC |
| `share.write` | Write the link to the tag as a web address with an NFC writing app. | Dùng ứng dụng ghi NFC để ghi liên kết vào thẻ dưới dạng địa chỉ web. |
| `share.test` | Test it on one iPhone and one Android phone. | Thử thẻ trên một iPhone và một điện thoại Android. |
| `share.lock` | Don't lock the tag. | Không khóa thẻ. |
| `share.leaveQuestion` | Have you saved the link or the QR? | Bạn đã lưu liên kết hoặc mã QR chưa? |
| `share.leaveBody` | It won't be shown again. | Liên kết sẽ không hiện lại. |
| `share.leave` | Yes, leave | Có, rời đi |
| `share.stay` | Stay | Ở lại |
| `share.rotateQuestion` | Rotate the guest link? | Đổi liên kết cho khách? |
| `share.rotateBody` | The current link, the tag and any printed QR stop opening the page. You'll need to rewrite the tag and reprint the QR. Wishes already sent are kept. | Liên kết hiện tại, thẻ và mọi mã QR đã in sẽ không còn mở được trang. Bạn cần ghi lại thẻ và in lại mã QR. Các lời chúc đã gửi vẫn được giữ. |
| `share.rotating` | Rotating guest link… | Đang đổi liên kết cho khách… |
| `share.failed` | The request was rejected. Nothing changed. | Yêu cầu bị từ chối. Mọi thứ vẫn như cũ. |
| `share.private` | Your page is Private. | Trang đang ở chế độ Riêng tư. |
| `share.offline` | Reconnect to create or rotate a guest link. | Kết nối lại để tạo hoặc đổi liên kết cho khách. |
| `visibility.title` | Visibility and sections | Quyền xem và các mục |
| `visibility.who` | Who can open the page | Ai có thể mở trang |
| `visibility.privateHelp` | Guests can't open the page, even with a link. Any guest link you made stays the same. | Khách không thể mở trang, kể cả khi có liên kết. Mọi liên kết dành cho khách bạn đã tạo vẫn giữ nguyên. |
| `visibility.published` | Published | Công khai |
| `visibility.publishedHelp` | Available once the page can open without a link (coming later) | Sẽ khả dụng khi có thể mở trang mà không cần liên kết (sắp có) |
| `visibility.sections` | Sections guests see | Các mục khách nhìn thấy |
| `visibility.homeHelp` | Always on: every guest starts here | Luôn bật: mọi khách đều bắt đầu ở đây |
| `visibility.publishedItems` | Guests see only published items. | Khách chỉ thấy nội dung đã đăng. |
| `visibility.sectionHelp` | A section you turn off is hidden from guests once you save; nothing is deleted. | Mục đã tắt sẽ ẩn với khách sau khi bạn lưu; không có nội dung nào bị xóa. |
| `visibility.save` | Save | Lưu |
| `visibility.saved` | Saved | Đã lưu |
| `visibility.saveSuperseded` | Your save went through, but these settings were changed again in another tab or session. | Đã lưu, nhưng các cài đặt này đã được thay đổi lại trong một thẻ hoặc phiên khác. |
| `visibility.waitForSave` | Wait for the other save to finish. | Đợi lần lưu kia xong. |
| `visibility.unsaved` | Changes not saved | Thay đổi chưa lưu |
| `visibility.savedSections` | Saved sections: [sections] | Mục đã lưu: [sections] |
| `visibility.savedVisibility` | Saved: [visibility] | Đã lưu: [visibility] |
| `visibility.privateQuestion` | Make the page private? | Chuyển trang sang Riêng tư? |
| `visibility.privateBody` | Guests can't open the page, even with a link. Any guest link you made stays the same. | Khách không thể mở trang, kể cả khi có liên kết. Mọi liên kết dành cho khách bạn đã tạo vẫn giữ nguyên. |
| `visibility.makePrivate` | Make private | Chuyển sang Riêng tư |
| `visibility.conflict` | This page changed in another tab or session. | Trang đã thay đổi trong thẻ hoặc phiên khác. |
| `visibility.reload` | Reload | Tải lại |
| `visibility.offline` | Reconnect to save changes. | Kết nối lại để lưu thay đổi. |
| `dashboard.shareEmpty` | Guest link: not created yet | Liên kết cho khách: chưa tạo |
| `dashboard.shareCreated` | Guest link created [DATE] | Liên kết cho khách đã tạo ngày [DATE] |
| `dashboard.shareUnshown` | New link: display not confirmed. Open Share to rotate again. | Liên kết mới: chưa xác nhận hiển thị. Mở Chia sẻ để đổi liên kết lần nữa. |

### O19 Page settings and the O2 Settings card for T2.8 (2026-11-22, boards drawn; approved by the owner's merge of PR #75 on 2026-11-25, Q115)

Boards: OwnerSettings, OwnerSettingsTab and OwnerSettingsLap (O19, 58 review states each), OwnerDashSettings, OwnerDashSettingsTab and OwnerDashSettingsLap (the approved O2 boards plus a Settings card, 50 review states each) on canvas page 10 "Owner area" (Theme Preview version 123, with a "settings" note). Codex lead design, Claude review and render; working copies, brief, checks (with the full build contract and focus table) and reviews in the git-ignored `.design/settings/`. Owner decisions (2026-11-22, Q115): one Settings view opened from O2 with one panel per group, each saved on its own and live once its save succeeds; the suggested theme is included, A-D side by side plus No suggestion.

- **Panels:** (1) names and default language: both names required, the O3 rules (trim, NFC, 1-40 code points, no control or bidirectional characters; the build adds U+0000 to the shared rule in `src/lib/setup.ts`, test-first), `dir="auto"` inputs and the wrapped echo; the names are the couple title, the language is where a guest's first visit starts. (2) Time zone: the O3 list (browser zones plus UTC); a saved spelling the browser accepts but does not list stays selected; a rejected one shows "Saved: [ZONE] (not available)", the empty Choose option and the error; the note says shown dates and times and the days-together counter follow it, entered dates stay as entered. (3) Suggested theme: four static swatch cards in their own tokens plus No suggestion (stored as null), a radio group with arrow keys and a visible check; the suggestion is highlighted on a guest's first theme choice and never overrides a guest's choice.
- **Saves (server contract):** one call per panel that a finished page accepts, sending only the touched fields with the saved values they were edited against, plus a request id recorded under the page lock (looked up before the base check; names and language commit together). Answers: `200 {page}` (the full `owner_page()` snapshot; Saved or Superseded from the sent fields); `409 conflict` (no snapshot; Reload); `409 setup_not_finished`; `400` with `invalid_name` (+ `fields`), `invalid_timezone` or `wording_incomplete` (the default language's published wording is incomplete, `pages_wording_guard`: an error on the radios and a link to O18 on that language, opening in a new tab); status-only 401 and 403; anything else is "We couldn't confirm the save", and Try again repeats the same request. O9's statuses and rules otherwise: one save at a time, Changes not saved plus the saved values, Reload clears only its panel, the leave dialog (with a pending-save variant that warns the sent save may still take effect), Finish setup first.
- **Reads:** the shipped O9 read counter (a newer read or any save makes older replies stale); "Last known" is the snapshot this tab accepted, in memory only, and Back hands it to O2. A null page after an accepted one in the same session is access lost (403 path).
- **O2:** a Settings card with the names, default language, time zone and suggested theme (or No suggestion) and Change ("Change / Đổi" plus the card title as its name), from the same snapshot as the couple heading, Share and Visibility; loading, read failure with Try again, offline Last known, 401 and 403 on the return read. The Home card's counter uses Home's own read and re-reads on return after a zone change.
- **Build needs found in the design:** the per-panel settings save above (extends `settings_saves`); one shared safe zone formatter for Share, Usage, Home and the counter (a rejected zone formats in UTC, labelled "(UTC)"); O18 accepts `lang=en|vi`; U+0000 in the shared name rule.
- **Checks (2026-11-22):** board logic checks 798 assertions across the six boards (each fix's check seen failing first; `.design/settings/check-settings.cjs`); rendered in Chromium for every review state at the board's own size and at 320 px with a 200 % root font: 642 cases, no sideways scroll, no clipped box, no target under 44 px, no mid-word break outside user data, no axe violation (WCAG 2.2 AA), no console error. WebKit not run locally. Codex design review: 12 rounds (10, 10, 9, 6, 5, 4, 4, 5, 4, 3, 3, 3 findings); declined with reasons in CHECKS.md: the cross-folder preview round trip, removable owners (none exist, Q35), changes to the approved O18 board, and browser Back restoring an older O2 (one document in the build); round 12's two accepted findings fixed and not re-reviewed.

Proposed copy (EN and VI; shipped strings reused as listed in `.design/settings/COPY.md`, including `step.names`, `step.zone`, `language.label`, `name.*`, `zone.*`, `theme.*`, the `visibility.*` save statuses, `common.*`, `share.stay`, `usage.session`, `content.signin`, `dashboard.logout`, `review.change`, `navigation.back`):

| Key | English | Tiếng Việt |
| --- | --- | --- |
| `settings.title` | Page settings | Cài đặt trang |
| `settings.entry` | Settings | Cài đặt |
| `settings.live` | Each panel's changes take effect when its save succeeds. | Các thay đổi trong mỗi nhóm có hiệu lực khi lưu nhóm đó thành công. |
| `settings.namesHelp` | The guest pages use these names as the couple title. | Các trang dành cho khách dùng hai tên này làm tiêu đề. |
| `settings.languageHelp` | Guests start in this language on their first visit. They can switch languages. | Khách dùng ngôn ngữ này trong lần truy cập đầu tiên. Họ có thể đổi ngôn ngữ. |
| `language.wordingIncomplete` | Complete and publish the wording in this language, then return here and save your draft. | Hãy hoàn tất và đăng lời nhắn bằng ngôn ngữ này, rồi quay lại đây để lưu bản nháp. |
| `settings.wordingTab` | opens in a new tab | mở trong thẻ mới |
| `settings.zoneNote` | With a different time zone, the dates and times shown on photos and messages can shift, and the days-together counter can move by a day. Dates you entered stay as entered. | Ngày và giờ hiển thị trên ảnh và lời nhắn có thể thay đổi theo múi giờ, và bộ đếm ngày bên nhau có thể lệch một ngày. Ngày bạn nhập được giữ nguyên. |
| `zone.savedUnavailable` | Saved zone is unavailable. Choose a time zone. | Múi giờ đã lưu không khả dụng. Hãy chọn một múi giờ. |
| `zone.savedLabel` | Saved: [ZONE] (not available) | Đã lưu: [ZONE] (không khả dụng) |
| `zone.refused` | The server refused this time zone. Choose another time zone. | Máy chủ từ chối múi giờ này. Hãy chọn múi giờ khác. |
| `settings.theme` | Suggested theme | Chủ đề gợi ý |
| `settings.themeHelp` | Your suggestion is highlighted when guests pick a theme on their first visit. Guests who already chose keep their choice. Guests can change their theme any time. | Chủ đề gợi ý được làm nổi bật khi khách chọn chủ đề trong lần truy cập đầu tiên. Khách đã chọn vẫn giữ lựa chọn của mình. Khách có thể đổi chủ đề bất cứ lúc nào. |
| `settings.none` | No suggestion | Không gợi ý |
| `settings.savedValues` | Saved values | Giá trị đã lưu |
| `settings.reloading` | Reloading the saved settings… | Đang tải lại cài đặt đã lưu… |
| `settings.reloadHelp` | Reload clears unsaved changes in this panel. | Tải lại sẽ xóa các thay đổi chưa lưu trong nhóm này. |
| `settings.reconcileHelp` | Reload reads the current saved values and keeps edits that still differ. | Tải lại sẽ đọc các giá trị đã lưu hiện tại và giữ những chỉnh sửa còn khác. |
| `settings.retryReadHelp` | Try again reads the saved values again. | Thử lại sẽ đọc lại các giá trị đã lưu. |
| `settings.reloaded` | Saved settings reloaded. | Đã tải lại cài đặt đã lưu. |
| `settings.signInFirst` | Sign in again first. | Hãy đăng nhập lại trước. |
| `settings.sessionExpired` | Your session expired. Sign in again to continue. | Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục. |
| `settings.leaveTitle` | Leave while a save is pending? | Rời đi khi đang chờ kết quả lưu? |
| `settings.leavePending` | Leaving discards the unsaved edits on this device. The save already sent may still take effect. | Nếu rời đi, các thay đổi chưa lưu trên thiết bị này sẽ bị bỏ. Yêu cầu lưu đã gửi vẫn có thể có hiệu lực. |
| `settings.leaveSettledTitle` | Leave Settings? | Rời khỏi Cài đặt? |
| `settings.leaveSaved` | Your changes were saved. | Các thay đổi của bạn đã được lưu. |
| `settings.leaveNewer` | Leaving discards your newer edits. | Nếu rời đi, các thay đổi mới hơn của bạn sẽ bị bỏ. |
| `settings.leaveFailed` | The save failed. | Không lưu được thay đổi. |
| `settings.leaveUnconfirmed` | The save could not be confirmed. | Chưa xác nhận được kết quả lưu. |
| `settings.leaveUnsaved` | Leaving discards your unsaved edits. | Nếu rời đi, các thay đổi chưa lưu của bạn sẽ bị bỏ. |
| `settings.leave` | Leave | Rời đi |
| `home.counterUtc` | Day [N] together (UTC) | Ngày thứ [N] bên nhau (UTC) |

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
