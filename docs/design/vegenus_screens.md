# Design 2: Screen inventory (low fidelity, no visuals)

**Status:** v0.4, **approved by the owner 2026-10-23** (v0.2, 2026-10-22: tour, guest account, Zodiac, email settings added; v0.3, 2026-10-23, owner on the preview canvas: G1 lower area on branch `docs/theme-nav-icons`; v0.4, same day: G1 lower area replaced by section shortcuts). Purpose: fix *what each screen shows and lets you do*, so the data model (design 3) can be drawn from it. Colours, type, layout and 3D come later (theme system, 3D approach).
**Date:** 2026-10-21
**Inputs:** PRD §3.1, §4.1, §6; design 1 (`vegenus_token_flow.md`).
**Privacy:** placeholders only.

Rules for every screen: phone-first, one-hand use, touch targets ≥ 44 px, all text from EN/VI string keys, works in Static mode with no WebGL, and has loading, empty and error states. World and Page modes are other presentations of the same guest screens, not extra routes.

**Motion handoff (draft, PRD Q69-Q70):** [guest motion](vegenus_guest_motion.md) specifies connected menu/section transitions, grouped scroll reveals and dynamic backgrounds. [Section handoffs](vegenus_guest_motion.md#4-section-handoffs) cover G1-G9 and Z2, memory-detail return, direct links and browser history. G0, G10, G11 and access errors retain their existing loading/auth/form behavior; no decorative transition delays access checks or submission. The screen inventory and section routes are unchanged. New supplements are not covered by the earlier screen-inventory approval.

## Design map (which file owns what)

| Topic | File |
|---|---|
| Screen inventory, states, responsive matrix | this file |
| Guest sections: status, specifications, tests | [guest UI](vegenus_guest_ui.md) |
| Owner area | [owner UI](vegenus_owner_ui.md) |
| Motion, backgrounds, signature entrances | [guest motion](vegenus_guest_motion.md) |
| Which wording the couple edits, which is generated or fixed (Q82, answered); storage in [data model §3.12](vegenus_data_model.md) | [editable wording](vegenus_editable_copy.md) |
| Themes, menu, tokens, fonts, contrast | [theme system](vegenus_theme_system.md) |
| 3D scenes, Zodiac sky, performance modes | [3D approach](vegenus_3d_approach.md) |
| Logo and brand assets | [assets/logo/README.md](../../assets/logo/README.md), PRD Q60 |
| Generated art prompts | [Codex image brief](vegenus_codex_image_brief.md) |
| Access contracts, data, CI | [token flow](vegenus_token_flow.md), [data model](vegenus_data_model.md), [CI spec](vegenus_ci_spec.md) |

## Guest screens (`/g/...`)

| ID | Screen | Shows | Actions | Reads | Notes |
|---|---|---|---|---|---|
| G0 | Opening | Short loader while the token is exchanged | — | `guest_open` | Clears the fragment; no content before the check passes |
| G1 | Home / intro | Couple title ([PARTNER_A] & [PARTNER_B]), a tap-to-advance stack of 3-7 owner-picked photos, a welcome note written by the owner (≤ 600 characters per language), days-together counter (Q64). Phone, tablet and laptop have their own compositions (approved 2026-10-24). No section tiles and no tour button (the tour replays from G8) | Go to a section (shortcut or menu); open settings (menu) | page, home item, counter start, enabled sections (`*_open`) | Counter rules: E14. A disabled section has no shortcut; with one or two shortcuts they keep their size and the space stays sky. The shortcuts are links (≥ 44 px), not a second menu: no state, no counts. Replaces the "on this day" card, "latest wish" strip and "leave a wish" button of v0.3 (owner, 2026-10-23: "I don't like the 2 containers"); leaving a wish stays in G5 |
| G2 | Memories | Grid or list of published memories: thumbnail, title, date | Open one; load more | memories, media thumbnails | First visit ≤ 3 MB (plan §3) |
| G3 | Memory detail | Album / book (design round 4): opening page with contents, message text, voice note, photo pages that fill the page (grid follows the photo count), video page; text in the language chosen in Settings, original text plus a note when that language is missing (Q67) | Turn pages (buttons, page list); open photo viewer; play voice/video. Owner: edit pages with layouts and + slots, stickers (Q66) | memory, media URLs (5 min) | Missing second language falls back (E13); menu button hides under overlays (Q68) |
| G4 | Together | Illustrated, made-up 3D map per theme with theme signature pins in fixed seeded slots (Q63), searchable place list, place card (photo, place, date, note), counter | Open a milestone | milestones, anniversaries | Map approved (v5.2, 2026-10-24); signature entrance proposed: motion §10.1 |
| G5 | Guestbook | Approved messages, newest first; "Leave a wish" button | Open G6; load more | approved entries | Hidden if the section is disabled |
| G6 | Leave a wish | Display name (required), message (language follows Settings, Q67), one-line note that the network address is checked briefly to stop spam and not stored | Send | — | Name/text limits: Q34c; rate limits: Q75 and Q78 (3 per device per rolling 24 h, per-IP limit 20, 50 per page per day; blocked = plain notice with the come-back time). Shown to anyone who can see the page, including a visitor with no credential on a Published page (Q78). Plain text only |
| G7 | Sent | "Thanks, it will appear after [OWNER] approves it" | Back to guestbook | — | Guest does not see their pending message (Q34d, answered) |
| G8 | Settings sheet | Language EN/VI, mode World/Page/Static, reduce motion, menu corner (top left / top right; design 4 §2), replay the tour (G9) | Change; remembered on this device | — | Mode auto-chosen first (FR13) |
| G9 | First-visit tour | 3-step pop-up over G1 (steps worded by the owner, editable wording §2.1): what this is, what you can see, leave a wish. Sign-in is offered by the Q77 surfaces, not as a tour step | Next, Back, Skip, Done | — | Once per device (once per account when signed in); `role=dialog`, focus trap, Esc, reduced motion; never delays G0; replay from G8 (S20, Q40) |
| G10 | ~~Save my place~~ (superseded 2026-10-26 by G20–G25 in [guest UI §11](vegenus_guest_ui.md): invite code, create account, check email, confirm) | Invite code, email, password, optional display name | Create account | `join_register` (rate limited) | No token session needed; needs an owner-issued code and email to guests (Q37 Phase B, Q38, Q79) |
| G11 | Guest sign-in (now G25) | Email and password; forgot password | Sign in | auth | Same generic errors as the owner login; sign-up only through an invite code (Q79). Neutral look when opened as a standalone route, page theme when opened as a sheet (see "Neutral and themed" below) |
| G20 | Account entry points | Menu item "Sign in" / "Account"; Settings rows: sign in, "I have an invite code", "Get updates by email" | Open G21, G25 or G26 | — | Never a pop-up on arrival; no gate (Q77). [Guest UI §11](vegenus_guest_ui.md) |
| G21 | Invite code | One code field | Continue | `join_code_check` (rate limited) | One generic error for wrong, used, revoked or expired (Q79) |
| G22 | Start sign-up | Email, optional display name | Continue | `join_register` (rate limited) | Reserves the code for at most 30 minutes and no longer than the invite deadline; a retry by the same address reuses the reservation (E44) |
| G23 | Check your email | Address typed, actual reservation-expiry time | Send again; use a different email | `join_register` | Same screen whether the address is new or existing (E48); needs Q37 |
| G24 | Choose password and confirm | Landing with a password field, unchecked updates-consent checkbox and a Confirm button; success | Confirm; continue | `join_verify` | A bare link never confirms. Standalone route: neutral look until `account_open` |
| G25 | Sign in / forgot password | Email, password, forgot password | Sign in | auth | Replaces G11. The owner signs in at `/login` (O1) |
| G26 | Updates card and subscribe | Email, unchecked consent box | Send confirmation; Not now | `subscribe_request` | Shown in G7 and after other interactions; confirm and unsubscribe landings use a button (E48); needs Q37 |
| Z2 | Zodiac (guest view, read-only) | Galaxy-style animated scene (stars, glow, constellation lines) with the couple's signs as the owner's character art (built-in default art from `assets/zodiac-sign/` until uploaded), each partner's label and signs, and the relationship reading (EN/VI, "for fun"). If the owner opted in to details: the sky at birth as a 3D scene (Moon at its phase, planets on the ecliptic; design 5) with its line, or a 2D Moon picture plus the line in the simple version. Never a birth date | Switch Western / Vietnamese (opens on the owner's default) | stored signs, sign art, reference texts | Guests do not enter a birthday. Shown when enabled, like every section (Q49). Systems: Q47; reading: Q48 (design 3 §3.10-3.11). Reduced motion shows the still image (E41, S21) |
| G-E1 | No token | "Tap the tag or scan the QR code" | — | — | Same screen for wrong, rotated or private (no hints) |
| G-E2 | Opened in an app that dropped the link | Steps to open in Safari/Chrome | — | — | E30 |
| G-E3 | Not available / offline / database paused | Calm message, retry | Retry | — | E17, E23 |

