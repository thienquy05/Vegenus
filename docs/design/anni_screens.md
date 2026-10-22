# Design 2: Screen inventory (low fidelity, no visuals)

**Status:** DRAFT v0.1 for owner review. Purpose: fix *what each screen shows and lets you do*, so the data model (design 3) can be drawn from it. Colours, type, layout and 3D come later (theme system, 3D approach).
**Date:** 2026-10-21
**Inputs:** PRD §3.1, §4.1, §6; design 1 (`anni_token_flow.md`).
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
| G6 | Leave a wish | Display name (required), message, language | Send | — | Name/text limits: Q34. Plain text only |
| G7 | Sent | "Thanks, it will appear after [OWNER] approves it" | Back to guestbook | — | Guest does not see their pending message (proposal, Q34) |
| G8 | Settings sheet | Language EN/VI, mode World/Page/Static, reduce motion | Change; remembered on this device | — | Mode auto-chosen first (FR13) |
| G-E1 | No token | "Tap the tag or scan the QR code" | — | — | Same screen for wrong, rotated or private (no hints) |
| G-E2 | Opened in an app that dropped the link | Steps to open in Safari/Chrome | — | — | E30 |
| G-E3 | Not available / offline / database paused | Calm message, retry | Retry | — | E17, E23 |

## Owner and co-editor screens (`/app/...`, login required)

| ID | Screen | Shows | Actions | Who |
|---|---|---|---|---|
| O1 | Log in | Google button; email + password | Log in | Both. No sign-up link (closed registration, Q30) |
| O2 | Dashboard | Empty state "Set up your page" or page overview: visibility, sections, pending guestbook count, usage meter | Go to setup, content, moderation, share | Both (co-editor sees no settings) |
| O3 | Page setup wizard | Steps: theme (preview), default language, sections on/off, visibility (default Token-only) | Next/back; finish | Owner |
| O4 | Section content list | Items with draft/published badge, language, date | New; edit; publish/unpublish; reorder | Both |
| O5 | Item editor | Title, date, text (language), optional second-language text, media list | Save draft; publish; delete | Both. "Changed by someone else" prompt instead of silent overwrite (E15) |
| O6 | Media upload | Picker, compression progress, size/count caps, "location removed" note | Add; retry; cancel | Both. E7–E10 |
| O7 | Guestbook queue | Pending entries | Approve; reject | Both |
| O8 | Share | Link and QR (shown **once** after creation/rotation, unless Q34 decides otherwise), print QR, tag-writing steps | Copy; download QR; rotate token | Owner |
| O9 | Visibility and sections | Private / Token-only / Published; section toggles | Change (with a confirm for Private and Published) | Owner |
| O10 | Usage | Storage and egress against free limits; warnings at 60% and 80% | — | Owner |
| O11 | Members | Owner and co-editor; add or remove co-editor | Provision (Q35); remove | Owner |
| O12 | Account | Language, log out | — | Both |

## What this tells the data model (input to design 3)

- Home needs a single `home` item per page (title, cover media, counter start date and timezone).
- Memory needs title, date (with precision: day/month/year), text + language, optional second-language text, ordered media.
- Milestones and anniversaries need a date and a recurrence flag for anniversaries.
- Guestbook entries need display name, text, language, status, token version, created time.
- Page needs theme, default language, visibility, section flags, and a `token_shown_at` timestamp for O8.
- Every editable row needs `updated_at` (or a version number) for the overwrite check in O5.

## Tests derived from screens (written failing first)

One Playwright flow per row, phone viewport, EN and VI:

1. Tap link → G0 → G1 with only the enabled sections in navigation.
2. G2 → G3: thumbnails load first; video does not download before tap.
3. G6 → G7: empty name blocked; message appears in O7; after approval, it appears in G5.
4. O1 → O2 empty state → O3 → O8 shows the link once.
5. O9 set Private → open guest tab shows G-E1 on next action.
6. O5 opened in two sessions → second save shows the conflict prompt.
