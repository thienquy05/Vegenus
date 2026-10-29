# Privacy and cookies: notice, consent and storage

**Status:** v0.1 draft, 2026-10-29, for owner review. Documentation only; no application code. Placeholders only (rule 3). Not legal advice: a professional check before go-live is advised (PRD Q98).
**Why:** PRD Q98 (answered 2026-10-29): a "Privacy & cookies" section, S15 moved forward, built before real guest data (Phase 3). Focus on Vietnam and US rules; GDPR for reference.
**Canvas:** page 17 "Privacy & cookies" (Theme Preview, version 103, 2026-10-29; Codex board review: two findings fixed, the notice link waits while a wish is sending and G8 no longer shows "Saved on this device" when storage is blocked): `Privacy{A-D}` phone, `PrivacyTab{A-D}`, `PrivacyLap{A-D}` (P1 from G8, G6, G24 and standalone; G6, G7, G8, G24, G25, G26 with every state) and `OwnerPrivacy`, `OwnerPrivacyTab`, `OwnerPrivacyLap` (O1, O7, neutral notice). Lead design by Codex; sources and generator in the git-ignored `.design/privacy/`. Checked in a browser: 2,907 board × screen × state × language cases with no console error, no horizontal overflow and no target under 44 px; focus, Esc and contrast (minimum 5.68:1) per the generator check.
**Related:** [screens](vegenus_screens.md) (P1, changed G6, G8, G24, G25, O1, O7), [guest UI](vegenus_guest_ui.md) §6-§9 and §11, [owner UI](vegenus_owner_ui.md), [data model](vegenus_data_model.md) §3.9 and §7, [token flow](vegenus_token_flow.md) §4 and §10, [editable wording](vegenus_editable_copy.md) §1 (privacy text is kind D, fixed), PRD Q99.

## 1. What the rules ask of this site (research summary)

Secondary sources, 2026-10-29; each line is to be checked against the text of the law before go-live (§9).

| Rule | Applies here? | What it means for the design |
|---|---|---|
| **Vietnam PDPL** (Law 91/2025/QH15) and **Decree 356/2025**, in force 1 January 2026 | Likely: guests are mostly Vietnamese citizens, and the decree reaches foreign processing of their data. Whether a private individual running a family site is exempt is **unverified** (Q102) | Consent that is explicit, specific, informed, recorded (what and when), never pre-ticked or bundled; a notice that names the purpose, data types, recipients, rights and consequences; transfers to processors under a written agreement (vendor terms); a 72-hour breach notice for some data kinds. Impact-assessment filing (reported as 60 days) and its reach to an individual: **unverified** (Q102) |
| **US state privacy laws** (CCPA and about 20 others) | No: they cover businesses above revenue or volume thresholds (lowest about 35,000 consumers a year); a non-commercial couple's page with a few hundred visitors is far below | Nothing required; the notice still follows their good practice (categories, recipients, no sale) |
| **CalOPPA** (California) | Probably not: it covers operators "for commercial purposes" | Its contents cost nothing, so the notice includes them: categories collected, who receives data, how to review or correct, how changes are announced, effective date, how the site answers Do Not Track (it does no tracking, so the answer is the same either way) |
| **COPPA** (US, amended rule, compliance date 22 April 2026) | Only with actual knowledge of a child under 13 or a site directed at children. The page is for adults | The notice says the page is not meant for children; a child's wish or address is deleted when the couple learns of it (§5, Q101) |
| **EU ePrivacy Art. 5(3)** and **GDPR** (reference) | Reference only (Q98); a public personal page is outside the household exemption (CJEU C-101/01, C-25/17) | Storage strictly necessary for a service the visitor asked for needs no consent (WP29 Opinion 04/2012: session login, security, UI preferences); a persistent login cookie needs consent, hence "Keep me signed in" (§4.3) |

**Result: no cookie banner.** Everything the site stores is strictly necessary (§2). A banner, with Reject as easy to use as Accept and nothing set before a choice, becomes required the day anything non-essential is added (analytics, error reports with session replay, embeds that set third-party cookies). CI keeps this true (§8, test 1).

