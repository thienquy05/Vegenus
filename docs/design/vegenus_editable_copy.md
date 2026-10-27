# Editable wording: what the owner writes and what the system generates

**Status:** DRAFT v0.3, 2026-10-26: owner answered all Q82 points (see §7). Branch `docs/editable-copy` (stacked on `docs/guest-screens-v3`). Documentation only; no application code. Rule 3: every example is invented sample text with placeholders; nothing here is a real name, date or message.
**Why:** owner direction (2026-10-26): the template should give the couple more control. Greetings, placeholders and similar wording must not be fixed; the couple edits them. Anything the system works out (zodiac, counts, dates) stays generated: the owner supplies the inputs, never the output text.
**Related:** [screens](vegenus_screens.md), [guest UI](vegenus_guest_ui.md), [owner UI](vegenus_owner_ui.md), [data model](vegenus_data_model.md) §3.10-3.11, PRD Q82 (new, open).

## 1. The rule in one table

| Kind | Who writes the words | Editable? | Example |
|---|---|---|---|
| **A. Couple's content** | The owner (already so today) | Yes | Welcome note, memory titles and text, place notes, milestone names |
| **B. Editable wording** (new) | The owner; the app ships an **example** for every field | Yes, per language (EN and VI) | Greeting line, button labels, empty-state lines, form placeholders, the thank-you after a wish |
| **C. Generated text** | The system, from the owner's inputs | **No** | Zodiac signs and reading, sky at birth, "N days together", counters, dates, usage meter |
| **D. Fixed system text** | The product (translated EN/VI) | **No** | Errors, rate-limit and offline messages, privacy and consent text, accessibility names, language names |

Why D is not editable: these lines state facts the system must keep true (what is stored, what a limit is, what an email will do). A wrong edit would make them false or hide a safety message. The owner still sees them in the preview.

Rule for B (owner, 2026-10-26): **guests only see wording the owner has saved.** The shipped example is a suggestion shown in the empty field, with a one-tap "Use example". A language is offered to guests only once all of its B fields are filled (§4).

## 2. Token insertion: editing the sentence, not the number

Some wording wraps a generated value. The owner edits the sentence; the value arrives through a **token** the owner can place but not change.

| Token | Filled by the system with | Where it can appear |
|---|---|---|
| `{days}` | Days together (counter rules E14) | Home counter line |
| `{partner_a}`, `{partner_b}` | The two display labels the owner already set | Greeting, thank-you, tour, browser tab title, email greeting |
| `{owner}` | Both labels joined, or the owner's chosen short name | Thank-you after a wish |
| `{count}` | A count (wishes, memories) | Section intro lines |
| `{wait}` | The server-provided wait | Not offered: limit messages are kind D |

The allowlist is exact per key. The key-to-token mapping (the O18 board implements exactly this):

| Key | Allowed tokens | Required |
|---|---|---|
| `home.greeting`, `wishes.sent`, `tour.1.title`, `page.title`, `email.greeting` | `partner_a`, `partner_b` | none |
| `home.days` | `days` | `days` |
| `wishes.sentBody` | `owner`, `partner_a`, `partner_b` | none |
| `memories.intro`, `together.intro`, `wishes.intro` | `count` | none |
| every other key | none | none |

Besides tokens, every field rejects `<`, `>`, links (`http://`, `https://`, `www.`) and, for single-line fields, line breaks; stored text is NFC-normalised.

The allowlist above is the whole rule (one list per `page_copy` key). **Every shipped example must pass the same validation as owner input**, checked by a test, so "Use example" can never be rejected and block a language from completing.

Tokens are inserted from chips under the field, shown as locked chips in the preview. Unknown tokens are rejected on save with a plain message. Text is plain: no HTML, no links, NFC-normalised, with a per-field cap.

## 3. Catalogue: every text, classified, with an example

"Example" is the suggestion the owner sees in the empty field in Settings. Guests see it only after the owner saves it.

### 3.1 Home (G1)

