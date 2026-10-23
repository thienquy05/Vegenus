# PRD: anni (working name), a memory-keeping site opened by NFC tap

**Status:** DRAFT v0.6. Owner said "the PRD looks good" (2026-10-21). v0.5 added the test-first rule and parallel CI (§9.1, plan §12). v0.6 (2026-10-22) records the owner's answers to Q34-Q35, and adds: deny-by-default access (§4.3, E31-E37), Resend email (S18), optional guest accounts (S19), first-visit tour (S20), Zodiac section (S21), and Q36-Q41. Open items: Q16, Q20 (after core), Q34a, Q36, Q37 (domain and docs approval). Q33, Q35, Q38-Q41 answered 2026-10-22. Nothing is implemented.
**Date:** 2026-10-21 (v0.1 written 2026-10-20)
**Author:** Claude Code, from the owner interview (HARNESS_PROCESS.md §6)
**Owner / decider:** the project owner (referred to as [OWNER])
**Deadline:** target 14 Feb 2027 ([DEADLINE]), core scope only (see §3.3). The owner says it is flexible.
**Privacy rule:** this file is written for a repo that may become public. Use only placeholders: [OWNER], [PARTNER], [DATE], [PLACE], `placeholder.jpg`. No real names, dates, photos, emails, tag IDs or tokens.
**Template note:** `docs/process/PRD_TEMPLATE.md` targets research/ML projects. Section numbers are kept stable; §5 is adapted to content and data model, §6 is replaced by experience, theme and 3D design (no modeling), §8 is hosting and cost.

---

## 1. Executive summary

### 1.1 Problem
Couples keep their memories scattered across phone galleries, and guests at a wedding, anniversary or visit have no simple, personal way to see them or leave wishes. A tap on an NFC tag should open a beautiful, phone-first page that tells the couple's story, shows the memories they choose to share, and lets guests leave a message.

### 1.2 Proposed solution
A **personal** website for [OWNER] and one invited co-editor ([PARTNER]), built to real-project quality and **tenant-ready**: every record carries a page ID so more pages can be added later without a rewrite, but there is no public signup, billing or abuse tooling now. The site is empty until the owner sets up a page. A page has a theme, English + Vietnamese UI, and four sections. The owner decides which sections guests see; every change requires login. A **guest token**, carried in the link written on an NFC tag and encoded in a printable QR code, lets a guest view the page and submit a guestbook message without an account.

The experience has **two presentation modes over the same content**: a full **3D world** (the whole site is one scene the guest moves through) and a lighter **page mode** (normal scrolling layout with a 3D scene per section), plus a static 2D fallback. The best mode for the device is chosen automatically and the guest can switch.

### 1.3 Expected impact
- A guest goes from tap to a memorable, on-brand page in seconds, with no app install and no account.
- The couple controls exactly what is visible; nothing private is reachable by accident.
- The same site can later serve other couples without a rewrite.

### 1.4 Resources
One owner, Claude Code plus Codex as partners. Target cost **$0** (Supabase free tier, Vercel Hobby). NFC tags bought on Amazon (model not yet known). About 16 weeks to the deadline.

### 1.5 Success metrics (process- and evidence-based; numeric targets are proposals for the owner to accept or change)
1. **Setup:** from an empty account to a published page in one sitting (proposed under 15 minutes) with no help, measured on [OWNER]'s own setup.
2. **Speed:** after a tap, meaningful content is visible within a proposed 3 seconds on a mid-range phone over 4G, in page mode or fallback; 3D loads after first content.
3. **Isolation:** 100% of visibility, token and tenant-isolation tests pass; private and token-only pages are never indexed.
4. **Cost:** monthly infrastructure cost is $0 at the owner's expected use; free-tier usage (storage, bandwidth) is monitored with alerts before limits are hit.
5. **Themes and modes:** all four themes pass the same visual, accessibility and performance checks in page mode on phone-sized viewports; world mode meets its own measured frame-rate and memory budget on the test phones or is automatically bypassed.

### 1.6 Definition of Done
Decided by [OWNER]. A phase is done when its exit criteria in §10 pass, the §9.3 checklist rows for that phase are ticked, the progress file is current, and [OWNER] has reviewed at the gate. The project is done by [DEADLINE] when [OWNER]'s real page is live, a real NFC tag and a QR code open it on an iPhone and an Android phone, and §9.3 is fully ticked for the core scope.

---

## 2. Problem definition

### 2.1 Users
- **Owner ([OWNER]):** creates an account (Google sign-in or email + password), sets up the page, uploads and edits content, controls visibility, rotates the token.
- **Co-editor ([PARTNER]):** one invited editor per page. Can edit content and approve guestbook messages. Cannot delete the page, change visibility or remove the owner (default accepted by owner, "so far").
- **Guest:** arrives by tapping the tag or scanning the QR; sees only what the owner enabled; with a valid token can submit a guestbook message that appears only after approval.
- **Searcher:** only when the owner publishes the page; sees the public sections, cannot post.

Explicitly not for now: other couples or public signup; selling anything; native apps.

### 2.2 Context
Guests arrive on phones, often via NFC, sometimes inside in-app browsers (Zalo, Facebook, Messenger). Content is personal and emotional, so privacy and tone matter more than features.

### 2.3 What the data looks like
No real data exists yet. Owner will upload photos, short videos, voice notes and text. Expected volume is small (tens to a few hundred photos, a few short videos); the free-tier ceiling (§8) sets the real limits.

