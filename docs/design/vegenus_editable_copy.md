# Editable wording: what the owner writes and what the system generates

**Status:** DRAFT v0.4, 2026-10-27 (complete key inventory §2.1, validation rules §2.2, storage moved to design 3 §3.12). v0.3, 2026-10-26: owner answered all Q82 points (see §7). Documentation only; no application code. Rule 3: every example is invented sample text with placeholders; nothing here is a real name, date or message.
**Why:** owner direction (2026-10-26): the template should give the couple more control. Greetings, placeholders and similar wording must not be fixed; the couple edits them. Anything the system works out (zodiac, counts, dates) stays generated: the owner supplies the inputs, never the output text.
**Related:** [screens](vegenus_screens.md), [guest UI](vegenus_guest_ui.md), [owner UI](vegenus_owner_ui.md), [data model](vegenus_data_model.md) §3.12 (wording storage and publication), PRD Q82 (answered).

## 1. The rule in one table

| Kind | Who writes the words | Editable? | Example |
|---|---|---|---|
| **A. Couple's content** | The owner (already so today) | Yes | Welcome note, memory titles and text, place notes, milestone names |
| **B. Editable wording** (new) | The owner; the app ships an **example** for every field | Yes, per language (EN and VI) | Greeting line, button labels, empty-state lines, form placeholders, the thank-you after a wish |
| **C. Generated text** | The system, from the owner's inputs | **No** | Zodiac signs and reading, sky at birth, "N days together", counters, dates, usage meter |
| **D. Fixed system text** | The product (translated EN/VI) | **No** | Errors, rate-limit and offline messages, privacy and consent text, accessibility names, language names |

Why D is not editable: these lines state facts the system must keep true (what is stored, what a limit is, what an email will do). A wrong edit would make them false or hide a safety message. The owner still sees them in the preview.

Rule for B (owner, 2026-10-26): **guests only see wording that is saved.** A new page is created with the shipped examples as drafts in both languages. The owner publishes them with one explicit action, "Use the suggested wording", in the last setup step; editing in O18 comes after setup is complete (data model §3.12). Guests see nothing until that publication. The owner edits any field in O18; clearing a field removes it, shows the example as a suggestion with a one-tap "Use example", and a language is offered to guests only while all of its B fields are filled (§4).

## 2. Token insertion: editing the sentence, not the number

Some wording wraps a generated value. The owner edits the sentence; the value arrives through a **token** the owner can place but not change.

| Token | Filled by the system with | Where it can appear |
|---|---|---|
| `{days}` | Days together (counter rules E14) | Home counter line |
| `{partner_a}`, `{partner_b}` | The two display labels the owner already set | Greeting, thank-you, tour, browser tab title, email greeting |
| `{owner}` | Both labels joined, or the owner's chosen short name | Thank-you after a wish |
| `{count}` | A count (wishes, memories) | Section intro lines |
| `{wait}` | The server-provided wait | Not offered: limit messages are kind D |

### 2.1 The 27 keys (the complete inventory)

This table is the contract. The O18 board, the `copy_keys` seed ([data model §3.12](vegenus_data_model.md)) and the examples in §3 must all equal it; a test compares them. Caps count user-perceived characters (the Q73 rule) of the template as typed, so a token counts as its literal text such as `{days}`. Every field is a single line.