| Text | Kind | Example EN / VI |
|---|---|---|
| Couple title | A | `{partner_a} & {partner_b}` (names are the owner's labels) |
| Greeting above the title (new) | **B** | "Welcome to our little corner of the world." / "Chào mừng bạn đến góc nhỏ của chúng mình." |
| Welcome note (≤ 600 chars) | A | Owner writes it; the example is three short warm sentences |
| Days-together line | **B** around **C** | "Together for {days} days and counting." / "Bên nhau {days} ngày và còn tiếp." (the number is C) |
| Photo stack hint | **B** | "Tap a photo to see the next one." / "Chạm vào ảnh để xem ảnh tiếp theo." |
| Photo counter "n / 5" | C | 2 / 5 |
| Scroll cue | **B** | "Scroll to read our note." / "Cuộn xuống để đọc lời nhắn." |
| Photo descriptions (alt text) | A | Owner describes each photo in a line; read by screen readers |
| Section shortcut labels | D (see 3.2) | |

### 3.2 Section names: fixed (owner, 2026-10-26)

Menu items, page headings and Home shortcuts keep their product names in both languages (kind D): Memories / Kỷ niệm, Together / Bên nhau, Wishes / Lời chúc, Zodiac / Cung hoàng đạo. They are not renamed. The intro line under each heading is editable (kind B, below).

### 3.3 Memories (G2) and Memory detail (G3)

| Text | Kind | Example EN / VI |
|---|---|---|
| Page intro line (new) | **B** | "Moments we want to keep." / "Những khoảnh khắc mình muốn giữ lại." |
| Empty state | **B** | "Our first memory is coming soon." / "Kỷ niệm đầu tiên sắp được thêm vào." |
| Memory title, date label, message, captions, album page text | A | Owner writes them |
| "Contents", "Next page", "Previous page" | D | Controls keep their names |
| Language-fallback note (Q67) | D | "Shown in the original language." |

### 3.4 Together (G4)

| Text | Kind | Example EN / VI |
|---|---|---|
| Page intro line (new) | **B** | "Every pin is a place that means something to us." / "Mỗi chiếc ghim là một nơi có ý nghĩa với chúng mình." |
| Search placeholder | **B** | "Find one of our places" / "Tìm một nơi của mình" |
| Empty state | **B** | "We haven't pinned any places yet." / "Mình chưa ghim nơi nào cả." |
| Place name, date, note | A | Owner writes them |
| Pin positions | A | Owner places them on the drawing (Q63) |

### 3.5 Wishes (G5), Leave a wish (G6), Sent (G7)

| Text | Kind | Example EN / VI |
|---|---|---|
| Page intro | **B** | "Leave us a few words, we read every one." / "Hãy để lại đôi lời, tụi mình đọc hết nhé." |
| "Leave a wish" button | **B** (≤ 24 chars) | "Write to us" / "Viết cho tụi mình" |
| Empty state | **B** | "Be the first to write to us." / "Hãy là người đầu tiên viết cho tụi mình." |
| Name field **placeholder** | **B** | "How should we call you?" / "Tụi mình gọi bạn là gì nhỉ?" |
| Message field **placeholder** | **B** | "Say something kind, funny or both." / "Viết điều gì đó dễ thương hoặc vui vui nhé." |
| Field labels, counters `[N]/40`, `[N]/500` | D / C | Labels stay for accessibility and screen readers |
| Sent heading and thank-you | **B** with `{owner}` | "Thank you! {owner} will read it soon." / "Cảm ơn bạn! {owner} sẽ đọc sớm thôi." |
| Back button after sending | **B** | "Back to the wishes" / "Quay lại lời chúc" |
| Privacy note about the network address | D | Fixed: it states what is checked and stored |
| Validation, rate-limit, offline, error messages | D | Fixed; the daily-limit notice keeps its kind tone (Q75) |
| Guests' wishes | (guest content) | Never rewritten by the owner |

### 3.6 Zodiac (Z2 and Z1): generated, not editable

| Text | Kind | Note |
|---|---|---|
| Sun, Moon, rising signs; Vietnamese animal, pillars, mệnh | C | Computed from the birth data |
| Relationship reading and the six message tiles | C | Composed from the reference texts (Q48) |
| Sky at birth: Moon phase, planets, events, composed line | C | From the astronomy library (Q50) |
| "For fun / theo quan niệm dân gian" label | D | Honesty label, stays |
| Western / Vietnamese switch names | D | Names of the systems |
| Sign artwork | A | Owner may upload art (Q39); default art ships |
| Partner labels | A | Already owner-set (`label`, 1–40 chars) |
| Section name in the menu | D (3.2) | Fixed |
| Sky line reword (`birthday_event`, Q50) | removed | Owner, 2026-10-26: the owner cannot edit anything in the Zodiac; they only give birth data and the system computes. The field is deleted from the data model and Z1 |

### 3.7 First-visit tour (G9) and the updates card (G26)

| Text | Kind | Example EN / VI |
|---|---|---|
| Tour step titles and bodies (3-4 steps) | **B** | Step 1: "Hi, we're {partner_a} and {partner_b}." / "Chào bạn, tụi mình là {partner_a} và {partner_b}." Step 2: "Look around: memories, places and more." / "Cứ thong thả xem kỷ niệm, địa điểm và nhiều thứ khác." |
| Tour buttons Next, Back, Skip, Done | D | |
| Updates card question | **B** | "Want a note when we add something new?" / "Muốn nhận tin khi tụi mình thêm điều mới không?" |
| Consent text and unsubscribe note | D | Legal wording stays fixed |

### 3.8 Pages a guest sees without access, sign-in, settings

| Text | Kind | Note |
|---|---|---|
| "Tap the tag or scan the QR code" (G-E1) | D | Identical for every blocked case, no hints (E47) |
| Sign-in, invite code, account screens (G20-G27) | D | Security and consent wording |
| Settings (G8) labels | D | Controls keep stable names |

### 3.9 Page-level and outside the page

| Text | Kind | Example EN / VI |
|---|---|---|
| Browser tab title | **B** (≤ 60) | "{partner_a} & {partner_b}, our story" |
| Link preview description (when shared) | **B** (≤ 120) | "A small place for our memories." / "Một góc nhỏ lưu giữ kỷ niệm của mình." |
| Email greeting line in the daily digest and reminders | **B** | "Hi from {partner_a} and {partner_b}," / "Chào bạn, {partner_a} và {partner_b} gửi tin nhé," |
| Email body: counts, link, unsubscribe | C / D | No memory text, no token (S18, E50) |
| Owner area (O1-O17) | D | Plain, same for everyone |

## 4. The owner's editing screen: O18 "Wording / Lời văn" (all in Settings)

- **Where:** Owner menu → Settings → "Wording / Lời văn": one screen, every editable text in one place. No wizard step (owner, 2026-10-26: all templates at once in Settings, the owner goes through and fills the empty spaces).
- **Layout:** grouped by section in the guest menu order. Each row: where it appears (a small guest-preview snippet), an EN input and a VI input, a character counter against the cap, token chips, the example shown as placeholder, "Use example / Dùng mẫu" and "Clear / Xóa". Per group and per language a "Use all examples / Dùng tất cả mẫu" shortcut, so a language can be completed in one tap and then edited.
- **Progress:** a header per language, "English: 11 of 27 set / Tiếng Anh: đã điền 11/27", with "Show empty fields only / Chỉ hiện ô còn trống".
- **Language availability (owner, 2026-10-26):** a language is **set up** when all its B fields are filled. Guests can pick only set-up languages in Settings (G8). The other option is shown but disabled with: "English hasn't been set up by the owner yet. / Chủ trang chưa thiết lập tiếng Anh." (and the Vietnamese equivalent for VI). At least the page's default language must be complete before the owner can publish wording; the page wizard (O3) default-language choice decides which.
- **Availability is derived from the published snapshot, not from G8 alone.** The set of offered languages = languages whose B fields are all in the last published wording. It applies on first arrival (phone language), on restoring a remembered choice, and in G8. If the wanted language is not in the set, the guest gets the page's default language, which is always in the set. Changing `pages.default_lang` to an incomplete language is refused, and a page cannot be made visible to guests before its first wording publication. If a later publish would leave a language incomplete, that language drops out of the set at once and remembered choices fall back to the default.
- **Memories are different:** memory titles and text keep Q67 (original text with a note when a language is missing); the language rule above concerns wording only.
- **Preview:** a "Preview as guest / Xem như khách" frame beside (laptop, tablet) or below (phone) the form updates as the owner types, in any of the four themes and either language.
- **Publish:** one "Publish wording / Đăng lời văn" button on this screen publishes all wording at once (draft until then, like `items`, data model §1 principle 3). Unsaved and unpublished states are visible in the header.
- **Validation:** plain text only; per-field cap; tokens must be from the allowed list for that field; a button label cannot contain a line break.
- **Limits proposal:** 27 fields per language (the O18 board lists them), each ≤ 120 characters except the tour bodies (≤ 200) and the welcome note (≤ 600, existing).
- **Privacy:** wording is public once published. The screen says so beside the first field: "Everything here is visible to guests / Mọi nội dung ở đây khách đều nhìn thấy."

States of O18: default (examples as placeholders), empty field, language incomplete, language complete, unsaved changes, publishing, publish failed (input kept), over the cap, unknown token, offline, conflict with another session (compare, never overwrite), long Vietnamese text (wraps; button labels grow in height, never truncate), loading, permission lost.

## 5. Data model sketch (input for design 3, not a schema yet)

One table `page_copy` keyed by `(page_id, key, lang)` with `text`, `version`, `updated_at`, plus a `published_at` snapshot like `items`. `key` is a code constant (for example `home.greeting`, `wishes.empty`), so the product defines the full list and its example text; the owner never creates a key. Examples live in code (the same strings files as the D texts), not in the database. Guests read only the published snapshot; a language with a missing key is not offered (§4). Row-level security matches the other page tables.

## 6. Canvas: built 2026-10-27, owner review pending

Theme Preview canvas, version 93 (not in Git). Delivered:

1. **O18 Wording / Lời văn**, owner area (page 10), phone, tablet and laptop, interactive. Language tabs with "filled/27", per-field example as placeholder, "Dùng mẫu", "Xóa", per-group and per-language "use examples", locked code chips, live length and code validation, guest preview (collapsible on phone), one publish button gated on the default language. Tweaks > scenario: midway, fresh, bothDone, errors, long, loading, publishing, publishFailed, offline, conflict.
2. **Guest Settings (G8), 12 boards**: Tweaks > langSetup (vi default, both, en). A language that is not set up shows "· chưa thiết lập", a dashed border, `aria-disabled`, and the sentence "Chủ trang chưa thiết lập tiếng Anh." under the group. The same engine feeds Wishes and Leave-a-wish, so those 24 boards also carry the new wording.
3. **Example wording on guest boards**: Wishes intro, button, empty state, name and message placeholders, thank-you (plus the fixed "not public until approved" line), back button and tour steps (Wishes, Leave a wish, Settings: 36 boards); Home greeting, days line, photo hint and scroll cue (12 boards); Memories intro on the 4 laptop boards; Together search placeholder (12 boards).

Known gaps, to close in the next round:

- Not rendered or checked in a browser (the canvas is private and the boards need the canvas runtime); layout of longer example lines on Home (greeting and days line) is unchecked, and the O18 menu button is a static placeholder.
- Home previously had a different tagline per theme; the B greeting and days line are now one owner-written text across A-D (a consequence of Q82). Theme D keeps its editorial decor ("Tập 01", "Tuyển tập").
- Memories intro and Together intro have no slot yet on phone and tablet (Memories) or on any size (Together); each needs a one-line slot designed per theme. Memories, Together and Home empty states are not drawn.
- Updates-card question, page title, link description and email greeting appear only in O18 (no guest or email board).
- Not yet reviewed by Codex; O18 motion is none (reduced-motion safe by default).

**Codex review of the boards (2026-10-27, read-only, 14 findings).** Fixed: all 12 Write boards threw on render (placeholders read `t` out of scope; now `v.t`, confirmed by executing `renderVals()` before and after); O18 retry button, stale publish timer, default language no longer hard-coded (tweak `defaultLang`), per-key token allowlists aligned with §2 (table above), validation of HTML, links, line breaks and NFC, availability messages computed from both languages and a visible "unsaved changes" line, working conflict comparison, a permission-lost scenario, a long button label, a preview of all 27 fields, unique error ids tied to their inputs, `aria-describedby` only when the notice exists, Home theme D photo hint, and the two statements in this document that contradicted §3.2 and the field count. Still open: no theme selector in the O18 preview; Together intro, Memories phone/tablet intro, and empty states for Memories, Together and Home have no guest slot; updates card, page title, link description and email greeting have no guest or email board; Home shows the days sentence as number plus suffix, not the full tokenised sentence, and theme D has no greeting slot.

## 7. Owner answers (2026-10-26) and what is still open

1. **The split:** yes, A / B / C / D as in §1.
2. **Zodiac:** the owner cannot edit anything in it; they give birth data and the system computes (owner, 2026-10-26). Everything else in Zodiac stays as designed. The Q50 reword field is removed (data model, Z1, Q50 text).
3. **Section names:** no renaming; fixed (§3.2).
4. **Missing language:** a language that is not fully set up cannot be chosen by guests; the option explains it (§4).
5. **Publishing:** everything at once, in Settings (§4).