## 2. Storage table (shown on the notice, P1 §3.4)

Cookie and storage names are the planned ones; the final names come from the code, and test 1 checks that the table matches what the browser actually holds.

| Name | Kind | Set by | Why | How long | Needed? |
|---|---|---|---|---|---|
| `vegenus_g` | Cookie, HttpOnly, Secure, SameSite=Lax | Our server, after a tap on the tag or a QR scan | Remembers the guest link so the page opens again without a new tap | 30 days (Q34b) | Strictly necessary (the service the guest asked for) |
| `vegenus_d` (name to confirm) | Cookie, HttpOnly, Secure, SameSite=Lax | Our server, at token exchange, at the first Wishes load or post by a visitor with no token on a Published page (data model §3.9), or at the first invite-code check (G21, token flow §10.3) | A random ID used only for spam and guessing limits: 3 wishes per device per 24 hours and the per-device invite-code limit; identifies nothing outside this site | 24 hours from its last use (Q103) | Strictly necessary (security) |
| `sb-…-auth-token` (owner) | Cookie, HttpOnly, Secure, SameSite=Lax | Supabase Auth, through our server | Keeps the couple signed in | Until the browser closes (Q99); 30 days only if "Keep me signed in" is ticked (Q100) | Session: necessary. 30 days: by consent (the checkbox) |
| `sb-…-auth-token` (Member, G25) | Same | Same | Keeps a registered guest signed in | Same rule as the owner | Same |
| `sb-…-auth-token.0`, `.1` … | Same | Supabase Auth, when the session is too large for one cookie | Parts of the same sign-in cookie | Same as the cookie they split | Same |
| `sb-…-auth-token-code-verifier`, `sb-…-auth-token-flow-[FLOW_ID]-code-verifier`, `sb-…-auth-token-flows-code-verifier` | Same | Supabase Auth (the three key patterns in the installed `@supabase/auth-js`), during Google sign-in (O1) and password reset (O1, G25) | Proves the sign-in or reset was started on this browser | Until the flow finishes; an abandoned flow's lifetime is confirmed in Phase 2 and written here | Strictly necessary (security) |
| `vegenus.prefs` (local storage) | Browser storage, never sent to a server | The page | Language, view mode, reduce motion, intro animations, menu corner | Until cleared in the browser or reset in Settings | Strictly necessary (preferences the visitor sets) |
| `vegenus.seen` (local storage) | Same | The page | Tour seen, invite card and updates card dismissed (so they are not shown again) | Same | Strictly necessary (preferences) |
| `vegenus:intro:[PAGE_ID]:v1` (local storage) | Same | The page (guest motion §10.1.4) | Which section intros were already played, and the intro preference | Same | Strictly necessary (preferences) |
| `vegenus_keep` (proposed name) | Cookie, HttpOnly, Secure, SameSite=Lax | Our server, only when "Keep me signed in" is ticked | Tells the server, on each session refresh, to keep the 30-day lifetime (§4.3) | 30 days, removed at logout | By consent (the checkbox) |
| Guest link in memory | Page memory only | The page, when cookies are blocked (E30) | Lets that one visit work | Until the tab closes | Strictly necessary |
| Guest link in the address bar | The `#…` part of the URL, left in place only when cookies are blocked (token flow §4) | The browser | Lets a reload or "Open in browser" work | As long as the browser keeps that address in its history or restores the tab; the browser controls this, not us | Strictly necessary |

**Not used:** analytics, advertising, social widgets, fonts or scripts loaded from other sites at run time (fonts are self-hosted; to be confirmed in Phase 3), session recordings, fingerprinting. Vercel Web Analytics and Speed Insights stay off (they would need the banner, §1).

## 3. P1: Privacy notice / Quyền riêng tư

### 3.1 Where it opens