| # | Key | Where it shows | Cap | Allowed tokens | Required token |
|---|---|---|---|---|---|
| 1 | `home.greeting` | G1 greeting above the title | 120 | `partner_a`, `partner_b` | none |
| 2 | `home.days` | G1 days-together line | 120 | `days` | `days` |
| 3 | `home.photoHint` | G1 photo stack hint | 120 | none | none |
| 4 | `home.scrollCue` | G1 scroll cue | 120 | none | none |
| 5 | `memories.intro` | G2 intro line | 120 | `count` | none |
| 6 | `memories.empty` | G2 empty state | 120 | none | none |
| 7 | `together.intro` | G4 intro line | 120 | `count` | none |
| 8 | `together.search` | G4 search placeholder | 60 | none | none |
| 9 | `together.empty` | G4 empty state | 120 | none | none |
| 10 | `wishes.intro` | G5 intro line | 120 | `count` | none |
| 11 | `wishes.button` | G5 "Leave a wish" button label | 24 | none | none |
| 12 | `wishes.empty` | G5 empty state | 120 | none | none |
| 13 | `wishes.namePlaceholder` | G6 name placeholder | 60 | none | none |
| 14 | `wishes.messagePlaceholder` | G6 message placeholder | 120 | none | none |
| 15 | `wishes.sent` | G7 heading | 60 | `partner_a`, `partner_b` | none |
| 16 | `wishes.sentBody` | G7 thank-you | 120 | `owner`, `partner_a`, `partner_b` | none |
| 17 | `wishes.back` | G7 back button | 40 | none | none |
| 18 | `tour.1.title` | G9 step 1 title | 60 | `partner_a`, `partner_b` | none |
| 19 | `tour.1.body` | G9 step 1 body | 200 | none | none |
| 20 | `tour.2.title` | G9 step 2 title | 60 | none | none |
| 21 | `tour.2.body` | G9 step 2 body | 200 | none | none |
| 22 | `tour.3.title` | G9 step 3 title | 60 | none | none |
| 23 | `tour.3.body` | G9 step 3 body | 200 | none | none |
| 24 | `updates.question` | G26 updates card question | 120 | none | none |
| 25 | `page.title` | browser tab title | 60 | `partner_a`, `partner_b` | none |
| 26 | `page.description` | link preview description | 120 | none | none |
| 27 | `email.greeting` | digest and reminder greeting line | 120 | `partner_a`, `partner_b` | none |

Each key exists once per language (`en`, `vi`), so a language is complete at 27 filled fields. The first-visit tour has exactly three steps in the wording system; the former fourth step, "save your place", is replaced by the sign-in surfaces of Q77 ([guest UI §11](vegenus_guest_ui.md)) and is no longer a tour step. Token sources: `{days}` the counter (E14); `{partner_a}`, `{partner_b}` the two partner names entered in O3 step 2 (`pages.label_a`, `pages.label_b`); `{owner}` both labels joined; `{count}` the number of published memories, published places or approved wishes for that section, taken from the published snapshot only (never drafts, never pending wishes).

### 2.2 Validation rules (one function, used on save and again on publish)

1. Trim leading and trailing space; normalise to NFC. A value that is empty after trimming means "not set" (clearing a field), never an empty string.
2. Reject every control character, including line breaks and tabs (U+0000 to U+001F, U+007F). All fields are single-line.
3. Reject `<` and `>`, and any `http://`, `https://`, `www.`, `mailto:` or `javascript:` (case-insensitive).
4. Tokens are written `{name}` with `name` made of lowercase letters and underscore. Each token must be on the key's allowed list, a required token must appear at least once, a token may repeat. Any other `{` or `}` is rejected, so a typo such as `{day}` or `{{days}` fails with a plain message.
5. Length cap per the table, in user-perceived characters (an emoji or an accented Vietnamese letter counts once); the server and the form use the same counting rule.
6. Tokens are replaced by plain text when rendering and escaped like any text; wording is never interpreted as HTML or markdown.
7. **Every shipped example, in both languages, passes rules 1 to 5**, checked by a test, so "Use example" can never be rejected and block a language from completing.