### 2.4 Cost of not solving
Memories stay scattered and unshared. For the build: an unplanned launch risks privacy leaks, a paused database, or a surprise bill.

---

## 3. Scope

### 3.1 In scope
| ID | Item | Priority |
|---|---|---|
| S1 | Accounts for owner and one co-editor: Google sign-in + email/password; empty state until setup; no public signup | P0 |
| S2 | Page setup wizard: theme, default language, which sections guests see, visibility, invite co-editor | P0 |
| S3 | Visibility states per page: **Private** (login only), **Token-only** (default; viewable with the guest token, not indexed), **Published** (public and searchable); owner switches | P0 |
| S4 | Section: Home / intro | P0 |
| S5 | Section: Memories (photos, short videos, voice notes, text) | P0 |
| S6 | Section: Together: relationship timeline, days-together counter + anniversaries | P0 |
| S7 | Section: Together: places map (3D, select and zoom on click) | P1, after core |
| S8 | Chibi anime couple characters posing at the selected place | P1, after core, owner-only |
| S9 | Section: Guestbook / wishes; a token holder can post without an account; owner or co-editor approves before display | P0 |
| S10 | Page mode: normal layout with a 3D scene per section, 2D / reduced-motion fallback | P0 |
| S11 | Four themes (A Dreamy & romantic, B Cosmic / night sky, C Cozy & playful, D Elegant & minimal); more can be added later | P0 for design tokens in all four; see §6.5 for 3D scene depth per theme |
| S12 | English + Vietnamese UI; each content entry in one language with an optional second-language field | P0 |
| S13 | NFC flow: stable link carrying the guest token, re-pointable and rotatable; printable QR code | P0 |
| S14 | Free-tier guardrails: per-account storage and video limits, usage monitoring, keep-alive so the free database does not pause, rate limits on token-gated posting | P0 |
| S15 | Account data export and delete; privacy policy, terms, minimum age, takedown path | P2, last phase, required before publishing to other people |
| S16 | World mode: the whole site as one navigable 3D world, with automatic capability checks and a visible switch to page mode | P1, built after Page mode is evaluated (owner's preferred final experience; see §6.5) |
| S17 | Proposed extra sections (not adopted): Time capsule, Songs, "Open when…" letters, Bucket list, Guest photo upload (moderated), Event info / RSVP | Not scheduled |
| S18 | Email through Resend: welcome, anniversary reminder, new-wish digest, wish-approved thank-you, and account emails (verify, reset). Server-side only, templates in EN/VI, opt-out link on non-account mail, never contains a guest token or private memory text | P1; needs Q37 (sending domain) |
| S19 | Optional guest account: a token holder can "save my place" (verified email), so later visits need no tap; can post with a prefilled name, and keep a Zodiac profile. Closed to people without a valid token session | P1; needs Q38 |
| S20 | First-visit tour: a skippable pop-up walkthrough for new guests (once per device, or once per account) and for the owner's first dashboard visit; replayable from settings | P1 (small); Q40 |
| S21 | Zodiac section in a galaxy style: guest enters a birthday, sees their sign as the owner's own character art on an animated star scene, plus fun facts. Calculated in the browser; stored only if the guest opts in, and then encrypted | P1, after core; Q39 |
| S22 | Deny-by-default access: every route, server action, database table and storage object is closed unless a rule opens it (§4.3, E31-E37) | **P0** |

### 3.2 Out of scope (for now)
Public signup and other couples; payments and plans; public discovery across owners; native mobile apps; auto-translation; languages beyond EN/VI; live chat; more than one co-editor; real-time collaboration; uploading real photos to any external tool (until a specific host is approved).

### 3.3 MVP by [DEADLINE] (owner: "core only")
S1–S6, S9–S14, S22, with S10 and S16 as defined in §6.5. S7–S8 (map and chibi) follow after the deadline. S15 comes last and is only required before publishing to others. S18-S21 are P1 proposals (owner decides in Q37-Q40) and follow core unless the owner moves them up.

### 3.4 Learning goals
Can one content model drive both a 3D world and a normal page? Does the 3D stay smooth on budget phones and in in-app browsers? Does the free tier hold up (storage, bandwidth, inactivity pause, email)?

---

## 4. Requirements

### 4.1 User stories and acceptance criteria
- As the **owner**, I create an account and see an empty dashboard. *AC: a new account has zero pages and zero public output.*
- As the **owner**, I set up a page choosing theme, language, visible sections and visibility. *AC: default visibility is Token-only; sections default to off until enabled.*
- As the **owner**, I invite [PARTNER] as co-editor. *AC: the invitation works within the free-tier email limits (see §8); co-editor can edit content and approve guestbook entries, nothing more.*
- As the **owner**, I upload photos, short video, voice notes and text. *AC: size/type limits enforced; location data stripped from photos; interrupted uploads fail clearly or resume.*
- As a **guest**, I tap the tag and see only the enabled sections, in my phone's language with a toggle. *AC: disabled sections are absent from navigation and unreachable by URL.*
- As a **guest** with a valid token, I leave a wish without an account. *AC: a display name is required; it is held for approval; invalid, rotated or missing token cannot post; rate limited.*
- As the **owner**, I switch the page to Private or Published. *AC: Private stops all new guest access immediately (no new content and no new media URLs); media URLs already issued expire within the window decided in Q29; Published makes the public sections searchable; Token-only is not indexed.*
- As the **owner**, I rotate the token if the tag is lost or the link leaks. *AC: the old token stops working at once for new sessions, viewing and posting; sessions and media URLs already issued end within the Q29 window; the tag carries the token, so it must be rewritten and the QR reprinted.*
- As a **guest**, I open the site in 3D world mode, or the page falls back to page mode. *AC: the mode is chosen by device capability; a visible control switches modes; the choice is remembered.*

### 4.2 Functional requirements
FR1 accounts and sessions. FR2 tenancy: every record belongs to one page; access is checked server-side on every read and write. FR3 page setup and settings. FR4 content CRUD per section with draft/published state. FR5 guest views for enabled sections only, gated by visibility state and token. FR6 guestbook with token-gated submission and moderation queue. FR7 media pipeline: validate, strip location metadata, resize and compress images, cap and compress video, generate thumbnails at upload (storage-side image transformation is a paid feature), serve through access-controlled URLs. FR8 i18n: EN/VI strings, optional second-language field, language detection plus manual toggle. FR9 theme system: tokens plus 3D scenes that read the tokens. FR10 NFC link and QR generation. FR11 keep-alive and usage monitoring. FR12 export and delete data (last phase). FR13 mode selection: capability detection, manual switch, remembered choice.

### 4.3 Non-functional requirements
- **Privacy:** Token-only and Private pages send `noindex`; tokens are unguessable (long random values), never derived from names or sequences; only Published pages are indexable. Any third-party service that receives owner content must be named and approved first. Privacy policy, terms and minimum age are required before the site is published to others (last phase).
- **Security:** server-side authorization on every request; input validation; stored-XSS-safe rendering of guest text; rate limiting on login, upload and token-gated posting; secrets only in environment variables (never in Git). A leaked token or full link grants guest **read** access (enabled, published sections) and post-to-queue access until it is rotated; it never allows edits. Guests reach data only through narrow database functions, never through table access or the service-role key (plan §1).
- **Deny by default (no unauthenticated bypass):** a person with no session and no token can reach only an allow-list (landing, `/g` shell, login, health check, static files). Every other route returns a login redirect or a generic not-found with no data in the response. Four independent layers, so one miss is not a breach: (1) a single route table that classifies every route and fails the build if one is unclassified; (2) an auth check inside every page, route handler and server action (middleware alone is never trusted); (3) row-level security on every table with no anon table access, only the narrow `guest_*` functions; (4) private storage with signed URLs minted after the same checks. Design and tests: `docs/design/anni_token_flow.md` §9.
- **Guest powers by credential:** no token = read only what a Published page shows (through `public_*`, no posting), and nothing on a Token-only or Private page; valid token = read enabled published sections and post to the moderation queue; guest account = same plus saved profile and email preferences; owner or co-editor = edit and moderate. Interactions that write anything (guestbook, profile, email opt-in) always need a token session or an account (Q36).
- **Personal data (birthdays, emails):** collect the minimum (month and day; year only if a Chinese-zodiac option needs it), compute in the browser where possible, store only with opt-in, encrypt birthdays at application level (AES-256-GCM, key in an environment variable, never in Git or CI), keep them out of logs, analytics, emails and Git, delete them with the account. Emails need the address in readable form to send, so they rely on row-level security and the vendor's at-rest encryption (**unverified**), not on application encryption.
- **Performance (proposals, to be measured):** content-first loading; 3D lazy-loaded; asset and GPU budgets set in the plan; automatic downgrade from world mode to page mode to 2D when WebGL2 is missing, memory is low, frame rate drops, data saver or battery saver is on, or `prefers-reduced-motion` is set.
- **Accessibility:** WCAG 2.2 AA target; touch targets at least 44 px; contrast checked in all four themes; a non-3D, keyboard- and screen-reader-friendly path always exists.
- **Language:** fonts must render Vietnamese diacritics correctly; text normalized consistently.
- **Portability:** iOS Safari, Android Chrome and in-app browsers first; desktop supported but secondary.
- **Cost:** $0 target; free-tier limits are design constraints (§8).

---

## 5. Data specification (content and data model; adapted from the template)

The full model is a plan deliverable. Entities and rules fixed here:

| Entity | Notes |
|---|---|
| User | identity via Google or email/password |
| Page | theme, default language, visibility state (Private / Token-only / Published), enabled-section flags, optional vanity name (Published only) |
| Membership | owner or co-editor; at most one co-editor per page |
| GuestToken | page, token hash (store a hash, not the raw token), active flag, created/rotated timestamps |
| Section content | Home, Memory, Milestone, Place, Anniversary, GuestbookEntry (pending / approved / rejected; display name required). Every content item has a draft / published status and an optional second-language text field; guests only ever see published items and approved entries, and their media |
| Media | page, type, size, processed variants and thumbnails, storage key, no embedded location data |

Rules: every row carries its page ID and is filtered by it (tenant-ready); deleting a page deletes its media; dates are stored with timezone handling defined for the counter (see §9.2).

---

## 6. Experience, themes and 3D design (replaces "Modeling and evaluation")

### 6.1 Principles
1. Feels like opening a keepsake, not a dashboard.
2. Phone-first one-hand use; content visible before animation.
3. Gentle motion that can always be turned off.
4. The owner stays in control; guests never see unfinished or private things.
5. Both languages feel native, not translated afterwards.

### 6.2 Themes (owner picks one at setup; more can be added)
A Dreamy & romantic · B Cosmic / night sky · C Cozy & playful · D Elegant & minimal. Mood board: private artifact on the owner's account (not copied into this repo). A theme is a bundle of design tokens (colour, type, spacing, motion) plus a 3D scene style; sections never hard-code a theme.

### 6.3 Sections (designs are plan deliverables)
Home/intro · Memories · Together (timeline, counter, later the places map) · Guestbook.

### 6.4 Places map and chibi couple (after core)
A 3D map the guest selects and zooms by tapping a place; the chosen place shows the couple's chibi characters posing in front of that location's backdrop. Owner will upload photos; the art tool is undecided, and no photo goes to any external service until the owner approves a specific host (CLAUDE.md rules 1 and 3). Owner-only at first.

### 6.5 Experience modes (owner: "aim for the whole site as one 3D world, but worry about performance; implement both")
| Mode | What it is | When used |
|---|---|---|
| World | The whole site is one 3D scene; the guest moves to sections within it | Capable devices, chosen automatically or by the guest |
| Page | Normal scrolling layout with a 3D scene per section | Default fallback; mid-range phones; in-app browsers if World fails the check |
| Static | 2D layout with no WebGL | No WebGL2, low memory, reduced motion, data/battery saver |

One content model feeds all modes. Build order (owner confirmed): Static and Page first, because they carry the content and are the fallback; evaluate Page mode; then World, the owner's preferred final experience. The deadline is flexible. Design tokens for all four themes come first, with rich 3D scene variants added theme by theme in the order the owner picks.

---

## 7. Technical specification
Intentionally undecided until the plan is approved. Candidates and research are in `docs/plans/anni_plan.md`. Constraints: $0 start, phone performance, EN/VI, tenant-ready isolation enforced server-side, themes added without rewrites, content decoupled from presentation mode.

## 8. Execution environment and cost
Development on [OWNER]'s machine (WSL2). Hosting: Supabase free tier (database, auth, media) and Vercel Hobby, at the free `*.vercel.app` address. All limits, capacity arithmetic and sources are in `docs/plans/anni_plan.md` §3 and §R; they are design constraints and are not repeated here.

---

## 9. Testing and QA

### 9.1 Approach and verification loop
Tests and execution scripts are written before each step and must be **seen failing (RED) for the expected reason before the code is written**, then pass (GREEN); bugs start with a failing regression test (owner, 2026-10-21; plan §12.1). A GitHub Actions workflow runs lint, unit, database, end-to-end, accessibility/performance and privacy jobs **in parallel**, behind one required `gate` check (plan §12.2). Frontend work is verified with the Playwright MCP on a phone-sized viewport (rendering, console, key flows) and with browser performance traces and Lighthouse for the budgets. Privacy and isolation tests run after every change that touches data access.

### 9.2 Edge-case catalog (each row is a required task)
| # | Case | Expected |
|---|---|---|
| E1 | Phone without NFC, NFC off, or unsupported iPhone | QR code and plain link work |
| E2 | Tag scanned in an in-app browser (Zalo/Facebook/Messenger) | Page loads; mode downgrades gracefully if WebGL is limited |
| E3 | Tag link leaked or tag lost | Owner rotates the token; old token dead for view and post |
| E4 | Owner switches the page to Private while a guest has it open | The next request returns no content and mints no media URL; media URLs already issued expire within the Q29 window |
| E5 | Guest requests a disabled section by URL | Not found, no data leaked |
| E6 | Another account or a guest with a different page's token requests this page's data or media | Denied on every route |
| E7 | Photo contains GPS/EXIF | Location data stripped before storage |
| E8 | HEIC, huge, corrupt or wrong-extension files | Rejected or converted with a clear message |
| E9 | Upload interrupted or session expires mid-upload | Clear recovery; no orphan files |
| E10 | Video over 50 MB or storage near 1 GB | Blocked with a clear message; usage warning earlier |
| E11 | Guestbook spam, bots, repeated posts, scripts in text, valid token abused | Rate-limited, sanitized, queue only |
| E12 | Vietnamese text (composed vs decomposed), very long names, emoji | Stored and rendered correctly in all themes |
| E13 | Missing second-language text | Falls back to the entry's own language |
| E14 | Days-together counter across timezones, leap years, future start date | Defined, tested behavior |
| E15 | Co-editor and owner edit the same item | No silent overwrite |
| E16 | Co-editor removed, or owner deletes the page | Access ends; data and media deleted per policy |
| E17 | WebGL context loss, low memory, slow 3G, offline | Downgrade or retry message; no blank screen |
| E18 | `prefers-reduced-motion`, data saver, battery saver | Motion and 3D reduced or off |
| E19 | Theme switched after content exists | Content intact; contrast still passes |
| E20 | Place with no photo or backdrop (after core) | Sensible default scene |
| E21 | Token-only or Private page crawled by a search engine | `noindex`; not in sitemap |
| E22 | Account takeover attempt, password reset abuse | Rate limit and verification flow |
| E23 | Free database paused after a week without traffic | Keep-alive is best effort; a missed run raises an alert; if paused, a clear error and a tested restore; event-day check before gatherings |
| E24 | Free egress quota nearly used (many guests, big media) | Alert; media served lazily with posters and thumbnails; documented fallback |
| E25 | Invite or password-reset email to a non-team address | The flow avoids email: accounts are provisioned by the owner (Q26, Q30) |
| E26 | Guest switches World ↔ Page ↔ Static mode mid-session | State and language preserved; no memory growth |
| E27 | Token appears in browser history, logs or a shared screenshot | A full link grants guest read and post access until rotated; the token sits in the URL fragment, so it is not in server logs or referrers; rotation is one action (then rewrite the tag) |
| E28 | Draft items, unapproved guestbook entries or their media inside an enabled section | Never returned to guests, including through media URL minting |
| E29 | Attacker registers the invited co-editor's email before they do | Registration is closed, so the attacker cannot create the account; legitimate provisioning and login still work |
| E30 | In-app browser drops the URL fragment or blocks cookies | The visit still works in memory or shows a clear "open in your browser" message; the token never moves to a query string |
| E31 | Unauthenticated request to any owner route (`/app`, `/app/anything`, an API route, a server action), or to a token-only guest route without a token (a Published page is readable without a token, read-only, through `public_*`) | Redirect to login or generic not-found; no page data, no hint whether the record exists; response `no-store` |
| E32 | A new route or server action is added without an access rule | Build and CI fail: the route table must classify every route (default deny) |
| E33 | Logged-in guest account or co-editor tries an owner-only action or another page's ID | Refused by row-level security and the handler's role check; same generic result |
| E34 | After log out, the back button or a cached page | No private content shown; authenticated responses are `no-store`; session cookie cleared |
| E35 | Login `next` parameter points to another site | Only relative paths on our own host are followed |
| E36 | Anonymous call straight to the database API with the public key | Tables return nothing; `guest_*` answers only with a valid token, `account_*` only for an active guest account, `public_*` only for Published pages (design 1 §5.1) |
| E37 | Direct URL guess such as `/home`, `/admin`, `/dashboard` | Not-found for unknown paths; login redirect for owner paths; nothing about the owner area is revealed to a guest |
| E38 | Guest account registration abused with a leaked link (many emails, or someone else's address) | Needs a valid token session, email verification, per-IP and per-address rate limits, a per-page cap; owner can list and remove guest accounts; rotation closes the registration door |
| E39 | Email provider down, quota reached, or bounce | Send is queued and retried once; a daily cap guards the free quota; a bounce disables that address; the app never blocks on email |
| E40 | Birthday typed by a guest | Month and day validated (real calendar day; 29 Feb handled by an explicit rule); calculated in the browser; the opt-in saves the **sign only**, never the date; the field is excluded from analytics and error reports. Storing a birthday needs its own consent and PRD row (design 1 §11) |
| E41 | Zodiac cusp dates and year boundaries (sign changes depend on year and time) | Show the sign for the stated date and a note that cusp dates vary by a day; Chinese-zodiac year changes at the lunar new year, not 1 January |
| E42 | Tour pop-up shown on every visit, traps focus, or blocks the token exchange | Shown once; skippable; focus trap with Esc; never delays the token check; replay from settings |

### 9.3 Acceptance checklist (tick per phase)
- [ ] §1.5 metrics measured and recorded
- [ ] All §9.2 rows have a passing test
- [ ] Visibility, token and isolation tests pass
- [ ] No secrets, real names, dates, photos or tag IDs in Git (privacy scan)
- [ ] Verified on iPhone Safari, Android Chrome and one in-app browser, with a real tag and QR
- [ ] All four themes pass visual, contrast and performance checks in page mode
- [ ] EN and VI complete, no hard-coded strings
- [ ] Free-tier usage within limits with alerts configured
- [ ] Review by a second reviewer (Codex) against plan and PRD
- [ ] Progress file and plan updated to what was actually built

---

## 10. Phases, gates and exit criteria
About 16 weeks from 2026-10-21 to [DEADLINE]. Week numbers are a proposal.

| Phase | Weeks | Content | Exit criteria | Gate |
|---|---|---|---|---|
| 0 Planning & design | 1–2 | PRD, Codex challenge, plan, section designs, NFC flow, data model, theme system, 3D approach | Owner approves each deliverable | Owner review after PRD; after Codex challenge; after each design deliverable |
| 1 Foundations | 3–4 | Skeleton, auth, tenancy, visibility, token, privacy rules, CI | Visibility/token/isolation tests green | Owner OK before enabling harness-os or any spend |
| 2 Owner tools | 5–7 | Setup wizard, content CRUD, media pipeline, limits, keep-alive | Owner publishes an empty-to-live page | Owner review |
| 3 Guest experience (Static + Page) | 8–10 | Guest views, EN/VI, guestbook moderation, NFC + QR flow | Real tag and QR tested on both phone types | Owner review |
| 4 Themes + 3D (Page mode) | 10–13 | Theme system, four themes, per-section 3D, fallbacks | Performance and a11y checks pass | Owner review per theme |
| 5 World mode | 13–15 | The whole-site 3D world with capability check and switch | Meets budget on test phones or auto-bypasses | Owner go/no-go on keeping it in the release |
| 6 Hardening | 15–16 | Rate limits, monitoring, backups, real-tag test, buffer | §9.3 core rows ticked | Owner go/no-go |
| After core | — | Places map + chibi (S7–S8), extra sections (S17) | — | Owner review |
| Last | — | Legal and data export/delete (S15) | Required before publishing to others | Owner review |

---

## 11. Risks and mitigations
Ranked from the owner's stated concerns first.
| Risk | Prob. | Impact | Mitigation |
|---|---|---|---|
| Privacy leak of personal memories (wrong tenant, leaked token, indexed page, GPS in photos) | Med | High | Server-side checks, hashed unguessable tokens, noindex, EXIF stripping, isolation tests, default Token-only, one-click rotation |
| Surprise cost or throttling (video, bandwidth, viral link) | Med | High | Free-tier limits as design constraints, caps, lazy media, alerts; Supabase restricts the project when quotas are exceeded, so the failure mode is downtime, not a bill |
| Abuse of the token-gated guestbook (spam, harmful text) | Med | Med | Moderation queue, rate limits, token rotation |
| Scope: 4 themes × 3 modes | High | Med | Deadline is flexible (owner); Page/Static first, World after Page mode is evaluated, theme tokens first and 3D variants per theme later |
| 3D slow or hot on budget phones and in in-app browsers | Med | Med | Capability detection, budgets, automatic downgrade, test on real devices |
| Free database pauses after inactivity (Supabase "may pause"; only a paid plan guarantees otherwise) | High | High | Best-effort daily keep-alive, missed-run alerts, external uptime check, tested restore, event-day check; paid plan is Q31 |
| Issued media URLs outlive a revocation (vendor cannot revoke them) | Med | Med | Short expiry, minting only after checks; owner picks window or proxying (Q29) |
| Auth emails (invite, reset) blocked by the free email limit; pre-registered accounts | High | Med | Closed registration with owner-provisioned accounts; Google only for pre-created accounts (Q30) |
| Resend free plan cannot send to guests without a verified sending domain (**unverified**; needs DNS records on a domain the owner controls, which the free `*.vercel.app` address is not) | High | Med | Q37: start owner-only (own address), add a domain after the rename decision; the app works without email |
| Personal data (guest emails, birthdays) held and sent to a third party | Med | High | Minimum data, opt-in, application-level encryption of birthdays, no PII in logs/Git/CI, vendor named and approved before use (Q37), delete with account |
| An authorization gap (a route or action without a check) exposes owner data | Med | High | Deny-by-default layers (§4.3), route table build check, crawler test, database tests as the anon role |
| NFC URL tied to a domain that later changes | Med | Med | Decide domain before writing the tag (Q19); keep the tag re-pointable or use a redirect on a domain the owner controls |
| NFC tag model limits (capacity, locking, iPhone support) | Med | Med | Verify the model on the product page (Q16 left open); QR fallback |
| Legal obligations if the site is ever published to others | Low now | High later | Last phase; revisit before any publishing |
| Chibi art copyright or real photos sent to external tools | Med | Med | Q20; privacy and network gates before any upload |

---

## 12. Open questions (status and who answered)
| # | Question | Default if unanswered | Status |
|---|---|---|---|
| Q1 | Platform vs single site | Personal site, tenant-ready design | **Answered by owner** (2026-10-21, via Q13) |
| Q2 | Editors | Owner + one invited co-editor | **Answered by owner** |
| Q3 | Themes at MVP | All four (A–D); more later | **Answered by owner**; depth of 3D per theme in §6.5 awaits owner decision |
| Q4 | Visibility | Per page; default Token-only | **Answered by owner** |
| Q5 | Login methods | Google + email/password | **Answered by owner** |
| Q6 | Content languages | UI EN/VI; one language per entry + optional second field | **Answered by owner** |
| Q7 | Guestbook | Owner approves before display | **Answered by owner** |
| Q8 | Project name | Prefix `anni` | **Answered by owner** (better name later) |
| Q9 | harness-os | Enable after PRD and plan approved; will ask first and say it commits | **Answered by owner** |
| Q10 | Stack | Plan compares and prices options | **Answered by owner**; research in plan |
| Q11 | Review gates | After PRD, after Codex challenge, after each design deliverable, before harness-os or spend | **Answered by owner** |
| Q12 | Guests posting without login | A guest holding a valid token (NFC/QR link) may post a message with no account; it goes to the moderation queue; nothing else is writable | **Answered by owner** (2026-10-21) |
| Q13 | Audience | Personal site for [OWNER], tenant-ready design, no public signup or beta program | **Answered by owner** (2026-10-21) |
| Q14 | Public vs token | Until the owner publishes, viewable only through the guest token; once Published, public and searchable. Anyone who opens the page with the token can post a message, with at least a display name. Posting needs the token, so a searcher who arrives without it can read but not post | **Answered by owner** (2026-10-21); the last clause is my reading of "with that token", not stated outright |
| Q15 | Co-editor permissions | Edit content and approve guestbook; cannot delete page, change visibility or remove the owner | **Answered by owner:** use this "so far" |
| Q16 | NFC tag exact model, capacity, count | Unknown; design for a standard NDEF URL tag | **OPEN by owner's choice** |
| Q17 | Media and storage | Supabase free tier; photos and short video | **Answered in principle**; limits in §8 and plan; caps for video to be set by the owner |
| Q18 | Cost ceiling | $0 | **Answered by owner** (2026-10-21) |
| Q19 | Domain name, and whether it is worth paying for (NFC URL depends on it) | Undecided; use `anni` in docs. A free `*.vercel.app` address costs $0 but ties the tag to it | **Answered by owner** (2026-10-21): free `*.vercel.app` address; the tag and QR URL are tied to it |
| Q20 | Chibi characters: art source and photo handling | Optional feature. The owner generates anime or chibi pictures with an AI tool of their choice and uploads the results; a real photo is allowed but never required. Nothing is sent to any external tool by us | **Answered by owner** (2026-10-22): optional; owner supplies the art. No art tool needed from us (after core) |
| Q21 | Places map / "full 3D" | Both World mode and Page mode, with automatic fallback (§6.5) | **Answered by owner** (2026-10-21) |
| Q22 | Legal pages, minimum age, data location | Last phase | **Answered by owner:** low priority, at the end |
| Q23 | Repo visibility | Private now; docs still use placeholders | **Answered by owner** |
| Q24 | Extra sections (S17) | None | **Answered by owner:** not yet |
| Q25 | Deadline | Target 14 Feb 2027, core scope only | **Answered by owner** (2026-10-21): "deadline is flexible", so 14 Feb 2027 is a target, not a hard date |
| Q26 | Co-editor invite and password-reset email | Superseded by Q30 and Q35 | Answered (2026-10-21); superseded |
| Q27 | Video limits | About 25 MB clips, 50 MB max per file, compressed before upload | Answered (2026-10-21) |
| Q28 | World mode go/no-go | Page mode first, then decide on World; World last and optional | Answered (2026-10-21) |
| Q29 | Media links cannot be revoked: accept a window? | 5-minute window | Answered (2026-10-21): 5 minutes |
| Q30 | Accounts: open sign-up or closed? | Closed; owner creates the accounts | Answered (2026-10-21) |
| Q31 | Free database may pause | Best effort at $0, with alerts and a restore test | Answered (2026-10-21): accept |
| Q32 | ruflo scope | Agents and local memory only; no `ruflo init` | Answered (2026-10-21); setting applied |
| Q33 | Deploy route | Vercel + GitHub; preview per pull request; live after `gate` and owner merge | Answered (2026-10-22). Hosts approved when connecting |
| Q34a | Show the guest link once, or store it to view again? | Show once, hash only; printing optional with a warning; recovery rules in design 1 §3.2 | Answered (2026-10-22): owner delegated; Claude and Codex chose show once |
| Q34b | Guest cookie lifetime | 30 days | Answered (2026-10-22) |
| Q34c | Guestbook limits | Name 40, message 500, 3 posts per 10 min per link | Answered (2026-10-22). My extra 50 per page per day is still a proposal |
| Q34d | Guest sees own pending message? | No, only after approval | Answered (2026-10-22) |
| Q35 | Login for the partner | One shared account for both; Google as fallback | Answered (2026-10-22), confirmed |
| Q36 | Visitor with no token | Visibility decides; anything that writes needs a token or account | Answered (2026-10-22): a visitor can read the Published page, read-only |
| Q37 | Resend email | Assume a verified domain is needed for any sending (official docs, plan §R); decide the domain later | **Partly answered**: docs reading approved and done (2026-10-22); domain decision deferred. Owner-only sending without a domain is **unverified** |
| Q38 | Guest accounts ("save my place") | Email-verified, cap 50, owner can remove | Answered (2026-10-22): approved. Email part waits for Q37 phase B |
| Q39 | Zodiac section | Western signs, computed in browser, save only on opt-in; galaxy style; owner draws the sign characters | Answered (2026-10-22): approved. Owner will upload the character art later (placeholders until then) |
| Q40 | First-visit tour | 3-4 skippable steps, shown once | Answered (2026-10-22): approved |
| Q41 | Sign-in emails (verify, reset) via Resend | Only after Q37 domain; until then owner-created accounts | Answered (2026-10-22): approved; waits for Q37 phase B (domain) |

### 12.1 Question details (long text moved out of the table)
Table rows above are summaries. Full wording of the earlier rows, kept verbatim:

**Q26**
- Question: NEW: Email for co-editor invite and password reset (free built-in email goes only to project team members, 2/hour)
- Default / decision: Owner: the co-editor is invited by email address; when they log in with that correct email, they gain the co-editor permissions. Design consequence: the role is granted only if the login's email is verified. Google sign-in verifies it. Email/password sign-up needs a confirmation email, which the free built-in email cannot send to a non-team address, so the co-editor should use Google unless a custom email service is approved. Owner's later answer: build our own login/sign-up pages on our database, with Google as fallback. My first safeguard (a one-time invite link with email confirmation off) was rejected by the Codex challenge, because the vendor documents pre-account takeover through unverified emails; replaced by the proposal in Q30
- Status: **Answered by owner** (2026-10-21); safeguard superseded, see Q30

**Q27**
- Question: NEW: Video limits within 50 MB per file and 1 GB total
- Default / decision: Owner: keep the proposal. Short clips of about 25 MB, never over 50 MB per file, compressed on the phone before upload, with count and size caps shown in the UI
- Status: **Answered by owner** (2026-10-21, "keep it like that for now")

**Q28**
- Question: NEW: World-mode go/no-go and theme depth (§6.5)
- Default / decision: Owner prefers World mode as the final experience; build Page mode first to see how it works, then decide on World. Owner confirmed the cut order stays: World last and optional, and the deadline is flexible
- Status: **Answered by owner** (2026-10-21)

**Q29**
- Question: NEW (from Codex): media URLs cannot be revoked once issued. Accept a bounded window, or proxy all media through our server?
- Default / decision: Accept a 5-minute window with short-lived URLs minted only after checks; proxying costs Vercel transfer and CPU and suits video poorly
- Status: **Answered by owner** (2026-10-21): up to 5 minutes

**Q30**
- Question: NEW (from Codex): accounts. Owner asked for our own login/sign-up pages with Google as fallback. Open sign-up without confirmed email allows pre-account takeover of the invited address
- Default / decision: Closed registration: no public sign-up page now; the owner provisions the owner and co-editor accounts; Google works for those pre-created accounts when the verified Google email matches; the sign-up page is added when other couples are allowed
- Status: **Answered by owner** (2026-10-21): closed registration, owner-provisioned accounts. This replaces the earlier request for a sign-up page for now

**Q31**
- Question: NEW (from Codex): Supabase only "may pause" Free projects after 7 days of low activity; only a paid plan guarantees no pause. Accept best effort at $0?
- Default / decision: Accept best effort plus alerts, uptime check, tested restore, event-day check; upgrade (from $25/month) only if the owner decides
- Status: **Answered by owner** (2026-10-21): accept best effort at $0

**Q32**
- Question: NEW: ruflo as orchestrator next to harness-os (scope and settings in plan §8)
- Default / decision: Limited scope: ruflo agents and local memory only; no `ruflo init`; add `RUFLO_MCP_SKIP_NPX=1` to the git-ignored local settings after the owner reviews the exact change; no ruflo MCP server or extra plugins until a host is approved
- Status: **Answered by owner** (2026-10-21): approved as proposed. Applied: `RUFLO_MCP_SKIP_NPX=1` in the git-ignored `.claude/settings.local.json`

**Q33**
- Question: CD route and the plan limits for a private repo
- Default / decision: Vercel connected to GitHub: a preview site per pull request using a separate test database with fake data; the live site updates only after the `gate` check passes and the owner merges. Actions minutes and branch protection on a private repo are **unverified** (plan §12.5)
- Status: Answered (2026-10-22, confirmed). Connecting Vercel to GitHub still needs rule-1 approval of the exact hosts.

**Q34**
- Question: Guest details: (a) show the link and QR once, or store the token so it can be shown again; (b) cookie lifetime; (c) guestbook limits; (d) does the guest see their own pending message
- Default / decision: (a) Show once, plus a printable QR sheet at creation; a lost link means rotate and rewrite the tag. Discussion in `docs/design/anni_token_flow.md` §3.2
- Status: See the table: Q34a answered (show once), Q34b-d answered 2026-10-22.

**Q35**
- Question: How the co-editor gets a first login without email
- Default / decision: Superseded: see below
- Status: Answered (2026-10-22): one shared account for both partners, confirmed.

**Q36**
- Question: Visitor with no token: you said they "may view everything but not post", and also "no one can open /home without authentication"
- Default / decision: Visibility decides: Token-only and Private pages show a visitor only the "tap the tag" screen; a Published page shows its published sections read-only, never drafts. Anyone who writes (wish, profile, email) needs a token session or account
- Status: Answered (2026-10-22): a visitor can read the Published page, read-only.

**Q37**
- Question: Resend for email (welcome, anniversary reminder, wishes, thank-you). Needs: approval to read the vendor docs (`https://resend.com/docs`, official, HTTPS) and later to sign in; a sending domain to reach anyone but the owner; reminder timing needs a daily scheduler
- Default / decision: Approve research only now. Phase A (free, no domain): emails to the owner's own address only (reminders, wish digest). Phase B: guest emails after the owner owns a domain, ideally after the rename. Free plan limits **unverified** until docs are read
- Status: Partly answered: docs reading approved and done 2026-10-22 (plan §R); domain decision deferred. Owner-only sending without a domain is unverified.

**Q38**
- Question: Guest accounts: after a valid token, a guest may "save my place" so they can sign in later without the tag. Possible: yes
- Default / decision: Email-verified account (link in email), passwordless sign-in by emailed link or password; cap 50 per page; owner can list and remove; rotation stops new sign-ups through the old link but does not remove existing guest accounts; Private page blocks them. Needs Q37 Phase B (email to guests)
- Status: Answered (2026-10-22): approved; email part waits for Q37 phase B.

**Q39**
- Question: Zodiac section: which system, what to store, how it looks
- Default / decision: Western sun signs first (month and day only; computed in the browser; nothing stored unless a signed-in guest opts in, and then the sign, not the birthday). Option: Chinese/Vietnamese animal sign (needs the year). Encrypted birthday only if birthday emails are wanted. Animated constellation SVGs drawn in-repo; fun facts written by us in EN/VI, labelled "for fun". Zodiac also becomes the motif of Theme B (Cosmic / night sky)
- Status: Answered (2026-10-22): approved; galaxy style; owner uploads the character art later.

**Q40**
- Question: First-visit tour for guests and for the owner's first dashboard visit
- Default / decision: 3-4 skippable steps, once per device (once per account when signed in), replay in settings, EN/VI, accessible
- Status: Answered (2026-10-22): approved.

**Q41**
- Question: Email for the sign-in system itself (verify, password reset)
- Default / decision: Supabase Auth can send through Resend (SMTP setting) once Q37 Phase B exists; until then only owner-provisioned accounts, as in Q30
- Status: Answered (2026-10-22): approved; waits for Q37 phase B.

---

## Appendices
**Glossary:** *Tenant/page*: one site's data. *Token-only*: reachable only with the unguessable guest token, not indexed. *Fallback*: simpler experience when 3D cannot run.
**Runbook:** not yet written; added when there is something to run.
