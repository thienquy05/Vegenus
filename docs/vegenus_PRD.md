# PRD: Vegenus, a memory-keeping site opened by NFC tap

**Status:** Draft v0.6. Owner approved the PRD (2026-10-21). Open: Q16 (NFC tag model), Q37 (sending domain), Q66, Q70. Deferred: co-editor role (Q35) and a multi-tenant workspace request (Q84, low priority). Nothing is implemented. Change history: Git and [progress](vegenus_progress.md) §6.
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
A **personal** website for [OWNER] and [PARTNER], who share one owner account (Q35), built to real-project quality and **tenant-ready**: every record carries a page ID so more pages can be added later without a rewrite, but there is no public signup, billing or abuse tooling now. The site is empty until the owner sets up a page. A page has a theme, English + Vietnamese UI, and four sections. The owner decides which sections guests see; every change requires login. A **guest token**, carried in the link written on an NFC tag and encoded in a printable QR code, lets a guest view the page and submit a guestbook message without an account.

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
- **Co-editor:** deferred (Q35). Both partners use the one shared owner account. The role, limited as in Q15 (edit content and approve wishes; cannot delete the page, change visibility or remove the owner), is reserved in the data model for a second account later.
- **Guest:** arrives by tapping the tag or scanning the QR; sees only what the owner enabled; can submit a wish that appears only after approval.
- **Member:** a guest with an account made through an owner-issued invite code (S19, Q79); prefilled name and email preferences.
- **Searcher / visitor with no token:** only when the owner publishes the page; sees the public sections and can post a wish through the rate-limited path (Q78), held for approval; nothing else.

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
| S1 | Accounts: one shared Owner account for both partners (Q35; a separate co-editor role is deferred) with Google sign-in + email/password; empty state until setup; no public signup. Every other account is a registered guest created with an owner-issued invite code (S19, Q79) | P0 |
| S2 | Page setup wizard: theme, default language, which sections guests see, visibility | P0 |
| S3 | Visibility states per page: **Private** (login only), **Token-only** (default; viewable with the guest token, not indexed), **Published** (public and searchable); owner switches | P0 |
| S4 | Section: Home / intro | P0 |
| S5 | Section: Memories (photos, short videos, voice notes, text) | P0 |
| S6 | Section: Together: relationship timeline, days-together counter + anniversaries | P0 |
| S7 | Section: Together: places map (3D, select and zoom on click) | P1, after core |
| S8 | Chibi anime couple characters posing at the selected place | P1, after core, owner-only |
| S9 | Section: Guestbook / wishes; any visitor who can see the page (token holder, registered guest, or a visitor on a Published page) can post without an account, rate-limited (Q78); the owner approves before display | P0 |
| S10 | Page mode: normal layout with a 3D scene per section, 2D / reduced-motion fallback | P0 |
| S11 | Four themes (A Dreamy & romantic, B Cosmic / night sky, C Cozy & playful, D Elegant & minimal); more can be added later | P0 for design tokens in all four; see §6.5 for 3D scene depth per theme |
| S12 | English + Vietnamese UI; each content entry in one language with an optional second-language field | P0 |
| S13 | NFC flow: stable link carrying the guest token, re-pointable and rotatable; printable QR code | P0 |
| S14 | Free-tier guardrails: per-account storage and video limits, usage monitoring, keep-alive so the free database does not pause, rate limits on token-gated posting | P0 |
| S15 | Account data export and delete; privacy policy, terms, minimum age, takedown path | P2, last phase, required before publishing to other people |
| S16 | World mode: the whole site as one navigable 3D world, with automatic capability checks and a visible switch to page mode | P1, built after Page mode is evaluated (owner's preferred final experience; see §6.5) |
| S17 | Proposed extra sections (not adopted): Time capsule, Songs, "Open when…" letters, Bucket list, Guest photo upload (moderated), Event info / RSVP | Not scheduled |
| S18 | Email through Resend: welcome, anniversary reminder, new-wish digest, wish-approved thank-you, and account emails (verify, reset). Server-side only, templates in EN/VI, opt-out link on non-account mail, never contains a guest token or private memory text. Adds an **updates digest** (at most one mail a day, only when something new was published; counts and a link, no memory text) to confirmed email subscribers and to registered guests who opted in (Q81) | P1; needs Q37 (sending domain) |
| S19 | **Member** (a registered guest; the guest-facing label is "Member / Thành viên", Q79; there are only two tiers, Owner and Member): created with a **single-use invite code** that only the owner generates, then email + password with a verified email. No blocking gate: visitors enter the page directly (Q77). Can post with a prefilled name, keep email preferences, receive updates. Cannot upload anything. Replaces the "token session required" rule of Q38; the cap of 50 stays and counts open codes plus accounts | P1; needs Q38, Q79, Q37 |
| S19a | **Email subscriber** (no account, no password): a visitor may leave an email address after sending a wish or another interaction, or in Settings, and confirm it through a link (double opt-in) to receive updates; one-click unsubscribe in every mail | P1; needs Q81, Q37 |
| S20 | First-visit tour: a skippable pop-up walkthrough for new guests (once per device, or once per account) and for the owner's first dashboard visit; replayable from settings | P1 (small); Q40 |
| S21 | Zodiac section in a galaxy style, about the **couple** (owner correction 2026-10-22): the partners enter their own birth data in the dashboard; the site computes each sign and a reading of the relationship between them, shown with the owner's character art on an animated star scene. Guests view it read-only and never enter a birthday. Systems and relationship content need research first (Q46-Q49; design 3 §3.10) | P1, after core; Q39, Q46-Q49 |
| S22 | Deny-by-default access: every route, server action, database table and storage object is closed unless a rule opens it (§4.3, E31-E37) | **P0** |

### 3.2 Out of scope (for now)
Public signup and other couples; payments and plans; public discovery across owners; native mobile apps; auto-translation; languages beyond EN/VI; live chat; more than one co-editor; real-time collaboration; uploading real photos to any external tool (until a specific host is approved).

### 3.3 MVP by [DEADLINE] (owner decision: core only)
S1–S6, S9–S14, S22, with S10 and S16 as defined in §6.5. S7–S8 (map and chibi) follow after the deadline. S15 comes last and is only required before publishing to others. S18-S21 are P1 proposals (owner decides in Q37-Q40) and follow core unless the owner moves them up.

### 3.4 Learning goals
Can one content model drive both a 3D world and a normal page? Does the 3D stay smooth on budget phones and in in-app browsers? Does the free tier hold up (storage, bandwidth, inactivity pause, email)?

---

## 4. Requirements

### 4.1 User stories and acceptance criteria
- As the **owner**, I create an account and see an empty dashboard. *AC: a new account has zero pages and zero public output.*
- As the **owner**, I set up a page choosing theme, language, visible sections and visibility. *AC: the wizard offers Token-only as the default visibility, but the page stays Private (invisible to guests) until the wizard's last step publishes the suggested wording and sets the visibility together; sections default to off until enabled.*
- As the **owner**, I let [PARTNER] sign in to the same owner account (Q35). *AC: no invitation email is needed; accounts are provisioned by the owner (Q30); a separate co-editor role is deferred and no screen or function creates one.*
- As the **owner**, I upload photos, short video, voice notes and text. *AC: size/type limits enforced; location data stripped from photos; interrupted uploads fail clearly or resume.*
- As a **guest**, I tap the tag and see only the enabled sections, in my phone's language with a toggle. *AC: disabled sections are absent from navigation and unreachable by URL.*
- As a **guest** who can see the page (token holder, registered guest, or anyone on a Published page), I leave a wish without an account (Q78). *AC: a display name is required; it is held for approval; on a Token-only or Private page an invalid, rotated or missing token cannot post and no wish form is shown; on a Published page a visitor with no credential can post through the rate-limited server path; limits per device, per IP and per page (Q75, Q78).*
- As the **owner**, I switch the page to Private or Published. *AC: Private stops all new guest access immediately (no new content and no new media URLs); media URLs already issued expire within the window decided in Q29; Published makes the public sections searchable; Token-only is not indexed.*
- As the **owner**, I rotate the token if the tag is lost or the link leaks. *AC: the old token stops working at once for new sessions, viewing and posting; sessions and media URLs already issued end within the Q29 window; the tag carries the token, so it must be rewritten and the QR reprinted.*
- As a **guest**, I open the site in 3D world mode, or the page falls back to page mode. *AC: the mode is chosen by device capability; a visible control switches modes; the choice is remembered.*

### 4.2 Functional requirements
FR1 accounts and sessions. FR2 tenancy: every record belongs to one page; access is checked server-side on every read and write. FR3 page setup and settings. FR4 content CRUD per section with draft/published state. FR5 guest views for enabled sections only, gated by visibility state and token. FR6 guestbook: submission allowed wherever the visitor can see the page (valid token, account, or a Published page, Q78), always rate-limited and held in the moderation queue. FR7 media pipeline: validate, strip location metadata, resize and compress images, cap and compress video, generate thumbnails at upload (storage-side image transformation is a paid feature), serve through access-controlled URLs. FR8 i18n: EN/VI strings, optional second-language field, language detection plus manual toggle. FR9 theme system: tokens plus 3D scenes that read the tokens. FR10 NFC link and QR generation. FR11 keep-alive and usage monitoring. FR12 export and delete data (last phase). FR13 mode selection: capability detection, manual switch, remembered choice.

### 4.3 Non-functional requirements
- **Privacy:** Token-only and Private pages send `noindex`; tokens are unguessable (long random values), never derived from names or sequences; only Published pages are indexable. Any third-party service that receives owner content must be named and approved first. Privacy policy, terms and minimum age are required before the site is published to others (last phase).
- **Security:** server-side authorization on every request; input validation; stored-XSS-safe rendering of guest text; rate limiting on login, upload and token-gated posting; secrets only in environment variables (never in Git). A leaked token or full link grants guest **read** access (enabled, published sections) and post-to-queue access until it is rotated; it never allows edits. Guests reach data only through narrow database functions, never through table access or the service-role key (plan §1). The consolidated security concept, the tool selection and the per-phase audit gate are in `docs/design/vegenus_security.md` (Q85).
- **Deny by default (no unauthenticated bypass):** a person with no session and no token can reach only an allow-list (landing, `/g` shell, login, `/join` and its code and verify routes, the subscribe-confirm and unsubscribe landings, the wish post route with its limits, health check, static files). Every other route returns a login redirect or a generic not-found with no data in the response. Four independent layers, so one miss is not a breach: (1) a single route table that classifies every route and fails the build if one is unclassified; (2) an auth check inside every page, route handler and server action (middleware alone is never trusted); (3) row-level security on every table with no anon table access, only the narrow `guest_*` functions; (4) private storage with signed URLs minted after the same checks. Design and tests: `docs/design/vegenus_token_flow.md` §9.
- **Guest powers by credential:** no token = read only what a Published page shows (through `public_*`) and post a wish to the moderation queue through the rate-limited server path (Q78), nothing on a Token-only or Private page; valid token = read enabled published sections and post to the moderation queue; registered guest (invite code, Q79) = same plus a display name, email preferences and updates; owner or co-editor = edit and moderate. Wishes and the email opt-in (Q81) are the only writes open to a visitor with no credential; profile, preferences and access requests need an account (Q36 amended).
- **Personal data (birthdays, emails):** guests' birthdays are never collected. The partners' own birth dates (Zodiac, S21) are entered by the owner, collected at the minimum Q47 needs, encrypted at application level (AES-256-GCM, key in an environment variable, never in Git or CI), kept out of logs, analytics, emails and Git, and deleted with the page. Emails need the address in readable form to send, so they rely on row-level security and the vendor's at-rest encryption (**unverified**), not on application encryption.
- **Performance (proposals, to be measured):** content-first loading; 3D lazy-loaded; asset and GPU budgets set in the plan; automatic downgrade from world mode to page mode to 2D when WebGL2 is missing, memory is low, frame rate drops, data saver or battery saver is on, or `prefers-reduced-motion` is set.
- **Accessibility:** WCAG 2.2 AA target; touch targets at least 44 px; contrast checked in all four themes; a non-3D, keyboard- and screen-reader-friendly path always exists.
- **Language:** fonts must render Vietnamese diacritics correctly; text normalized consistently.
- **Portability:** iOS Safari, Android Chrome and in-app browsers first; desktop supported but secondary.
- **Cost:** $0 target; free-tier limits are design constraints (§8).

---

## 5. Data specification (content and data model; adapted from the template)

The full model is design 3, `docs/design/vegenus_data_model.md` (draft, 2026-10-22). Entities and rules fixed here:

| Entity | Notes |
|---|---|
| User | identity via Google or email/password |
| Page | theme, default language, visibility state (Private / Token-only / Published), enabled-section flags, optional vanity name (Published only) |
| Membership | owner account; the `co_editor` role is reserved and unused (Q35) |
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

### 6.5 Experience modes (owner decision: aim for the whole site as one 3D world within a performance budget; implement both)
| Mode | What it is | When used |
|---|---|---|
| World | The whole site is one 3D scene; the guest moves to sections within it | Capable devices, chosen automatically or by the guest |
| Page | Normal scrolling layout with a 3D scene per section | Default fallback; mid-range phones; in-app browsers if World fails the check |
| Static | 2D layout with no WebGL | No WebGL2, low memory, reduced motion, data/battery saver |

One content model feeds all modes. Build order (owner confirmed): Static and Page first, because they carry the content and are the fallback; evaluate Page mode; then World, the owner's preferred final experience. The deadline is flexible. Design tokens for all four themes come first, then a basic 3D set in all four; the 3D is then improved during the work towards rich versions in all four themes equally (owner, Q57; design 5 §4.5).

---

## 7. Technical specification
Intentionally undecided until the plan is approved. Candidates and research are in `docs/plans/vegenus_plan.md`. Constraints: $0 start, phone performance, EN/VI, tenant-ready isolation enforced server-side, themes added without rewrites, content decoupled from presentation mode.

## 8. Execution environment and cost
Development on [OWNER]'s machine (WSL2). Hosting: Supabase free tier (database, auth, media) and Vercel Hobby, at the free `*.vercel.app` address. All limits, capacity arithmetic and sources are in `docs/plans/vegenus_plan.md` §3 and §R; they are design constraints and are not repeated here.

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
| E11 | Guestbook spam, bots, repeated posts, scripts in text, a valid token or an open Published page abused | Rate-limited per device, per IP and per page (Q75, Q78), sanitized, queue only |
| E12 | Vietnamese text (composed vs decomposed), very long names, emoji | Stored and rendered correctly in all themes |
| E13 | Missing second-language text | Falls back to the entry's own language |
| E14 | Days-together counter across timezones, leap years, future start date | Defined, tested behavior |
| E15 | Two sessions of the owner account edit the same item | No silent overwrite |
| E16 | An account is removed, or the owner deletes the page | Access ends; media and exact Member or confirming-registration Auth identities have durable, retryable cleanup intents before dependent rows are removed; unrelated users are never deleted |
| E17 | WebGL context loss, low memory, slow 3G, offline | Downgrade or retry message; no blank screen |
| E18 | `prefers-reduced-motion`, data saver, battery saver | Motion and 3D reduced or off. Reduced motion forces Static; data saver (where the browser exposes it) picks Static unless the guest chooses 3D; battery saver is not exposed by browsers, so the frame-rate check (E43) covers it (design 5 §3) |
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
| E29 | Attacker registers the owner account's email before the owner does | Registration is closed, so the attacker cannot create the account; legitimate provisioning and login still work |
| E30 | In-app browser drops the URL fragment or blocks cookies | The visit still works in memory or shows a clear "open in your browser" message; the token never moves to a query string |
| E31 | Unauthenticated request to any owner route (`/app`, `/app/anything`, an API route, a server action), or to a token-only guest route without a token (a Published page is readable without a token, read-only, through `public_*`) | Redirect to login or generic not-found; no page data, no hint whether the record exists; response `no-store` |
| E32 | A new route or server action is added without an access rule | Build and CI fail: the route table must classify every route (default deny) |
| E33 | Logged-in Member tries an owner-only action or another page's ID | Refused by row-level security and the handler's role check; same generic result |
| E34 | After log out, the back button or a cached page | No private content shown; authenticated responses are `no-store`; session cookie cleared |
| E35 | Login `next` parameter points to another site | Only relative paths on our own host are followed |
| E36 | Anonymous call straight to the database API with the public key | Tables return nothing; `guest_*` answers only with a valid token, `account_*` only for an active guest account, `public_*` only for Published pages (design 1 §5.1) |
| E37 | Direct URL guess such as `/home`, `/admin`, `/dashboard` | Not-found for unknown paths; login redirect for owner paths; nothing about the owner area is revealed to a guest |
| E38 | Registered-guest sign-up abused (guessed or leaked invite code, many emails, someone else's address) | Needs a valid unused invite code (about 50 bits, stored as a keyed hash), email verification, per-IP and per-device attempt limits with lockout, and the per-page cap; one generic error for wrong, used, revoked or expired codes; the owner can list codes and accounts, revoke a code and remove an account. Rotating the guest link no longer matters for sign-up |
| E44 | Two people redeem the same code at once, or one person submits twice | The code is reserved in one atomic statement; one wins, the other gets the generic error; a double submit or retry by the same address reuses its reservation (same original expiry, at most 30 minutes and bounded by the invite deadline, one pending registration, a new link replaces the old one); a different address gets the generic error |
| E45 | Email typed wrongly at sign-up, or the verification link or invite expires | Reservation lasts at most 30 minutes and never beyond the invite deadline; verification checks both deadlines. A lapsed reservation reopens only an unexpired code |
| E46 | Many guests share one venue Wi-Fi or mobile carrier address | The per-IP wish limit is much higher than the per-device limit (Q78), so a crowd is not blocked by its shared address |
| E47 | Visitor with no token opens a Token-only or Private page | The friendly "tap the tag or scan the QR" notice; no content, no wish form, no sign-up prompt that implies content exists (Q77) |
| E48 | Email subscriber link is forwarded, scanned by a mail security tool, or confirmed twice; another person initiates Member registration | Confirmation needs a deliberate button, not a bare GET; Member updates consent comes from an unchecked checkbox on the mailbox holder’s confirmation screen, not the initial request; repeat confirmation is a no-op; unsubscribe works without sign-in |
| E50 | Subscriber or registered guest receives an update for a Token-only page they cannot open; privacy or consent changes while a digest is queued | The mail says only that there is something new and links to the site; a tap shows the "tap the tag" notice for subscribers; registered guests sign in and see it (Q81). Before every send or retry, recheck page visibility, current published content, recipient eligibility and suppression; cancel ineligible mail |
| E39 | Email provider down, quota reached, or bounce | Send is queued and retried once; a daily cap guards the free quota; a bounce disables that address; the app never blocks on email |
| E40 | Partner birth date entered by the owner (Zodiac) | Validated (real calendar day); encrypted in our server before storage (Q46); guests see signs and the reading, never the date; the date never appears in logs, analytics, error reports or emails; a missing key shows "date unavailable" (design 3 §3.10) |
| E41 | Zodiac cusp dates and year boundaries (sign changes depend on year and time) | Show the sign for the stated date and a note that cusp dates vary by a day; Chinese-zodiac year changes at the lunar new year, not 1 January |
| E42 | Tour pop-up shown on every visit, traps focus, or blocks the token exchange | Shown once; skippable; focus trap with Esc; never delays the token check; replay from settings |
| E43 | Frame rate drops mid-visit (slow phone, heat, battery saver; no browser exposes battery saver) | Resolution lowers first, then the mode steps down once (World → Page → Static), is announced once and remembered on this device; content and position kept (design 5 §3.3) |
| E51 | A section is enabled but has no published item, or a page has no memories yet | A designed empty state (owner wording, Q82), no error, no broken layout, no empty list chrome |
| E52 | An item, photo, voice note or page is deleted or unpublished while a guest holds a link or has it open | The generic "no longer available" result; no data in the response; no broken-image icon (poster or placeholder); same result as an id that never existed |
| E53 | Home has no start date, no photos or no welcome note | The page renders with defaults; the days-together line is hidden until a start date exists (E14); no placeholder text from the product reaches guests |
| E54 | A wording field or a whole language is not set (Q82), or the guest's wanted language is not offered | The page default language is used; the language option is disabled with the "owner has not set this up" message; never a blank label or a raw key |
| E55 | Owner opens the dashboard with no page, or abandons setup halfway | "Set up your page" state. A new account has zero pages; an abandoned setup leaves one resumable Private page with draft wording and keeps its choices. In both cases guests see nothing (zero public output, §4.1) |
| E56 | A guest asks for an id, route or media that does not exist or belongs to another page | The same not-found as E5, E6 and E37, with the same status and timing, so existence is not revealed |
| E57 | Zodiac is enabled but no birth data was entered or published, or the key is missing | The section shows an empty state or is absent; no sign, no date, no error (E40) |
| E58 | The daily job runs and nothing new was published, or no recipient is eligible | No digest is sent and none is queued; the run is logged with a count of zero |

### 9.3 Acceptance checklist (tick per phase)
- [ ] §1.5 metrics measured and recorded
- [ ] All §9.2 rows have a passing test
- [ ] Visibility, token and isolation tests pass
- [ ] No secrets, real names, dates, photos or tag IDs in Git (privacy scan)
- [ ] Verified on iPhone Safari, Android Chrome and one in-app browser, with a real tag and QR
- [ ] All four themes pass visual, contrast and performance checks in page mode
- [ ] EN and VI complete, no hard-coded strings
- [ ] Free-tier usage within limits with alerts configured
- [ ] Security audit gate passed for the phase: no open critical or high finding, mediums fixed or accepted, every `needs_validation` resolved or explicitly accepted in §12 (never open on authorization, isolation or data exposure at Phase 6), Codex security review clean, every audit run complete (`run_status` not incomplete, validators pass), all against one recorded `master` commit that contains every PR of the phase (`docs/design/vegenus_security.md` §6)
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

**Security audit gate (owner, 2026-10-28, Q85).** Every phase from 1 on ends with the audit gate of `docs/design/vegenus_security.md` §6 (automatic checks, the Cloudflare `security-audit` skill, fixes made test-first inside the gate, a Codex security review). The owner is asked to approve a phase only after the gate passes. Phase 0 gets a document-only version (Codex review of the threat model and this concept).

---

## 11. Risks and mitigations
Ranked from the owner's stated concerns first.
| Risk | Prob. | Impact | Mitigation |
|---|---|---|---|
| Privacy leak of personal memories (wrong tenant, leaked token, indexed page, GPS in photos) | Med | High | Server-side checks, hashed unguessable tokens, noindex, EXIF stripping, isolation tests, default Token-only, one-click rotation |
| Surprise cost or throttling (video, bandwidth, viral link) | Med | High | Free-tier limits as design constraints, caps, lazy media, alerts; Supabase restricts the project when quotas are exceeded, so the failure mode is downtime, not a bill |
| Abuse of the token-gated guestbook (spam, harmful text) | Med | Med | Moderation queue, rate limits, token rotation |
| Scope: 4 themes × 3 modes | High | Med | Deadline is flexible (owner); Page/Static first, World after Page mode is evaluated, theme tokens first, a basic 3D set in all four themes, then rich versions improved in all four equally (Q57) |
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

**Project naming (owner, 2026-10-25):** The repository and product are named **Vegenus**. Project document filenames use the `vegenus_` prefix; proposed application identifiers use `vegenus` (including `vegenus_server`, `vegenus_g`, and `X-Vegenus-Guest`). Existing external preview canvas / toolkit names and recorded historical CSS selectors retain their original names until those artifacts are renamed separately. The local checkout directory is independent of the repository name.

| # | Question | Default if unanswered | Status |
|---|---|---|---|
| Q1 | Platform vs single site | Personal site, tenant-ready design | **Answered by owner** (2026-10-21, via Q13) |
| Q2 | Editors | Owner + one invited co-editor | Answered by owner; **superseded by Q35**: one shared owner account, co-editor deferred |
| Q3 | Themes at MVP | All four (A–D); more later | **Answered by owner**; depth of 3D per theme moved to Q57 |
| Q4 | Visibility | Per page; default Token-only | **Answered by owner** |
| Q5 | Login methods | Google + email/password | **Answered by owner** |
| Q6 | Content languages | UI EN/VI; one language per entry + optional second field | **Answered by owner** |
| Q7 | Guestbook | Owner approves before display | **Answered by owner** |
| Q8 | Project name | **Vegenus**; document prefix `vegenus_` | **Answered by owner** (2026-10-25): repository renamed to Vegenus |
| Q9 | harness-os | Enable after PRD and plan approved; will ask first and say it commits | **Answered by owner** |
| Q10 | Stack | Plan compares and prices options | **Answered by owner**; research in plan |
| Q11 | Review gates | After PRD, after Codex challenge, after each design deliverable, before harness-os or spend | **Answered by owner** |
| Q12 | Guests posting without login | A guest holding a valid token (NFC/QR link) may post a message with no account; it goes to the moderation queue; nothing else is writable | **Answered by owner** (2026-10-21) |
| Q13 | Audience | Personal site for [OWNER], tenant-ready design, no public signup or beta program | **Answered by owner** (2026-10-21) |
| Q14 | Public vs token | Until the owner publishes, viewable only through the guest token; once Published, public and searchable. Anyone who opens the page with the token can post a message, with at least a display name. Posting needs the token, so a searcher who arrives without it can read but not post [superseded 2026-10-26 by Q78: a visitor on a Published page may post a wish through the rate-limited path] | **Answered by owner** (2026-10-21); the last clause is my reading of "with that token", not stated outright |
| Q15 | Co-editor permissions | Edit content and approve guestbook; cannot delete page, change visibility or remove the owner | Answered by owner; **deferred** with the co-editor role (Q35) |
| Q16 | NFC tag exact model, capacity, count | Unknown; design for a standard NDEF URL tag | **OPEN by owner's choice** |
| Q17 | Media and storage | Supabase free tier; photos and short video | **Answered in principle**; limits in §8 and plan; caps for video to be set by the owner |
| Q18 | Cost ceiling | $0 | **Answered by owner** (2026-10-21) |
| Q19 | Domain name, and whether it is worth paying for (NFC URL depends on it) | Undecided; use `Vegenus` in docs. A free `*.vercel.app` address costs $0 but ties the tag to it | **Answered by owner** (2026-10-21): free `*.vercel.app` address; the tag and QR URL are tied to it |
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
| Q34c | Guestbook limits | Name 40, message 500, 3 posts per 10 min per link | Answered (2026-10-22). Rate part replaced by Q43 (per device and per IP, 50 per page per day) |
| Q34d | Guest sees own pending message? | No, only after approval | Answered (2026-10-22) |
| Q35 | Login for the partner | One shared account for both; Google as fallback | Answered (2026-10-22), confirmed |
| Q36 | Visitor with no token | Visibility decides; anything that writes needs a token or account | Answered (2026-10-22): a visitor can read the Published page, read-only. **Amended 2026-10-26 by Q78:** the "anything that writes needs a token or account" half no longer holds for wishes |
| Q37 | Resend email | Assume a verified domain is needed for any sending (official docs, plan §R); decide the domain later | **Partly answered**: docs reading approved and done (2026-10-22); domain decision deferred. Owner-only sending without a domain is **unverified** |
| Q38 | Guest accounts ("save my place") | Email-verified, cap 50, owner can remove | Answered (2026-10-22): approved. Email part waits for Q37 phase B. **Amended 2026-10-26 by Q79:** sign-up uses an owner-issued invite code, not a token session |
| Q39 | Zodiac section | Galaxy style; owner supplies the sign characters | Answered (2026-10-22): approved. **Corrected by the owner the same day:** the section is about the couple's own birth data, not guests' (S21, Q46-Q49). Built-in default art in `assets/zodiac-sign/`: owner-approved final source sheets for both systems (Western and Vietnamese, 2026-10-22), to be exported as one SVG per sign (pending). The first constellation SVGs were removed 2026-10-22. The owner can replace it through the dashboard |
| Q40 | First-visit tour | 3-4 skippable steps, shown once | Answered (2026-10-22): approved |
| Q41 | Sign-in emails (verify, reset) via Resend | Only after Q37 domain; until then owner-created accounts | Answered (2026-10-22): approved; waits for Q37 phase B (domain) |
| Q42 | A yearly anniversary on 29 February: which day in other years? | 28 February | Answered (2026-10-22): 28 February |
| Q43 | Q34c says "3 posts per 10 min per link", but every guest shares the one link, so at an event the 4th guest in 10 minutes would be blocked. Count per device instead? | 3 per 10 min per device and per IP, plus 50 per page per day | Answered (2026-10-22): approved, and the IP check must be made known to guests: G6 says the network address is checked briefly to stop spam (never stored), and a blocked guest sees a clear message with the wait time (design 3 §3.8). Replaces the "per link" part of Q34c. The 10-minute window and the equal per-IP count were replaced by Q75 (24-hour window) and Q78 (per-IP limit 20) |
| Q44 | Days-together counter: is the start date day 0 or day 1? What do guests see if the start date is in the future? | Start date = day 1; a future date hides the counter from guests and warns the owner | Answered (2026-10-22): start date is day 1; the counter stays hidden from guests until that day has begun in the page's time zone |
| Q45 | How long to keep rejected wishes, the email log and job logs | 30 days, 90 days, 30 days | Answered (2026-10-22): these are the defaults |
| Q46 | Zodiac: keep the partners' full birth dates (encrypted) or only the computed signs? | Keep both | Answered (2026-10-22): keep both. Signs are computed once at save and stored; page loads only read them (design 3 §3.10) |
| Q47 | Zodiac: which systems and which inputs? | Western (sun; Moon and rising with time and place) and Vietnamese 12 con giáp (lunisolar from Tết, UTC+7; year, month, day pillars, hour pillar with time; mệnh). Inputs: date, birthplace from a built-in list, optional birth time; all encrypted | Answered (2026-10-22): owner asked Claude to research and decide; owner then added birthplace and optional birth time. Design 3 §3.10; facts verified in the research step (needs host approval, rule 1) |
| Q48 | Zodiac: where does the relationship reading come from? | Research once, store our own EN/VI texts as reference data, compose the reading from the relation kinds | Answered (2026-10-22): research, save, render later (design 3 §3.11) |
| Q50 | "Event on that day": what is the event, where does it come from, and may guests see it? | **The sky at birth** (owner clarification 2026-10-22): Moon phase, the planets and their signs, and nearby sky events (eclipse, conjunction, supermoon, meteor shower, equinox or solstice), computed offline at save by the astronomy library and described with our own EN/VI texts; the line is generated and the owner cannot reword it (amended by Q82, 2026-10-26). No encyclopedia data, no outside service. Guests: hidden unless the owner ticks "show details to guests" (planet positions pin the exact date). Shown in the 3D scene if design 5 allows, else a simple 2D Moon plus the line (design 3 §3.10-3.11) | Answered (2026-10-22). First reading (encyclopedia "on this day" events) withdrawn after the owner's clarification |
| Q49 | Do guests see the Zodiac section? | Guests see every enabled section, Zodiac included, read-only; never settings, setup or editing; never the birth dates | Answered (2026-10-22). The owner's per-section on/off switch (S2) is unchanged. Zodiac shows guests the basic level (sun sign, element, year animal, mệnh: reveals the birth year; near Tết it can narrow the date to a few days, so the owner gets a specific warning and can hide the animal); details that could reveal the exact birthday need the owner's opt-in (design 3 §3.10) |
| Q51 | Vietnamese calendar before 1968: Vietnam computed the lunar calendar in UTC+8 until the North's decree of 8 Aug 1967, and the South until 1975 (research §3). Use UTC+7 for every year, or follow history? | Follow history: UTC+8 for births before 1968, UTC+7 after; for a southern birthplace 1968-1975, UTC+8 with a note | Answered (2026-10-22): the default |
| Q52 | Supported birth-year range for the Vietnamese calculation: an independent Tết table was found only for 1984-2030 (research §3) | Keep 1920-2030; years before 1984 shown as "calculated, not cross-checked" until a second source is approved | Answered (2026-10-22): the default. Updated by the second research pass the same day: reference tables now exist for 1920-1967 (Hong Kong Observatory, UTC+8, valid under Q51) and 1984-2030 (Vietnamese, UTC+7). The note shows for every year **without a passing comparison test**: today UTC+7 years 1968-1983 for northern births, 1976-1983 for southern births (southern 1968-1975 use UTC+8 and the HKO rows), and any year whose test fails. Years count as cross-checked only once the Phase 1 test compares them |
| Q53 | Four mood-board colours fail WCAG AA (design 4 §5): theme A muted text, nav labels and pink accent on the rose end of the gradient, theme C rust as small text. Accept the fixes? | Darken A's gradient end (`#a94a6b` → `#934060`), make A's nav and card glass dark at 75 % instead of white at 14 % (decor such as sparkles can sit behind it), lighten A's accent (`#ff7fab` → `#ff9cbf`), add a darker rust `#a3472e` for C's small text (decorative rust unchanged) | Answered (2026-10-23): owner asked Claude to decide; the fixes are applied. The owner will judge the colours on the real product |
| Q54 | Fonts without Vietnamese: Outfit (B body), Fredoka and Caveat (C) | Replace them with creative fonts that match the theme and cover Vietnamese | Answered (2026-10-23): owner asked Claude to decide. Verified in the official `google/fonts` repo: Outfit, Fredoka and Caveat have no Vietnamese subset. Chosen after a rendered Vietnamese specimen: B body **Be Vietnam Pro**; C display **Grandstander**, body **Baloo 2**, handwriting **Patrick Hand** (all OFL with Vietnamese; design 4 §8.1) |
| Q55 | Should each theme also follow the phone's light/dark setting? | No: A and B are night themes, C and D day themes; one scheme per theme (design 4 §10) | Answered (2026-10-23): no, only our themes |
| Q56 | Look of the owner/co-editor dashboard (`/app`) | One fixed neutral look; the chosen theme is shown in the O3 preview and a "view as guest" preview (design 4 §9) | Answered (2026-10-23). Owner first asked what `/app` is (the future logged-in editing part of the site, not a folder), then, on the preview canvas: keep the settings area on one layout, with the theme as the only change. Recorded: one fixed layout, one plain look; the page theme shows in the preview card. Owner also asked for Settings in the guest menu (design 4 §2) |
| Q57 | 3D depth per theme and the order rich variants are built (design 5 §4.5) | Phase 4 base in all four themes (Home motif, section header bands, Zodiac scene, 2D versions); then rich variants one theme at a time (B → A → C → D: **not adopted**, replaced by the owner's answer) | Answered (2026-10-23): basic set first in all four themes, then improved during the work; the goal is rich versions in all four themes equally, no theme first (design 5 §4.5) |
| Q58 | World mode navigation (design 5 §4.3) | A rail: tap a nav item or station, or swipe, and the camera flies to the next station; no joystick or free camera | Answered (2026-10-23): default accepted |
| Q59 | Repo visibility vs CI limits and merge protection | Repo is private (read 2026-10-23). GitHub Free on a private repo gives 2,000 Actions min/month (blocked, not billed, without a payment method) and no protected branches, so merging only when the gate is green is the owner's practice. Options: a) keep private (default), b) make public (free minutes, protected master with required gate; code and docs visible, real data already kept out by rule 3), c) GitHub Pro (price unverified). Design 6 §8 | **Answered by owner** (2026-10-23): b, make the repo public. Before switching: history scan (design 6 §8). After: protect master with required gate |
| Q60 | Signature logo and meaning | Vegenus ("veh-geh-noose") joins Venus, love and beauty, with Vega, the Weaver Girl star and faithful love across distance. The emblem uses one four-point Vega star as the swan's eye; flowing body curves also suggest a galaxy and orbit. The swan evokes Cygnus beside Vega | **Answered by owner** (2026-10-25): approved the final combined emblem and requested SVG/PNG assets under `assets/logo/` on a new branch from `master`. Preserve the approved source; export the four requested palettes and icon sizes. Asset inventory, usage and generation prompt: [logo handoff](../assets/logo/README.md). Approval covers this emblem; earlier wordmark explorations are not an approved final lockup. The owner subsequently explicitly requested committing and pushing this handoff for branch review; the initial approved PNG inventory travels with its checksum manifest (scoped exception in CI design §8) |
| Q61 | Zodiac v3 puts the sign art and the reading on top of the galaxy, against the decor rule (design 4 §3, design 5 §4.2: no text inside a View box) | Allow it only for Zodiac: text always inside a card of 72 % night glass with blur; contrast checked against the brightest frame of the scene | **Answered (owner, 2026-10-24):** the 3D background is there for depth; content may sit over it as long as the main part of the background (galaxy core, sign art) stays uncovered; small overlaps are fine. Reading text still sits in a glass card with the contrast check (default kept) |
| Q62 | Generated art (Codex image tool) for motifs, galaxy, maps and menu buttons vs design 5 principle 4 "procedural before assets" and 0 texture bytes in Page mode | Images become Page-mode art within the byte targets in `docs/design/vegenus_codex_image_brief.md`; SVG/procedural stays as Static fallback; text prompts only, host stated before the run (rules 1 and 3) | **Answered (owner, 2026-10-24): Claude decides.** Decision: Codex images are the Page-mode art in every theme (byte targets in the image brief, WebP); code-drawn SVG/CSS stays as the Static and reduced-motion fallback. Owner approved the Codex image host (`api.openai.com` via Codex CLI) for the whole design system, text-only prompts |
| Q63 | Together map: real map or illustrated? Where do pin positions come from? | Illustrated made-up map; the owner places pins on the drawing; a pin stores x/y on the drawing, never coordinates | **Answered (owner, 2026-10-24):** illustrated map; pins may sit close together when space is tight. A place list (this page's own pop-up menu) lets guests scroll and pick a place; the picked pin rises above the others, plays an opening motion, then the content pops out. Placement: each new pin takes the next free slot from a fixed, seeded slot layout on the drawing (tidy, evenly spread), and once placed a pin never moves when more are added; the slot layout densifies as pins grow. Pin stores slot index + x/y on the drawing, never coordinates. Design in the Together round |
| Q64 | Home photo stack and welcome note: which photos, how many, who writes the note | Owner picks 3-7 published photos for the stack; owner writes the note (per language, ≤ 600 characters); no "start the tour" button | **Answered (owner, 2026-10-24):** accepted as proposed (owner picks 3-7 photos, owner writes the note, no tour button) |
| Q65 | redesign the circular menu (it read as a ball): the button only, or the round item bubbles too? | Button redesigned per theme (moon, ringed planet, toy block, ribbon); items unchanged until the owner says | **Answered (owner, 2026-10-24):** agreed: button redesigned per theme, item bubbles unchanged |
| Q66 | Owner album editing (G3): how much can the owner add per memory and per page, within the 1 GB free storage? | Proposal: each album page uses one layout (big photo, two photos, grid of 4, text, video, voice note) with fixed slots; up to 12 pages, 24 photos, 1 video and 1 voice note per memory; 600 characters per text box; up to 3 stickers per page, placed freely; photos compressed on the phone to ~300 KB (long side 2048 px, location removed); video ≤ 50 MB (aim ~25 MB); storage meter turns amber at 80 % and adding is blocked when full | **Open:** owner asked for templates with + slots and per-page limits (2026-10-24); numbers are Claude's proposal from plan §3 (1 GB, 50 MB per file), owner to confirm |
| Q67 | Where can the guest switch language? | Only in Settings (G8); no VI / EN switch on any page; a memory without the chosen language shows its original text with a short note | **Answered (owner, 2026-10-24)** |
| Q68 | Menu button while something opens over the page (photo viewer, quick look, message page, dialogs) | The menu button hides under the overlay and comes back when it closes | **Answered (owner, 2026-10-24)** |
| Q69 | Guest motion and more dynamic backgrounds | Carry a persistent theme ground through section changes; coordinate menu close, card movement and destination entrance; specify related scroll reveals and a distinct background treatment for each theme. Draft choreography, fallbacks, proposed timing tokens and tests: [guest motion](design/vegenus_guest_motion.md) | **Direction requested by owner**: explore `https://www.getlayers.ai/` and update the documents on `docs/guest-screens-v3` for smoother connected motion and improved backgrounds. Exact timings/compositions are proposed, pending visual evaluation; no application implementation approval implied |
| Q70 | Which exact Layers interaction should be matched, and is a single continuous scroll through all sections intended? | Default: use the supplied homepage and the owner's description as inspiration; preserve current routes/native scrolling and achieve continuity through shared ground and overlapping handoffs. Before claiming fidelity, compare actual desktop/mobile scroll and menu recordings; if the intended reference is a specific template, use its exact URL | **OPEN**: public homepage and selected layer descriptions inspected, but live motion was not verified with an interactive browser. Do not infer its easing, timing or implementation. The draft can proceed as an original Vegenus treatment; a single long page would require a separate route/loading design change |
| Q71 | Signature entrances: approve the Together fall / contact / one rebound entrance and one themed entrance per section, plus the replay policy and a G8 "Intro animations" setting (Always / First time only / Off) with "Use device setting" for motion? | Codex lead design: 1200 ms bounded Together entrance (map falls from the top, larger to smaller, one soft slam, themed impact, then pins unfold); default "First time only" per device and page; Always = full first session, then a 40 % settle; Off = none; first direct arrival may introduce the section (exception to [guest motion](design/vegenus_guest_motion.md) §2); no time-based replay. Details: [guest motion §10](design/vegenus_guest_motion.md#10-signature-entrances-lead-design-by-codex-2026-10-26) | **Answered (owner, 2026-10-26): option 1, the soft fall and slam** (1200 ms bounded entrance). The owner wants a **different fall style for each theme** (new design task: today the fall is shared and only the impact differs; see [guest motion §10.1.3](design/vegenus_guest_motion.md#1013-physical-model)). Replay policy and the first-direct-arrival exception were not chosen: **Replay policy confirmed (owner, 2026-10-26): default "First time only", first-direct-arrival exception off.** The per-theme falls are still to be shown on the boards |
| Q72 | May Elegant (D) add a gold hairline token for its entrance? | No: use the existing `--line` until a muted gold passes contrast and visual review | **Answered (owner, 2026-10-26): yes, add the gold hairline to Elegant (D).** Value to finalise in the colour check: muted gold `#927132` is 4.03:1 on the ivory ground (passes the 3:1 graphic rule; the logo gold `#e8c875` fails at 1.44:1). Design 4 gets one new token for it |
| Q73 | Wish form details: how do the 40 / 500 limits count emoji and decomposed Vietnamese; which language is stored when the page has no language selector (Q67); how are retried uncertain submissions de-duplicated? | One documented NFC-normalised, user-perceived-character counting rule shared by UI and server; store the language from G8 and keep the original text; server de-duplication of retries of the same submission, no automatic client retry until it exists. See [guest UI](design/vegenus_guest_ui.md) | **Defaults adopted by Claude (owner, 2026-10-26: asked for the plain meaning; no choice made).** Plain meaning: these are invisible rules of the wish form. (1) Character limits count what a person sees as one character (an emoji or an accented Vietnamese letter counts once), so a wish is never cut unfairly. (2) A wish is saved in the language chosen in Settings (there is no language switch on the form). (3) If the phone loses signal while sending, the server ignores a repeated send of the same wish, so no duplicates appear. The owner can reopen this any time |
| Q74 | Memories v4 (approved) has scroll parallax and a Ken Burns pan; guest motion §2.1 forbids scroll-driven parallax. Keep or remove? | Remove both from the product; keep the per-theme card entrance, hover and the quick look; user-driven only | **Default adopted (owner, 2026-10-26: saw no difference between the options)**: remove the scroll parallax and the slow photo pan (safer for motion-sensitive guests; the per-theme card entrance, hover and quick look stay). Reopen if the owner wants them back |
| Q75 | Posting limits: should guests see the rules ("3 per 10 min", "40 / 500") on the form? | No standing rule text. Limit per device and per IP becomes a per-day count (default **3 wishes per day**; the 50-per-page-per-day cap stays). The form shows a length counter only near the cap (name from 32 of 40, message from 400 of 500). When the day's limit is reached, a notification pop-up says so kindly and when to come back; it never shows the internal numbers or the IP rule beyond the existing one-line spam note. Design: [guest UI §8](design/vegenus_guest_ui.md) and the "Daily limit notice" boards (canvas page 14, built by Codex) | **Direction from the owner (2026-10-26): about 3 wishes per day**; **Answered (owner, 2026-10-26): 3 wishes per day per device, and the count resets 24 hours after the first wish of the window** (a rolling 24 h window per device and per IP, not midnight). The notice therefore shows the exact time to come back. Replaces the 10-minute window of Q34c / Q43; data model §3.9 and tests updated |
| Q76 | Which font is the Vegenus signature wordmark (top-left header)? | Until found: each theme's own display italic (A Cormorant Garamond, B Fraunces, C Grandstander, D Playfair Display). If the owner's two remembered options cannot be found, show 4 script candidates side by side at phone, tablet and laptop size in four themes | **Decided by Claude at the owner's request (2026-10-26): keep each theme's own display italic for "Vegenus"** (A Cormorant Garamond, B Fraunces, C Grandstander, D Playfair Display; all OFL, already in the theme font set with Vietnamese coverage, self-hosted). Reason: the owner's remembered font "Lyra Script" has no verifiable open licence (not on Google Fonts; a web search found only a paid subscription listing), and this repo is public. Reopen if the owner supplies the source and licence of Lyra Script; then add it for the wordmark only (the word has no accents) |
| Q77 | Entry: should a first-time visitor see a sign-in gate (credentials, invite code or "continue as guest")? | **No blocking gate.** A tap on the tag lands on the page; a visitor with no token also goes straight in. What they see follows visibility: Published = the page, read-only plus wishes; Token-only or Private = the "tap the tag" notice (E47). Sign-in and "I have an invite code" live in the menu, in Settings and in the card shown after a wish. Remembered choices (language, theme, tour seen) stay in local storage; account sessions use an HttpOnly cookie | **Answered (owner, 2026-10-26: visitors enter the page directly)**. Design: [guest UI §11](design/vegenus_guest_ui.md); [token flow §4, §9, §10](design/vegenus_token_flow.md) |
| Q78 | Wishes from a visitor with no token or account | Allowed wherever the visitor can see the page (Published). Rate-limited per device (3 wishes per rolling 24 h, Q75), per IP (**20 per rolling 24 h**, higher because a venue or carrier shares one address, E46) and per page (50 per day); every wish waits for approval. A Token-only page gives no-token visitors no wish form. Supersedes the "writes need a token or account" half of Q36 | **Answered (owner, 2026-10-26: wishes open to anyone who continues as guest with rate limitation; 2026-10-27: take the defaults)**: IP limit 20 per day, no form on Token-only pages. Design 3 §3.9 |
| Q79 | Invite codes and the registered-guest tier | The owner generates single-use codes in the dashboard (10 characters, shown once, stored only as a keyed hash, revocable, optional expiry, optional private label). A code is reserved for at most 30 minutes and no later than its own expiry when someone submits it with an email (no password); the password and optional updates consent are chosen by the mailbox holder on the confirmation page, and the code is consumed when the email is verified (E44, E45). One generic error for wrong, used, revoked or expired. Cap 50 = open codes + accounts. Verification email waits on Q37. Tiers: **Owner** (one shared account for both partners) and **Member** (registered guest) | **Answered (owner, 2026-10-26 and 2026-10-27)**: only Owner and Member; the deadline and confirmation-consent refinements are security-review proposals pending design review; the co-editor shares the owner account (Q35). Defaults kept: code length 10, expiry none unless the owner sets one, a code is not bound to an email. [token flow §10](design/vegenus_token_flow.md); [data model §3.6](design/vegenus_data_model.md) |
| Q80 | Member asks for owner access (co-manage the owner's page) | Was: one 280-character request per Member, declined by the owner, no approval | **Withdrawn (owner, 2026-10-27):** the screens (O17, G27), the stored request, `access_requests` and E49 are removed. The co-editor role stays deferred (Q35). A different request flow is Q84 |
| Q81 | Email updates: when to ask, who receives, what is sent | Ask **after** a sent wish (inside the "sent" state), after other interactions, and in Settings; never at the door. Two recipient kinds: **subscriber** (email only, double opt-in, no login, S19a) and **Member** (updates toggle, default off). The consent box is unchecked; Member consent is chosen by the mailbox holder at confirmation. Every mail has a one-click unsubscribe. One digest a day at most, only when something new was published, counts and a link, no memory text, no token (S18, E50). Cap of 50 active subscribers per page; the daily Resend cap (100 a day, plan §R) bounds sending; the owner's own mail goes first. Consent text (EN): "Send me an email when new memories are added. I can unsubscribe at any time." (VI): "Gửi email cho tôi khi có kỷ niệm mới. Tôi có thể hủy đăng ký bất cứ lúc nào." Needs Q37 (a verified sending domain) before anything is sent | **Answered (owner, 2026-10-26: register an address after a wish or another interaction; 2026-10-27: Claude decides, keep defaults)**. Mailbox-holder confirmation consent and dispatch rechecks are security-review proposals pending design review. Personal data: addresses stay out of Git, logs and Codex (rule 3) |
| Q82 | Editable wording: which texts may the couple edit, and which stay generated or fixed? | Four kinds: A couple's content (editable, as today), B editable wording with a suggested example per field and per language (greeting, section names, button labels, empty states, placeholders, thank-you, tour, email greeting), C generated text (zodiac, sky at birth, counters, dates; never editable), D fixed system text (errors, limits, privacy and consent). Values reach edited sentences through locked tokens such as `{days}`. New owner screen O18 "Wording", one Settings screen, draft and publish like items. Design: [editable wording](design/vegenus_editable_copy.md) (the 27 keys and rules); storage, publication and tests: [data model §3.12](design/vegenus_data_model.md) | **Answered (owner, 2026-10-26):** split A/B/C/D accepted; section names fixed (no renaming); guests see only owner-saved wording and a language is selectable only when fully set up (disabled with an "owner has not set this up" message); all wording is edited in one Settings screen with one publish. Zodiac is entirely generated: the owner gives birth data only, and the Q50 reword of the sky line is removed. No open points |
| Q83 | Home when content is missing: how many wording fields stay, and what shows with no photos or no welcome note? | Keep the 27 editable fields per language. Missing photos and a missing welcome note show fixed system notices (kind D), previewed separately and together. Never show sample photos, a sample signature or a photo counter as real content in those states (E53) | **Answered (owner, 2026-10-27):** keep 27 fields; use fixed notices. Restored from the review's quotation after the originating session's note was lost; to be confirmed. Design: [editable wording](design/vegenus_editable_copy.md) |
| Q84 | Multi-tenant: a Member requests their own workspace | Idea, **low priority, not designed**. A person signs up and becomes a Member straight away (no guest step first). The account is empty and cannot be used until the Member submits a request form; only the developer sees it and approves it, in the Supabase dashboard (no screen built). An approved account gets its own empty space for its own memory pages | **Deferred (owner, 2026-10-27):** finish the platform for personal use first. Unresolved when this is scheduled: whether invite codes (Q77-Q79) are dropped for open sign-up, what the form asks, what "empty space" holds, and per-account storage and privacy limits |
| Q85 | Security: a dedicated security section and a security audit after each phase, with fixes made inside the gate | Adopted: `docs/design/vegenus_security.md`. Phase-gate tool: Cloudflare `security-audit` skill (source audit) plus a Codex security review; platform scanners and CI tests on every PR | **Answered (owner, 2026-10-28):** wants a dedicated security section, an audit after each phase fixed directly, Cloudflare's skill as the tool, and a Codex review. The choice of the remaining tools was delegated to Claude (design 7 §4) |
| Q86 | Install the Cloudflare `security-audit` skill: which hosts and where | Project level, install folder git-ignored, pinned by a digest of upstream file hashes (design 7 §5) | **Answered (owner, 2026-10-28):** it was already installed globally (2026-10-27); "put them in project level". Done 2026-10-28 by a local copy (no new download); 20 files verified against upstream, pattern-scanned, pinned. The prose files were scanned, not read line by line |
| Q87 | Turn on GitHub secret scanning with push protection, Dependabot alerts and CodeQL default setup | Secret scanning, push protection and Dependabot alerts at the start of Phase 1; CodeQL once JavaScript/TypeScript exists. No new workflow file | **Answered (owner, 2026-10-28): "turn on whenever we need".** Not yet enabled. Free on public repos is a recollection, unverified |
| Q88 | Production promotion hold: Q33 deploys `master` to production on merge, but the phase audit runs on the merged commit | Before go-live production holds no real data (no real content, no tag written for guests until the Phase 6 gate passes), so Q33 stands. After go-live a merged commit is staged and the owner promotes it only after the diff audit and Codex review of that commit (design 7 §6.5; staged builds sit behind Deployment Protection), and a confirmed finding after go-live is contained, fixed and audited privately before its fix is published (§6.6) | **Answered (owner, 2026-10-28): adopted; the owner will turn on the Vercel settings when Phase 6 is reached ("will try"; Hobby availability unverified).** Amends Q33 for the after-go-live period. Vercel documents the settings (design 7 §6.5); Vercel Authentication is free on all plans, but the Hobby availability of turning off auto-assign is unverified |
| Q89 | How database migrations reach the production Supabase project; Q33 and plan §12.3 only cover the app build, but authorization lives in the database | The owner applies the reviewed migration files from the candidate with the Supabase CLI, never from CI (no secrets in CI); a release deploys the migration first, the app second, and a security fix is verified against production before containment is lifted (design 7 §6.5 rule 4, §6.6) | **Answered (owner, 2026-10-28): manual for now; the owner applies the migrations to production personally.** Revisit if it becomes error-prone. The Supabase command and connection method are unverified until Phase 1 |
| Q90 | Backup mechanism, and recovery from an older snapshot without resurrecting deleted data or revoked access (E23 covers only a paused database) | — (no default) | **Deferred (owner, 2026-10-28): no backup for now, maybe in the future.** Design 7 §6.7 keeps the recovery rules and a snapshot-restore test as a dormant requirement for when a mechanism is added |

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
- Default / decision: Vercel connected to GitHub: a preview site per pull request using a separate test database with fake data; the live site updates only after the `gate` check passes and the owner merges. Actions minutes and branch protection on a private repo: checked 2026-10-23, see design 6 §2 and Q59
- Status: Answered (2026-10-22, confirmed). Connecting Vercel to GitHub still needs rule-1 approval of the exact hosts.

**Q34**
- Question: Guest details: (a) show the link and QR once, or store the token so it can be shown again; (b) cookie lifetime; (c) guestbook limits; (d) does the guest see their own pending message
- Default / decision: (a) Show once, plus a printable QR sheet at creation; a lost link means rotate and rewrite the tag. Discussion in `docs/design/vegenus_token_flow.md` §3.2
- Status: See the table: Q34a answered (show once), Q34b-d answered 2026-10-22.

**Q35**
- Question: How the co-editor gets a first login without email
- Default / decision: Superseded: see below
- Status: Answered (2026-10-22): one shared account for both partners, confirmed.

**Q36**
- Question: Visitor with no token: the owner said visitors may view everything but not post, and also that no one can open /home without authentication
- Default / decision: Visibility decides: Token-only and Private pages show a visitor only the "tap the tag" screen; a Published page shows its published sections read-only, never drafts. Anyone who writes (wish, profile, email) needs a token session or account
- Status: Answered (2026-10-22): a visitor can read the Published page, read-only.

**Q37**
- Question: Resend for email (welcome, anniversary reminder, wishes, thank-you). Needs: approval to read the vendor docs (`https://resend.com/docs`, official, HTTPS) and later to sign in; a sending domain to reach anyone but the owner; reminder timing needs a daily scheduler
- Default / decision: Approve research only now. Phase A (free, no domain): emails to the owner's own address only (reminders, wish digest). Phase B: guest emails after the owner owns a domain, ideally after the rename. Free plan limits **unverified** until docs are read
- Status: Partly answered: docs reading approved and done 2026-10-22 (plan §R); domain decision deferred. Owner-only sending without a domain is unverified.

**Q38**
- (Superseded 2026-10-26 by Q77-Q79: no token session is needed; an owner-issued invite code creates the account.) Question: Guest accounts: after a valid token, a guest may "save my place" so they can sign in later without the tag. Possible: yes
- Default / decision: Email-verified account (link in email), passwordless sign-in by emailed link or password; cap 50 per page; owner can list and remove; rotation stops new sign-ups through the old link but does not remove existing guest accounts; Private page blocks them. Needs Q37 Phase B (email to guests)
- Status: Answered (2026-10-22): approved; email part waits for Q37 phase B.

**Q39**
- Question: Zodiac section: which system, what to store, how it looks
- Default / decision: Western sun signs first (month and day only; computed in the browser; nothing stored unless a signed-in guest opts in, and then the sign, not the birthday). Option: Chinese/Vietnamese animal sign (needs the year). Encrypted birthday only if birthday emails are wanted. Animated constellation SVGs drawn in-repo; fun facts written by us in EN/VI, labelled "for fun". Zodiac also becomes the motif of Theme B (Cosmic / night sky)
- Status: Answered (2026-10-22): approved; galaxy style; owner uploads the character art later. Update 2026-10-22: 12 non-personal Western constellation SVGs ship in `assets/zodiac-sign/` as the built-in default art (design 3 §3.3); the 12 Vietnamese animals are a separate set. Update 2026-10-22: the owner approved final source sheets for both systems (`assets/zodiac-sign/source-sheets.md`); per-sign exports pending. The first 12 Western SVGs were then removed at the owner's request; they remain in Git history.

**Q40**
- Question: First-visit tour for guests and for the owner's first dashboard visit
- Default / decision: 3-4 skippable steps, once per device (once per account when signed in), replay in settings, EN/VI, accessible
- Status: Answered (2026-10-22): approved.

**Q41**
- Question: Email for the sign-in system itself (verify, password reset)
- Default / decision: Supabase Auth can send through Resend (SMTP setting) once Q37 Phase B exists; until then only owner-provisioned accounts, as in Q30
- Status: Answered (2026-10-22): approved; waits for Q37 phase B.

**Q59**
- Question: Repo visibility vs CI limits and merge protection
- Default / decision: a) keep private. Source: docs.github.com (Actions billing, GitHub's plans, rulesets). Design 6 §8
- Status: **Answered by owner** (2026-10-23): b, make the repo public. Before switching: history scan (design 6 §8). After: protect master with required gate

---

## Appendices
**Glossary:** *Tenant/page*: one site's data. *Token-only*: reachable only with the unguessable guest token, not indexed. *Fallback*: simpler experience when 3D cannot run.
**Runbook:** not yet written; added when there is something to run.