Tokens are inserted from chips under the field and shown as locked chips in the preview. Unknown or malformed tokens are rejected on save with a plain message (§2.2).

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
| No photos / no welcome note | **D**, fixed system notices (Q83) | "Photos will appear here once the owners add them." / "Ảnh sẽ xuất hiện ở đây khi chủ trang thêm vào."; "The owners have not added a welcome note yet." / "Chủ trang chưa thêm lời nhắn chào mừng." |
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
| Tour step titles and bodies (3 steps, §2.1) | **B** | Step 1: "Hi, we're {partner_a} and {partner_b}." / "Chào bạn, tụi mình là {partner_a} và {partner_b}." Step 2: "Look around: memories, places and more." / "Cứ thong thả xem kỷ niệm, địa điểm và nhiều thứ khác." |
| Tour buttons Next, Back, Skip, Done | D | |
| Updates card question | **B** | "Want a note when we add something new?" / "Muốn nhận tin khi tụi mình thêm điều mới không?" |
| Consent text and unsubscribe note | D | Legal wording stays fixed |

### 3.8 Pages a guest sees without access, sign-in, settings

| Text | Kind | Note |
|---|---|---|
| "Tap the tag or scan the QR code" (G-E1) | D | Identical for every blocked case, no hints (E47) |
| Sign-in, invite code, account screens (G20-G26) | D | Security and consent wording |
| Settings (G8) labels | D | Controls keep stable names |

### 3.9 Page-level and outside the page

| Text | Kind | Example EN / VI |
|---|---|---|
| Browser tab title | **B** (≤ 60) | "{partner_a} & {partner_b}, our story" |
| Link preview description (when shared) | **B** (≤ 120) | "A small place for our memories." / "Một góc nhỏ lưu giữ kỷ niệm của mình." |
| Email greeting line in the daily digest and reminders | **B** | "Hi from {partner_a} and {partner_b}," / "Chào bạn, {partner_a} và {partner_b} gửi tin nhé," |
| Email body: counts, link, unsubscribe | C / D | No memory text, no token (S18, E50) |
| Owner area (O1-O16, O18) | D | Plain, same for everyone |

## 4. The owner's editing screen: O18 "Wording / Lời văn" (all in Settings)

- **Where:** Owner menu → Settings → "Wording / Lời văn": one screen, every editable text in one place. Editing has no wizard step (owner, 2026-10-26: all templates at once in Settings, the owner goes through and fills the empty spaces). The wizard has exactly one wording action, accepting the suggested wording (data model §3.12), which is not editing.
- **Layout:** grouped by section in the guest menu order. Each row: where it appears (a small guest-preview snippet), an EN input and a VI input, a character counter against the cap, token chips, the example shown as placeholder, "Use example / Dùng mẫu" and "Clear / Xóa". Per group and per language a "Use all examples / Dùng tất cả mẫu" shortcut, so a language can be completed in one tap and then edited.
- **Progress:** a header per language, "English: 11 of 27 set / Tiếng Anh: đã điền 11/27", with "Show empty fields only / Chỉ hiện ô còn trống".
- **Language availability (owner, 2026-10-26):** a language is **set up** when all its B fields are filled. Guests can pick only set-up languages in Settings (G8). The other option is shown but disabled with: "English hasn't been set up by the owner yet. / Chủ trang chưa thiết lập tiếng Anh." (and the Vietnamese equivalent for VI). At least the page's default language must be complete before the owner can publish wording; the page wizard (O3) default-language choice decides which.
- **Availability is derived from the published snapshot, not from G8 alone.** The set of offered languages = languages whose B fields are all in the last published wording. It applies on first arrival (phone language), on restoring a remembered choice, and in G8. If the wanted language is not in the set, the guest gets the page's default language, which is always in the set. Changing `pages.default_lang` to an incomplete language is refused, and a page cannot be made visible to guests before its first wording publication. If a later publish would leave a language incomplete, that language drops out of the set at once and remembered choices fall back to the default.
- **Memories are different:** memory titles and text keep Q67 (original text with a note when a language is missing); the language rule above concerns wording only.
- **Preview:** a "Preview as guest / Xem như khách" frame beside (laptop, tablet) or below (phone) the form updates as the owner types, in any of the four themes and either language.
- **Publish:** one "Publish wording / Đăng lời văn" button on this screen publishes all wording at once (draft until then, like `items`, data model §1 principle 3). Unsaved and unpublished states are visible in the header.
- **Validation:** exactly the rules of §2.2, applied by the same database function on save and again on publish; caps, tokens and required tokens per key are in §2.1.
- **Limits:** 27 keys per language (§2.1). The welcome note (≤ 600, kind A) is not part of this table.
- **Privacy:** wording is public once published. The screen says so beside the first field: "Everything here is visible to guests / Mọi nội dung ở đây khách đều nhìn thấy."