| Entry | Look | Notes |
|---|---|---|
| G8 Settings, new last row "Privacy & cookies / Quyền riêng tư & cookie" | Page theme, as a sheet over G8 (phone) or replacing the G8 dialog content with Back (tablet, laptop) | Back returns to G8 with focus on the row |
| G6 consent line link "privacy notice / thông báo quyền riêng tư" | Page theme, sheet stacked over G6 | Back returns to G6 with the draft and the checkbox state kept (no draft loss) |
| G24, G26 consent text link | Page theme in a page, neutral when standalone | Same return rule |
| G-E1, G-E2, G-E3 small text link at the bottom | Neutral | These screens reveal nothing about the page; the notice does not either (§3.3) |
| O1 login, link under the form | Neutral owner look | — |
| Standalone route `/privacy` | Neutral (screens "Neutral and themed" rule) | Reachable without a token; `noindex` like guest routes |

### 3.2 Layout

Phone: full-height sheet, 16 px padding, 56 px heading row with Close (and Back when stacked), contents list of section links at the top, then sections; reading width the full sheet. Tablet: centered 640 px dialog, contents as a sticky list above the text. Laptop: centered 1040 px region, 240 px contents rail on the left (sticky) + 32 px gap + 720 px reading column. Standalone route: same compositions in the neutral set, with the page's bar replaced by a plain header ("Privacy / Quyền riêng tư") and a "Back / Quay lại" that uses history, or links to `/` when there is none.

Body text 16 px, 1.6 line height, maximum 72 characters per line. The storage table (§2) is a real `<table>` on tablet and laptop and becomes labelled records on phone, at 320 px and at 200 % text. Language follows G8; the standalone route follows the stored G8 choice when one exists on the device, otherwise the browser language (Vietnamese when it starts with `vi`, English otherwise). No language switch on the page (Q67).

### 3.3 Who is named

The notice names **"the couple who run this page / cặp đôi quản lý trang này"**, never the partners' names. Reason: the standalone route and the no-access screens must not reveal whose page it is (G-E1 rule). **No contact address on the notice for now (owner, 2026-10-29, Q105).** Requests go to the couple directly, whom guests know personally ("Ask the couple who run this page / Hãy hỏi trực tiếp cặp đôi quản lý trang này"). The notice is therefore fixed text only (kind D), identical on every copy, and holds no owner-supplied value. A contact address is reconsidered before go-live with the professional check (Q102, Q105).

### 3.4 Sections (fixed text, kind D, EN/VI)

Short sentences, no legal Latin. Section headings, and what each says:

1. **Who we are / Chúng tôi là ai**: a personal, non-commercial page made by the couple who run it, for family and friends.
2. **What we collect / Chúng tôi thu thập gì**: wishes (name you type, message, language, time, your consent); for Members: email, display name, password (stored scrambled by our sign-in provider), email choices; for email updates: email, language, consent; a scrambled code made from your network address and a random device ID, kept 24 hours, only to stop spam and code guessing; what the couple uploads about themselves. **We never ask for** your birthday, location, contacts or photos.
3. **Why / Vì sao**: to show the page, publish wishes after approval, send email you asked for, stop spam and keep the page secure. Nothing is sold, used for ads or profiled.
4. **Cookies and storage / Cookie và lưu trữ**: the §2 table, then "We don't use analytics or advertising cookies, so there is nothing to accept or refuse. If that changes, we will ask first." Do Not Track: "We don't track you across sites, so a Do Not Track signal changes nothing here."
5. **Who sees it / Ai thấy thông tin**: guests see only approved wishes (name and message); the couple sees pending wishes, Members and subscribers; services that run the site on our behalf (hosting: Vercel; database, sign-in and files: Supabase; email: Resend, once email starts, Q37). Their servers may be outside Vietnam (regions in Q104). Nobody else, unless the law requires it.
6. **How long / Lưu bao lâu**: from data model §7 in plain words: approved and pending wishes until the couple or you ask to delete them; rejected wishes 30 days; spam-protection codes 24 hours; unconfirmed email-updates sign-ups 24 hours; unfinished Member sign-ups at most 30 minutes (or until a half-finished account is cleaned up); unsubscribed addresses 30 days (then only a scrambled code stays so we don't add you again by mistake); email records 90 days, without the address; hosting and database logs at most 30 days where the vendor lets us set it, never more than 90 days (Q104; the real figure per vendor is checked in the dashboards before Phase 3 and stated here). When the page is deleted, its content and accounts are removed at once, and files and sign-in records follow as soon as the cleanup job confirms them; the scrambled "do not add again" codes stay so an unsubscribed address is never mailed again.
7. **Your choices / Quyền của bạn**: see, correct or delete what you sent, withdraw consent (deleting a wish withdraws it; unsubscribe links in every email; Members can remove their account through the couple), ask what we hold. Ask the couple directly; they answer within 30 days (Q101). Withdrawing consent does not undo what was lawfully done before. If something goes wrong with your data we will tell you as the law requires.
8. **Children / Trẻ em**: the page is not meant for children. Under 16, ask a parent or guardian before leaving a wish or an email (Q101). If we learn a child under 13 sent something, we delete it.
9. **Changes / Thay đổi**: the date at the top; a change that needs new consent asks again (the consent version, §4).

Header line under the title: "Last updated [DATE] / Cập nhật lần cuối [DATE]". `[DATE]` comes from the notice version, not the deploy time.

### 3.5 States

| State | Behavior |
|---|---|
| Default | As above |
| Loading | None: the notice is fixed text that ships with the page; the standalone route renders on the server |
| Read failure | Not possible for the text itself; a failed route load uses G-E3 |
| Offline | Readable when already loaded as a sheet; the standalone route offline shows the browser's own offline page |
| Empty | Not applicable: every section always has its fixed text |
| Long Vietnamese text | Wraps, never truncates; the table becomes labelled records; checked at 320 px and 200 % |
| Missing translation | Not possible: fixed text ships in both languages (a CI check, test 6) |

Accessibility: `role=dialog` with the heading as label when shown as a sheet; Esc and Close (≥ 44 px) return focus to the invoker; contents links move focus to the section heading; the table has a caption and header cells. Motion: the theme's sheet entrance (guest motion §10.2); reduced motion shows it without movement. The contents rail never animates.

## 4. Consent lines (changes to existing screens)

### 4.1 G6 Leave a wish: consent checkbox

Under the message field, above Send. Unchecked by default, never remembered between wishes (each wish is its own consent).

> **EN:** "I agree that my name and wish are stored and shown on this page after [OWNER] approves them. [privacy notice]"
> **VI:** "Tôi đồng ý để tên và lời chúc của tôi được lưu và hiển thị trên trang này sau khi [OWNER] duyệt. [thông báo quyền riêng tư]"

- The whole label is the 44 px target; the link inside it opens P1 and does not toggle the box.
- Send stays enabled (the guest UI rule: Send validates). Unchecked on Send: inline "Tick the box to send your wish. / Đánh dấu ô để gửi lời chúc." and focus moves to the checkbox; the name and wish errors come first in focus order when they also fail.
- The server refuses a post without consent (the box is not trusted from the client alone) and stores `consent_version` and `consent_at` with the entry (data model change, §7).
- **Changed network line** (replaces guest UI §8 "Privacy copy", which said the address is never stored; the HMAC of it is kept 24 hours, data model §3.9):
  > **EN:** "To stop spam, we keep a scrambled code made from your network address for 24 hours, never the address itself."
  > **VI:** "Để chặn spam, chúng tôi giữ một mã đã mã hóa từ địa chỉ mạng của bạn trong 24 giờ, không lưu chính địa chỉ đó."
- States added to guest UI §8: consent missing (above); consent version changed while the form was open (the server answers "needs consent again": the box unticks and "We've updated the privacy notice. Please tick again. / Thông báo quyền riêng tư đã được cập nhật. Vui lòng đánh dấu lại." appears). The draft is always kept.
- Signed-in Members tick it too (their account consent, §4.2, covers the account, not each published wish).

### 4.2 G24: account consent added; G26: one link added

**G24** gains a second, required checkbox above the optional updates one, unchecked:

> **EN:** "I agree that my email and display name are stored to run my Member account on this page. [privacy notice]"
> **VI:** "Tôi đồng ý để email và tên hiển thị của tôi được lưu để duy trì tài khoản Thành viên trên trang này. [thông báo quyền riêng tư]"

Confirm with it unticked: "Tick the box to create your account. / Đánh dấu ô để tạo tài khoản." and focus moves to it; the password stays. The server refuses confirmation without it and records `account_consent_version` and `account_consent_at` on the registration, copied to `guest_accounts` at verification (§7). The optional updates checkbox is unchanged (Q81) and stays separate, so neither consent is bundled with the other.

**G26** and the G24 updates text gain the "privacy notice / thông báo quyền riêng tư" link.

**Outdated notice (G24 and G26, same rule as G6):** each POST carries the notice version it showed. A new confirmation with an older version gets "needs consent", stores nothing, keeps the typed values (G24 keeps the password in the field, G26 the email), unticks the boxes and shows the G6 line "We've updated the privacy notice. Please tick again." A retry or recovery of a registration already in `confirming` reuses the consent recorded on its first POST (data model §3.6) and is not asked again; consent already given is never rewritten.

### 4.3 "Keep me signed in / Duy trì đăng nhập" on O1 and G25

Unchecked checkbox between the password field and the Sign in button, with help text:

> **EN:** "Stays signed in on this device for 30 days."
> **VI:** "Giữ đăng nhập trên thiết bị này trong 30 ngày."

- Off: the session cookie ends when the browser closes (Q99, already built in T1.4). On: the server records the choice for that sign-in session (§7, with consent version and time), sets the `vegenus_keep` cookie, and writes the session cookies with `Max-Age` 30 days (Q100). A refresh cannot read a cookie's lifetime, so the server decides from the session record (the `vegenus_keep` cookie only names it; a missing or unmatched record means session-only). The 30 days count from sign-in and are not extended by refreshes. It is never pre-ticked and never remembered after logout; logout deletes the record and both cookies.
- Google sign-in (O1): the same checkbox applies; it sits above both buttons so its scope is visible.
- States: unchanged O1 and G25 states; offline keeps the checkbox state with the typed fields.

### 4.4 G8 Settings: new row and a reset

- Last group, "Privacy / Quyền riêng tư": row "Privacy & cookies / Quyền riêng tư & cookie" (opens P1) and button "Clear saved settings on this device / Xóa cài đặt đã lưu trên thiết bị này" (removes `vegenus.prefs`, `vegenus.seen` and the `vegenus:intro:` keys; the guest link cookie stays, because removing it would lock the guest out until the next tap). Confirmation inline: "Cleared. / Đã xóa." The device note keeps its existing wording.
- States: clear failed (storage blocked) shows the existing persistence-failure line.

## 5. Requests from guests (no new guest screen)

Guests ask the couple directly (Q105); no request form and no contact address (a form would store more data and need email, Q37). The couple acts with tools that already exist or are planned:

| Request | Owner tool |
|---|---|
| Delete my wish | O7: delete a pending, approved or rejected wish (O7 gains Delete, §6) |
| Correct my wish | The couple deletes it and the guest sends a corrected one, which goes through approval again; the couple never rewrites a guest's words (owner UI O7) |
| Correct my Member name or email | O15 Remove account, then a new invite code if wanted (no edit path in v1) |
| Delete my account | O15 Remove account |
| Stop emails | Unsubscribe link (S19a); O15 Remove subscriber |
| What do you hold about me? | O7 search by display name, O15 lists; the couple replies by email |
| Child's data | Same deletions |

## 6. Owner side

**No O19 screen** (dropped 2026-10-29 with Q105): with no contact address the notice has nothing for the owner to set. The owner reads it from the O1 link, at `/privacy`, or in the guest preview through G8.

**O7 change:** the reading panel shows "Consent given [DATE] [TIME] / Đã đồng ý lúc [TIME] [DATE]" under the metadata, and every entry (pending, approved, rejected) gains "Delete / Xóa" with a confirm ("Delete this wish for good? / Xóa vĩnh viễn lời chúc này?"). Delete removes the row at once, unlike Reject, which keeps it 30 days.

## 7. Data model changes (design 3, applied when T3 builds the wish tables)

- `guestbook_entries`: add `consent_version smallint not null`, `consent_at timestamptz not null`. The posting functions take `consent_version` and refuse a missing or outdated one with a distinct "needs consent" result (no quota consumed, like a replay).
- `privacy_notice_version smallint` as a server constant with its `[DATE]`; G6, G24 and G26 send the version they showed.
- `pending_registrations` and `guest_accounts`: add `account_consent_version smallint`, `account_consent_at timestamptz`, set on the G24 confirmation POST with the updates choice (same atomic step, data model §3.6) and copied at verification; `join_verify` refuses without it. `subscribe_request` and the G24 confirmation refuse an outdated `consent_version` with "needs consent" (§4.2).
- `session_keep` (PK the Auth session id, FK user, `consent_version`, `consent_at`, `expires_at` = sign-in + 30 days): one row per sign-in session that ticked "Keep me signed in"; read by the cookie writer on each refresh; deleted at logout, at expiry by the daily job, and with the user. RLS with no client access; written only by our server.

## 8. Tests to write first

1. **Storage audit (E2E, every guest and owner route, phone):** after a full visit (tap, read, wish, settings, sign-in with and without "Keep me signed in", Google sign-in and password reset, each finished and abandoned, once those flows exist) the browser's cookies and local storage contain exactly the §2 names, with the §2 lifetimes and flags; no third-party request sets a cookie; no request goes to an analytics host. RED first against the current app: `vegenus.prefs` does not exist yet, so the table and the browser differ.
2. G6: Send with the box unticked shows the consent error and focuses the box; a crafted post without consent is refused by the server and stores nothing; a post with an old version returns "needs consent" and keeps the draft; the box is unticked again on the next wish.
3. O1 and G25: unticked gives a cookie with no expiry (Q99 test stays); ticked gives `Max-Age` 30 days and a `session_keep` row with consent version and time; a refresh after ticking keeps the 30-day lifetime and does not extend it; a forged `vegenus_keep` cookie with no matching row gives a session-only cookie; logout removes the cookies and the row.
4. P1: reachable at `/privacy` with no token, shows no partner name, no contact address and no page content, and is the same text as the in-page sheet; no language switch; opened from G6 and closed returns to G6 with the draft and checkbox kept; Esc, focus return, contents links, 320 px and 200 % without horizontal scroll; the storage table becomes records on phone.
5. (Removed with O19, Q105.)
6. Every P1, consent and Keep-me-signed-in string exists in EN and VI (fixed-text check), and the notice `[DATE]` matches `privacy_notice_version`.
7. G8 "Clear saved settings" removes `vegenus.prefs`, `vegenus.seen` and every `vegenus:intro:` key and keeps `vegenus_g`.
8. G24: Confirm with the account box unticked is refused by the server and keeps the password; ticking only the account box creates the account with updates off; both consents are recorded separately. G24 and G26 with an older notice version get "needs consent" and store nothing; a retry of a `confirming` registration keeps its first consent.
9. O7: Delete on a pending, an approved and a rejected wish removes the row at once.

## 9. Open points

PRD Q100-Q104, answered by the owner 2026-10-29: Q100 "Keep me signed in" lasts 30 days; Q101 reply within 30 days, "under 16, ask a parent", under-13 data deleted when known; Q102 design for notice and recorded consent now, professional check of the PDPL duties before go-live; Q103 device cookie 24 h from its last use (wish or invite-code check); Q104 vendor logs kept 30 days where a setting allows, never more than 90 days. Still to do before Phase 3: read the vendor regions and log retention in the Supabase and Vercel dashboards and state them in §3.4 item 6; a vendor that keeps logs longer than 90 days with no setting goes back to the owner.

Sources (secondary, 2026-10-29): Vietnam: Tilleke & Gibbins, EY Vietnam legal alert March 2026, Lexology, DLA Piper Data Protection Laws of the World. US: Federal Register 2025-05904 (COPPA amended rule), Hunton and Davis Polk on COPPA, IAPP and Baker Donelson on 2026 state laws, Hunton and Pillsbury on CalOPPA's Do Not Track amendment. EU: as in PRD Q98.