## Owner screens (`/app/...`, login required; both partners use the one Owner account, co-editor deferred)

| ID | Screen | Shows | Actions | Who |
|---|---|---|---|---|
| O1 | Log in | Google button; email + password | Log in | Both. No sign-up link (closed registration, Q30) |
| O2 | Dashboard | Empty state "Set up your page" or page overview: visibility, sections, pending guestbook count, usage meter | Go to setup, content, moderation, share | Owner (both partners use the one account, Q35) |
| O3 | Page setup wizard | Six steps: theme (preview), default language and partner names (required), time zone (prefilled from the browser; design 3 §3.1), sections on/off, wording (sample of the suggested texts in EN and VI with a guest preview), visibility (default offered: Token-only). The page is Private until Finish succeeds | Next/back; "Use the suggested wording"; Finish and publish (wording and visibility in one action; failure keeps choices and offers Retry) | Owner. [Owner UI](vegenus_owner_ui.md), [data model §3.12](vegenus_data_model.md) |
| O4 | Section content list | Items with draft/published badge, language, date | New; edit; publish/unpublish; reorder | Both |
| O5 | Item editor | Title, date, text (language), optional second-language text, media list | Save draft; publish; delete | Both. "Changed by someone else" prompt instead of silent overwrite (E15) |
| O6 | Media upload | Picker, compression progress, size/count caps, "location removed" note | Add; retry; cancel | Both. E7–E10 |
| O7 | Guestbook queue | Pending entries | Approve; reject | Both |
| O8 | Share | Link and QR (shown **once** after creation/rotation: Q34a decided), optional QR download with a "this is a live credential" warning, tag-writing steps, "link not shown yet" state with Rotate again, note that rotation keeps guest accounts | Copy; download QR; rotate token | Owner |
| O9 | Visibility and sections | Private / Token-only / Published; section toggles | Change (with a confirm for Private and Published) | Owner |
| O10 | Usage | Storage and egress against free limits; warnings at 60% and 80% | — | Owner |
| O11 | Shared account | The one shared owner account (Q35). No co-editor screen until a second account is wanted | Change password; link Google | Owner |
| O13 | First-run tour | 3 steps on the empty dashboard: set up the page, add the first memory, create the guest link | Next, Skip, replay from O12 | Owner (and partner) |
| O14 | Email settings | Reminder lead time, wish digest on/off, last sends and failures | Save; send test to own address | Owner |
| Z1 | Zodiac: our birth data | For each partner: label, birth date, birthplace (picked from a list), optional birth time; after saving, the computed Western sun/Moon/rising signs and Vietnamese pillars, animal and mệnh; the sky at birth (Moon phase, planets and their signs, nearby sky events such as an eclipse or a meteor shower) with its composed line, which the owner cannot reword (generated, Q82); per partner a "show details to guests" switch with the warning that details can reveal the exact birthday (Q50); default system for guests; note that the date, time and place are encrypted and never shown, and that guests can work out the birth year from the basic signs; for a birthday near Tết, a warning with the number of days guests could narrow it to, and a choice to hide the Vietnamese animal for that partner; "changes not published" badge | Save; Publish; Unpublish | Owner. Design 3 §3.10, E40 |
| O15 | Guest accounts and subscribers | Guest accounts with cap counter `[N]/50`; email subscribers with count | Remove one; remove all | Owner. [Owner UI](vegenus_owner_ui.md) |
| O16 | Invite codes | Code list (label, state, created, expires, reserved until); cap counter | Create code (show-once panel); revoke | Owner (design 1 §10.3) |
| O18 | Wording / Lời văn | Every editable text (27 keys, EN and VI) with example, token chips, progress per language, live guest preview | Save; use example; clear; Publish wording | Owner only, in Settings. [Editable wording](vegenus_editable_copy.md), [data model §3.12](vegenus_data_model.md) |
| O12 | Account | Language, log out | — | Both |