States of O18: default (examples as placeholders), empty field, language incomplete, language complete, unsaved changes, publishing, publish failed (input kept), over the cap, unknown token, offline, conflict with another session (compare, never overwrite), long Vietnamese text (wraps; button labels grow in height, never truncate), loading, permission lost.

## 5. Data model: specified in design 3 §3.12

The sketch that stood here is superseded by [data model §3.12](vegenus_data_model.md): the `copy_keys` reference table (the 27 keys of §2.1 with caps and tokens), `page_copy` (draft and published text per page, key and language), the `pages` revision columns, the `owner_copy_get` / `owner_copy_save` / `owner_copy_publish` functions, atomic publication, language completeness derived from the published snapshot, the access rules and the tests. Examples stay in code, beside the D texts, and are tested against §2.2. Guests read only the published snapshot through `public_open`, `guest_open` and `account_open`.

## 6. Canvas status (2026-10-27)

Two states are kept apart. **Live canvas:** Theme Preview, version 95 (not in Git); the lists below describe it. **Prepared locally, not yet published:** 63 boards completed in a local session, with 169 source and state checks and 432 browser cases passing (figures from the 2026-10-27 review; the session's own notes, including Q83, are not in the repository). Publishing them is a separate synchronisation step; until it is done, treat them as unpublished.

Built:
1. O18 Wording / Lời văn at phone, tablet and laptop: language tabs with filled count, example as placeholder, use example, clear, per-group and per-language "use examples", locked token chips, live length and token validation, guest preview, one publish button gated on the default language, ten scenarios (midway, fresh, both done, errors, long, loading, publishing, publish failed, offline, conflict) plus permission lost.
2. G8 language-not-set-up state (dashed border, `aria-disabled`, explanatory sentence) on 12 boards; the same engine feeds the Wishes and Leave-a-wish boards.
3. Example wording on the Wishes, Leave-a-wish and Settings boards (36), Home (12), Memories laptop (4) and Together search placeholder (12).

Open:
- Boards are not yet rendered and checked in a browser for this feature; longer Home lines are unchecked.
- No guest slot for the Memories intro on phone and tablet, the Together intro (all sizes), or the empty states of Memories, Together and Home; each needs a one-line slot per theme.
- No guest or email board for the updates question, page title, link description or email greeting (they appear only in O18).
- O18 has no theme selector in its preview; theme D has no greeting slot on Home; Home shows the days sentence as number plus suffix, not the full tokenised sentence.
- Home previously had a tagline per theme; the greeting and days line are now one owner-written text across A-D (Q82). Theme D keeps its editorial decor.
- O18 has no motion (reduced-motion safe by default).

## 7. Owner answers (2026-10-26)

1. **The split:** yes, A / B / C / D as in §1.
2. **Zodiac:** the owner cannot edit anything in it; they give birth data and the system computes (owner, 2026-10-26). Everything else in Zodiac stays as designed. The Q50 reword field is removed (data model, Z1, Q50 text).
3. **Section names:** no renaming; fixed (§3.2).
4. **Missing language:** a language that is not fully set up cannot be chosen by guests; the option explains it (§4).
5. **Publishing:** everything at once, in Settings (§4).
6. **Home missing content (Q83, owner 2026-10-27):** keep 27 editable fields per language; use fixed system notices for missing photos and a missing welcome note. These states add no required wording keys.
