# Design 2: Screen inventory (low fidelity, no visuals)

**Status:** v0.2, **approved by the owner 2026-10-23** (v0.2, 2026-10-22: tour, guest account, Zodiac, email settings added). Purpose: fix *what each screen shows and lets you do*, so the data model (design 3) can be drawn from it. Colours, type, layout and 3D come later (theme system, 3D approach).
**Date:** 2026-10-21
**Inputs:** PRD §3.1, §4.1, §6; design 1 (`vegenus_token_flow.md`).
**Privacy:** placeholders only.

Rules for every screen: phone-first, one-hand use, touch targets ≥ 44 px, all text from EN/VI string keys, works in Static mode with no WebGL, and has loading, empty and error states. World and Page modes are other presentations of the same guest screens, not extra routes.

## Guest screens (`/g/...`)

| ID | Screen | Shows | Actions | Reads | Notes |
|---|---|---|---|---|---|
| G0 | Opening | Short loader while the token is exchanged | — | `guest_open` | Clears the fragment; no content before the check passes |
| G1 | Home / intro | Couple title ([PARTNER_A] & [PARTNER_B]), cover image, days-together counter, links to enabled sections | Go to a section; open settings | page, home item, counter start | Counter rules: E14 |
| G2 | Memories | Grid or list of published memories: thumbnail, title, date | Open one; load more | memories, media thumbnails | First visit ≤ 3 MB (plan §3) |
| G3 | Memory detail | Text (entry's language, optional second language), photos, short video (tap to play, poster first), voice note | Swipe between photos; play; language toggle for this entry | memory, media URLs (5 min) | Missing second language falls back (E13) |
| G4 | Together | Timeline of milestones; anniversaries; counter. Later: places map | Open a milestone | milestones, anniversaries | Places map is after core (PRD §6.4) |
| G5 | Guestbook | Approved messages, newest first; "Leave a wish" button | Open G6; load more | approved entries | Hidden if the section is disabled |
| G6 | Leave a wish | Display name (required), message, language, one-line note that the network address is checked briefly to stop spam and not stored | Send | — | Name/text limits: Q34c; rate limits: Q43 (blocked = plain message with wait time). Plain text only |
| G7 | Sent | "Thanks, it will appear after [OWNER] approves it" | Back to guestbook | — | Guest does not see their pending message (proposal, Q34) |
| G8 | Settings sheet | Language EN/VI, mode World/Page/Static, reduce motion | Change; remembered on this device | — | Mode auto-chosen first (FR13) |
| G9 | First-visit tour | 3-4 step pop-up over G1: what this is, what you can see, leave a wish, save your place | Next, Back, Skip, Done | — | Once per device (once per account when signed in); `role=dialog`, focus trap, Esc, reduced motion; never delays G0; replay from G8 (S20, Q40) |
| G10 | Save my place | Email, optional display name, what an account gives | Send verification mail | `guest_register` (rate limited) | Only from a token session; needs email to guests (Q37 Phase B, Q38) |
| G11 | Guest sign-in | Email link or password | Sign in | auth | Same generic errors as the owner login; no sign-up link without a token |
| Z2 | Zodiac (guest view, read-only) | Galaxy-style animated scene (stars, glow, constellation lines) with the couple's signs as the owner's character art (built-in default art from `assets/zodiac-sign/` until uploaded), each partner's label and signs, and the relationship reading (EN/VI, "for fun"). If the owner opted in to details: the sky at birth as a 3D scene (Moon at its phase, planets on the ecliptic; design 5) with its line, or a 2D Moon picture plus the line in the simple version. Never a birth date | Switch Western / Vietnamese (opens on the owner's default) | stored signs, sign art, reference texts | Guests do not enter a birthday. Shown when enabled, like every section (Q49). Systems: Q47; reading: Q48 (design 3 §3.10-3.11). Reduced motion shows the still image (E41, S21) |
| G-E1 | No token | "Tap the tag or scan the QR code" | — | — | Same screen for wrong, rotated or private (no hints) |
| G-E2 | Opened in an app that dropped the link | Steps to open in Safari/Chrome | — | — | E30 |
| G-E3 | Not available / offline / database paused | Calm message, retry | Retry | — | E17, E23 |

## Owner and co-editor screens (`/app/...`, login required)