## What this tells the data model (input to design 3)

- Home needs a single `home` item per page (title, cover media, counter start date and timezone).
- Memory needs title, date (with precision: day/month/year), text + language, optional second-language text, ordered media.
- Milestones and anniversaries need a date and a recurrence flag for anniversaries.
- Guestbook entries need display name, text, language, status, author kind (token, account or visitor), token version, created time.
- Page needs theme, default language, visibility, section flags, and a `token_shown_at` timestamp for O8.
- Account, consent and email entities (guest accounts, pending registrations, email preferences, email log, saved sign) belong to design 3 and each carries `page_id` or a user bound to one page.
- Every editable row needs `updated_at` (or a version number) for the overwrite check in O5.

## Tests derived from screens (written failing first)

Also apply [guest motion §9](vegenus_guest_motion.md#9-tests-to-write-first) when motion is implemented: interruptions, focus/history, reduced motion, slow-loading and revoked-access destinations, contrast through transitions and phone resource limits.

One Playwright flow per row, phone viewport, EN and VI:

1. Tap link → G0 → G1 with only the enabled sections in navigation.
2. G2 → G3: thumbnails load first; video does not download before tap.
3. G6 → G7: empty name blocked; message appears in O7; after approval, it appears in G5.
4. O1 → O2 empty state → O3 → O8 shows the link once.
5. O9 set Private → open guest tab shows G-E1 on next action.
6. O5 opened in two sessions → second save shows the conflict prompt.
7. G1 first visit shows G9 once; Skip closes it; second visit does not show it; replay from G8 works.
8. Visitor with no token opens a Published page → G20 → G21 with a valid `[CODE]` → G22 (email, no password) → G23 → verification link opens G24 → choose a password → Confirm → signed in; a wrong, used, revoked or expired code gives one identical message; a retry from the same address reuses the reservation; on a Token-only page with no token none of G20–G26 is reachable (E47).
8c. Typo in the email at G22: the link never arrives; G23 offers a different address only after the original expiry time; then the same code works again with the corrected address (E45); a resend before that shows the original expiry.
8a. Visitor with no token on a Published page sends a wish through G6 → G7 and it appears in O7; on a Token-only page with no token there is no form (G-E1, E47); the 4th wish from one device inside 24 hours shows the come-back time.
8b. Owner opens O18 → fills the default language → Publish wording → guest sees the wording; a language with an unfilled field is shown disabled in G8; clearing a field and publishing drops that language; two sessions saving the same field show the comparison.
9. Owner saves birth dates in Z1 → guest Z2 shows both signs and the reading, and the page source and network responses contain no date; an invalid date is rejected; reduced motion shows a still image.
10. Unauthenticated visit to `/app`, `/app/anything`, `/home` shows login or not-found and no owner data.
10a. Owner finishes O3 → the wording is published and the chosen visibility set together; a forced failure leaves the page Private with every choice kept and Retry works; a guest opening the link before Finish gets the generic not-available page.
11. Missing information (E51–E58): an enabled section with no items shows its empty state; a deleted item opened from an old link and an unknown id show the same "no longer available" page; a page with no start date hides the counter; a Home item with no photos, no welcome note, and neither shows fixed system notices only (Q83), with no sample photo, signature or photo counter; the daily job with nothing new or no eligible recipient sends and queues nothing and logs zero; a language that is not set up is disabled in G8; a new owner sees "Set up your page" and no public output.
12. Tour shown once, skippable, Esc closes, focus trapped, token exchange never delayed, replay from G8 (E42). Empty Zodiac section shows its empty state (E57). Place with no photo shows the default scene (E20, after core).

## Responsive coverage matrix (guest and owner, phone / tablet / laptop)

“Owner” includes the partner using the shared account. Owner guest previews use the corresponding guest composition inside the neutral preview shell.

| Section | Phone — guest | Tablet — guest | Laptop — guest | Phone — owner | Tablet — owner | Laptop — owner |
|---|---|---|---|---|---|---|
| Home | Stack, hero, welcome | Note + hero + photo fan | Three aligned columns | Guest preview | Guest preview | Guest preview |
| Zodiac | Signs + six tiles | Signs + 3×2 tiles | Sign \| tiles \| sign | Guest preview; Z1 separate | Same | Same |
| Memories | Two columns; one at reflow | Featured + three columns | Year panel + four columns | O4 records / preview | O4 rows / preview | O4 rows / preview |
| Memory detail | Single album page | Two-page spread | Two-page spread | O5 stacked editor | Page list + editor | List + editor + inspector |
| Together | Map + controls + sheets | Map + list/card dock | List \| map \| card | Guest preview | Guest preview | Guest preview |
| Wishes G5 | One card column | Centered reading column | Intro + reading column | Preview / O7 stacked | Preview / queue-detail | Preview / queue-detail |
| G6/G7 | Bottom/full-height sheet | Centered 560 px dialog | Centered 600 px dialog | Nonposting preview | Nonposting preview | Nonposting preview |
| G8 | Bottom sheet | Centered dialog | Centered dialog | Preview-local controls | Same | Same |
| O1/O12/O11 | No access | No access | No access | Single form | Centered form | Centered form |
| O2/O10 | No access | No access | No access | Stacked panels | Two columns | Two/three columns |
| O3/O13 | No access | No access | No access | Stacked steps/sheet | Choices + preview/dialog | Choices + preview/dialog |
| O4/O5/O6 | No access | No access | No access | Records/editor/queue | Two regions | Up to three regions |
| O7/O15 | No access | No access | No access | Records | List + detail | Table/list + detail |
| O14 | No access | No access | No access | Stacked form/history | Form + history | Form + history |
| G20–G26 (sign-in, invite code, create, check email, confirm, updates) | Bottom sheet, 48 px fields, keyboard-safe | Centered 560 px dialog | Centered 600 px dialog | No access (owner uses O1) | No access | No access |
| O15/O16 | No access | No access | No access | Labelled records; create-code dialog | Table; dialog | Table; dialog |
| O18 | No access | No access | No access | Stacked form, collapsible guest preview below | Form + preview side by side | Form + preview side by side |

### State matrix for the account, invite and wording screens

Every screen in the rows above has: default, empty, loading, error with retry, limit reached (calm notice, no numbers), offline (input kept, submit disabled) and long Vietnamese text (wraps, never truncates; 320 px and 200 % checked). Screen-specific states: G21–G23 add "email not available" (Q37) and "code can't be used"; G24 adds "link expired or used"; G26 adds "confirmation pending"; O16 adds "show-once code panel" and cap reached; O18 adds incomplete language, unsaved, publishing, publish failed, conflict and permission lost. Owners of the detail: [guest UI §11.3](vegenus_guest_ui.md), [owner UI](vegenus_owner_ui.md), [editable wording §4](vegenus_editable_copy.md).

### Neutral and themed authentication screens

One rule for G11/G24/G25 and the other account screens: **opened inside a page** (from the menu, Settings or the card after a wish) they are sheets that use the page theme, because the theme is already known. **Opened as a standalone route** (the verification link from an email, `/signin` typed or bookmarked, the password-reset link, the unsubscribe landing, G0, G-E1 to G-E3) there is no page context yet, so they use the neutral set until `account_open` returns `pages.theme`; then the theme applies. The owner area is always neutral (Q56). Same controls, labels and placement in both looks.