| ID | Screen | Shows | Actions | Who |
|---|---|---|---|---|
| O1 | Log in | Google button; email + password | Log in | Both. No sign-up link (closed registration, Q30) |
| O2 | Dashboard | Empty state "Set up your page" or page overview: visibility, sections, pending guestbook count, usage meter | Go to setup, content, moderation, share | Both (co-editor sees no settings) |
| O3 | Page setup wizard | Steps: theme (preview), default language, time zone (prefilled from the browser; design 3 §3.1), sections on/off, visibility (default Token-only) | Next/back; finish | Owner |
| O4 | Section content list | Items with draft/published badge, language, date | New; edit; publish/unpublish; reorder | Both |
| O5 | Item editor | Title, date, text (language), optional second-language text, media list | Save draft; publish; delete | Both. "Changed by someone else" prompt instead of silent overwrite (E15) |
| O6 | Media upload | Picker, compression progress, size/count caps, "location removed" note | Add; retry; cancel | Both. E7–E10 |
| O7 | Guestbook queue | Pending entries | Approve; reject | Both |
| O8 | Share | Link and QR (shown **once** after creation/rotation: Q34a decided), optional QR download with a "this is a live credential" warning, tag-writing steps, "link not shown yet" state with Rotate again, note that rotation keeps guest accounts | Copy; download QR; rotate token | Owner |
| O9 | Visibility and sections | Private / Token-only / Published; section toggles | Change (with a confirm for Private and Published) | Owner |
| O10 | Usage | Storage and egress against free limits; warnings at 60% and 80% | — | Owner |
| O11 | Members | The one shared owner account (Q35). No co-editor screen until a second account is wanted | Change password; link Google | Owner |
| O13 | First-run tour | 3 steps on the empty dashboard: set up the page, add the first memory, create the guest link | Next, Skip, replay from O12 | Owner (and partner) |
| O14 | Email settings | Reminder lead time, wish digest on/off, last sends and failures | Save; send test to own address | Owner |
| Z1 | Zodiac: our birth data | For each partner: label, birth date, birthplace (picked from a list), optional birth time; after saving, the computed Western sun/Moon/rising signs and Vietnamese pillars, animal and mệnh; the sky at birth (Moon phase, planets and their signs, nearby sky events such as an eclipse or a meteor shower) with its composed line, which the owner may reword (Q50); per partner a "show details to guests" switch with the warning that details can reveal the exact birthday (Q50); default system for guests; note that the date, time and place are encrypted and never shown, and that guests can work out the birth year from the basic signs; for a birthday near Tết, a warning with the number of days guests could narrow it to, and a choice to hide the Vietnamese animal for that partner; "changes not published" badge | Save; Publish; Unpublish | Owner. Design 3 §3.10, E40 |
| O15 | Guest accounts | List of guest accounts for the page, with cap counter | Remove one; remove all | Owner |
| O12 | Account | Language, log out | — | Both |

## What this tells the data model (input to design 3)

- Home needs a single `home` item per page (title, cover media, counter start date and timezone).
- Memory needs title, date (with precision: day/month/year), text + language, optional second-language text, ordered media.
- Milestones and anniversaries need a date and a recurrence flag for anniversaries.
- Guestbook entries need display name, text, language, status, token version, created time.
- Page needs theme, default language, visibility, section flags, and a `token_shown_at` timestamp for O8.
- Account, consent and email entities (guest accounts, pending registrations, email preferences, email log, saved sign) belong to design 3 and each carries `page_id` or a user bound to one page.
- Every editable row needs `updated_at` (or a version number) for the overwrite check in O5.

## Tests derived from screens (written failing first)

One Playwright flow per row, phone viewport, EN and VI:

1. Tap link → G0 → G1 with only the enabled sections in navigation.
2. G2 → G3: thumbnails load first; video does not download before tap.
3. G6 → G7: empty name blocked; message appears in O7; after approval, it appears in G5.
4. O1 → O2 empty state → O3 → O8 shows the link once.
5. O9 set Private → open guest tab shows G-E1 on next action.
6. O5 opened in two sessions → second save shows the conflict prompt.
7. G1 first visit shows G9 once; Skip closes it; second visit does not show it; replay from G8 works.
8. Token holder → G10 → verification link → signed in; a visitor with no token cannot reach G10.
9. Owner saves birth dates in Z1 → guest Z2 shows both signs and the reading, and the page source and network responses contain no date; an invalid date is rejected; reduced motion shows a still image.
10. Unauthenticated visit to `/app`, `/app/anything`, `/home` shows login or not-found and no owner data.

