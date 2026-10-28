# Progress: Vegenus

Live status and the implementation tracker. Decisions and open questions: [PRD](vegenus_PRD.md) §12 (single source). Research: [plan](plans/vegenus_plan.md) §R. Phases, exit criteria and gates: PRD §10. Edge-case catalog: PRD §9.2. Acceptance checklist: PRD §9.3. Definition of Done: PRD §1.6. The round-by-round history that used to fill this file is in Git (commit history of this file); only live status and a short summary are kept.

Update this file after every step. Rule: a task is Done only when its test was seen failing (RED), then passing (GREEN), CI `gate` is green, and the evidence line is filled.

## 1. Status (2026-10-27)

- Phase 0 (planning and design) is in progress. No application code exists, no CI workflow exists, harness-os is not enabled. Code starts only after the owner approves the PRD, the plan and all design previews (CLAUDE.md).
- Approved by the owner: PRD ("looks good", 2026-10-21), plan (2026-10-23, Phase 1 not to start yet), designs 1, 2, 3, 5, 6 (2026-10-23), logo (Q60), Home (2026-10-24), Zodiac (2026-10-24).
- Draft, awaiting owner review: design 4 theme system (v0.13; Q53-Q76 answered), guest UI, owner UI, guest motion, editable wording (canvas pages 4-14, version 95).
- Open decisions: Q16 NFC tag model, Q37 sending domain, Q66 album limits, Q70 Layers reference. Deferred by the owner: co-editor role (Q35) and multi-tenant workspace requests (Q84, low priority).
- Answered 2026-10-27: Q78 (per-IP wish limit 20 per rolling 24 h), Q79 (two tiers: Owner and Member), Q80 (withdrawn the same day: no Member request to co-manage; see Q84), Q81 (defaults kept).
- Not built: canvas boards for G20-G26 and O16; Together phone pins overlap (decision needed).
- Wording boards, locally prepared versus live canvas (reported by the 2026-10-27 review; the original handoff entry, including Q83, was overwritten when this file was rewritten and its text is not in the repository): 63 boards completed locally, with 169 source and state checks and 432 browser cases passing. The live canvas (version 95) does not yet contain them; synchronising them is pending. Until then the wording work is "prepared locally", not "published", and the open list in editable wording §6 describes the live canvas. Q83 was re-entered in the PRD on 2026-10-27 from the review's quotation; the originating session should confirm the wording.
- Documentation consistency review of 2026-10-27 is closed (section 6).
- Security review follow-up: five source-level design gaps have proposed documentation fixes (Auth cleanup, invite deadlines, digest dispatch, mailbox-holder consent, UTF-8 byte caps). These contracts and their tests are specified, not implemented or runtime-validated. G24 confirmation consent needs the complete phone/tablet/laptop, four-theme, state and accessibility preview before design approval.
- Security (2026-10-28): design 7 `docs/design/vegenus_security.md` adds the security concept, tool selection and a per-phase audit gate (Q85, answered). The Cloudflare `security-audit` skill is installed at project level in `.claude/skills/` (git-ignored, pinned; Q86 answered); GitHub secret scanning, push protection and Dependabot alerts are to be enabled at the start of Phase 1 and CodeQL once code exists (Q87 answered). Phase 0 version of the gate = Codex review of this document.

## 2. How to read the tracker

Status values: **Not started** · **Specified** (test row exists in a design document) · **RED** (test written and seen failing, evidence recorded) · **GREEN** (passes) · **Reviewed** (Codex review done) · **Done** (GREEN + CI `gate` green + evidence + gate passed).

Test levels: Unit, DB (SQL against a local database), API, E2E (Playwright, phone viewport), Manual (real devices), CI.

Spec column: D1 token flow §8, D2 screens (flows), D3 data model §9, D4 theme system, D5 3D approach §11, D6 CI spec, Motion = guest motion §9.

"Missing information" rows (E51-E58) are edge cases where the data, record or language does not exist; they are required tasks like every other row.

## 3. Phase tracker (PRD §10)

### Phase 0: Planning and design (weeks 1-2)

Exit criterion (PRD §10): the owner approves each deliverable. Gate: owner review after the PRD, after the Codex challenge and after each design deliverable.

| Deliverable | Status |
|---|---|
| PRD v0.6 | Done (owner approved) |
| Codex challenge of PRD and plan (7 findings, all addressed) | Done |
| Plan v0.3 | Done (owner approved 2026-10-23) |
| Plan v0.4 (guest-access and wording changes) | Draft, awaiting owner review |
| Design 1 token flow, 2 screens, 3 data model | Done (approved 2026-10-23; later revisions under review: Q77-Q82) |
| Design 4 theme system | Draft, awaiting owner review |
| Design 5 3D approach | Done (approved 2026-10-23); motion supplement is a draft |
| Design 6 CI spec | Done (approved 2026-10-23) |
| Guest UI, owner UI, guest motion, editable wording | Draft, canvas review per page |
| Canvas boards for every screen, size, theme and state (CLAUDE.md complete-designs rule) | In progress: G20-G26, O16 missing |

Edge-case tasks in this phase: every row E1-E58 has a designed behaviour and a test row in a design document (section 3 "Spec" columns). A row without a test row is a Phase 0 defect. Current count without a test row: 0.

Open before leaving Phase 0: owner review of the drafts above; Q16, Q37, Q66, Q70.

### Phase 1: Foundations (weeks 3-4)

Content: skeleton, auth, tenancy, visibility, token, privacy rules, CI. First unit: the CI walking skeleton (plan §12.4: a failing test, a push that shows CI red, then green). Exit criterion: visibility, token and isolation tests green. Gate: owner OK before enabling harness-os or any spend. Status: Not started.

Security gate (design 7 §6, Q85): Not started. Pass criteria: no open critical or high finding, mediums fixed or accepted, every `needs_validation` resolved or explicitly accepted in PRD §12, Codex security review clean, audit run complete (`run_status` not incomplete, validators pass), all on one recorded `master` SHA.

| Task | Test first | Status |
|---|---|---|
| T1.1 CI skeleton with the `gate` check (D6) | one failing test shown red on GitHub, then green | Not started |
| T1.2 Route table and deny-by-default checks | crawler test, build fails on an unclassified route | Not started |
| T1.3 Supabase project, RLS on every table, `guest_*`, `public_*`, `account_*` functions, `vegenus_server` role | schema lint and anon-role tests (D3 §9) | Not started |
| T1.4 Owner auth (closed registration, Google for pre-created accounts) | E22, E25, E29, E33-E35 | Not started |
| T1.5 Pages, sections, guest token (hash, fragment, cookie, rotation), visibility, publication status | E3-E6, E21, E27, E28, E30 | Not started |
| T1.6 Privacy scan job | seed and repo contain only placeholders | Not started |

Edge cases required in this phase:

| ID | Case | Expected | Level | Spec | Status |
|---|---|---|---|---|---|
| E3 | Link leaked or tag lost | Rotate; old token dead for view and post | DB + API + E2E | D1, D3 | Specified |
| E4 | Page set to Private while a guest has it open | Next request returns nothing, no media URL | DB + API | D1 | Specified |
| E5 | Disabled section requested by URL | Not found, no data | DB + E2E | D1 | Specified |
| E6 | Another account or another page's token | Denied on every route | DB + API | D1, D3 | Specified |
| E21 | Token-only or Private page crawled | `noindex`, not in sitemap | API | D1 | Specified |
| E22 | Account takeover, reset abuse | Rate limit, verification, one generic answer | API | D3 | Specified |
| E25 | Invite or reset mail to a non-team address | Owner provisions accounts; no such mail | API | D3 | Specified |
| E27 | Token in history, logs, screenshot | Fragment only; never in logs or referrers; rotation is one action | API + E2E | D1 | Specified |
| E28 | Drafts or pending entries inside an enabled section | Never returned, including media URLs | DB | D1, D3 | Specified |
| E29 | Attacker registers the co-editor's email first | Registration closed | API | D3 | Specified |
| E30 | In-app browser drops fragment or cookies | Works in memory or shows "open in your browser" | E2E | D1 | Specified |
| E31 | Unauthenticated request to owner route or token route | Allowed result only | API (crawler) | D1 | Specified |
| E32 | New route without an access rule | Build and CI fail | CI | D1 | Specified |
| E33 | Member or other-page user attempts an owner action | Refused by RLS and handler | API + DB | D1, D3 | Specified |
| E34 | Back button or cache after log out | No private content; `no-store` | E2E | D1 | Specified |
| E35 | Login `next` to another site | Relative paths only | API | D1 | Specified |
| E36 | Anonymous call to the database API | Nothing without a valid credential | DB | D1, D3 | Specified |
| E37 | Guessed paths (`/home`, `/admin`) | Not found or login; nothing revealed | E2E | D1 | Specified |
| E56 | Id or route that does not exist or belongs to another page | Same not-found, status and timing as E5, E6, E37 | API | D3, D2 flow 11 | Specified |

Acceptance rows (PRD §9.3) due at this phase: visibility, token and isolation tests pass; no secrets, names, dates, photos or tag IDs in Git; progress file and plan current.

Evidence (fill in): RED run, GREEN run, CI run link, review result. None yet.

### Phase 2: Owner tools (weeks 5-7)

Content: setup wizard, content CRUD with draft and publish, media pipeline, limits, keep-alive, usage meter. Exit criterion: the owner publishes an empty-to-live page. Gate: owner review. Status: Not started.

Security gate (design 7 §6, Q85): Not started. Pass criteria: no open critical or high finding, mediums fixed or accepted, every `needs_validation` resolved or explicitly accepted in PRD §12, Codex security review clean, audit run complete (`run_status` not incomplete, validators pass), all on one recorded `master` SHA.

| Task | Test first | Status |
|---|---|---|
| T2.1 Setup wizard O3 (six steps, partner names, wording acceptance, Finish and publish), dashboard O2, empty state | E55 | Not started |
| T2.7 Wording core: `copy_keys`, `page_copy`, `copy_validate`, draft seeding at page creation, `owner_copy_accept_defaults(visibility)` | Q82 seed, validation, accept and guard tests (D3 §9) | Not started |
| T2.2 Items CRUD with draft and publish, overwrite check | E15 | Not started |
| T2.3 Media pipeline: browser re-encode, EXIF strip, reservations, budget, deletion worker | E7-E10, E16 | Not started |
| T2.4 Home item, counter rules | E14 | Not started |
| T2.5 Keep-alive, heartbeat, missed-run alert, usage meter and alerts | E23, E24 | Not started |
| T2.6 Share screen O8 (show-once link and QR), visibility O9 | E3 UI | Not started |

| ID | Case | Expected | Level | Spec | Status |
|---|---|---|---|---|---|
| E7 | Photo with GPS or EXIF | Location stripped before storage | Unit + API | D3 | Specified |
| E8 | HEIC, huge, corrupt, wrong extension | Rejected or converted with a clear message | DB + API | D3 | Specified |
| E9 | Upload interrupted or session expires | Clear recovery, no orphan files | DB + API | D3 | Specified |
| E10 | Video over 50 MB or storage near 1 GB | Blocked with a message; earlier warning | DB + API | D3 | Specified |
| E14 | Counter across time zones, leap years, future start | Defined and tested | Unit | D3 | Specified |
| E15 | Two editors on one item | No silent overwrite | DB | D3 | Specified |
| E16 | Account removed or page deleted | Access ends; data and media deleted per policy | DB | D3 | Specified |
| E23 | Database paused | Missed run alerts; calm error; tested restore | API + Manual | D3 | Specified |
| E24 | Egress quota nearly used | Alert; thumbnails and posters first | API | D3 | Specified |
| E52 | Item or media deleted while a guest holds a link | "No longer available"; no data; no broken image | DB + API | D3, D2 flow 11 | Specified |
| E53 | No start date, photos or welcome note | Defaults render; counter hidden | E2E | D2 flow 11 | Specified |
| E55 | No page yet, or setup abandoned | "Set up your page"; nothing public | E2E | D2 flow 11 | Specified |

Acceptance rows due: free-tier usage within limits with alerts configured; the owner publishes an empty-to-live page in one sitting (metric 1), which includes accepting the suggested wording.

### Phase 3: Guest experience, Static and Page (weeks 8-10)

Content: token exchange, `public_open`, guest views, EN and VI, guestbook with limits and moderation, NFC and QR flow, mode selector. After the core of the phase (priority P1): invite codes and Members, email subscribers, editable wording, Zodiac, email. Exit criterion: a real tag and QR tested on both phone types. Gate: owner review. Status: Not started.

Security gate (design 7 §6, Q85): Not started. Pass criteria: no open critical or high finding, mediums fixed or accepted, every `needs_validation` resolved or explicitly accepted in PRD §12, Codex security review clean, audit run complete (`run_status` not incomplete, validators pass), all on one recorded `master` SHA.

| Task | Test first | Status |
|---|---|---|
| T3.1 Guest views G1-G8, enabled sections only, `copy` returned by the open functions | E5, E13, E51 | Not started |
| T3.2 Wishes G5-G7: three paths (token, Member, visitor on a Published page), limits Q75/Q78, moderation O7 | E11, E46, E47 | Not started |
| T3.3 EN and VI, no hard-coded strings, fallback rule Q67 | E12, E13, E54 | Not started |
| T3.4 Mode selector (Static and Page) | E1, E2 | Not started |
| T3.5 NFC write and QR | E1, E2 on real devices | Not started |
| T3.6 P1: invite codes, Members, sign-up and retry contract | E38, E44, E45 | Not started |
| T3.7 P1: subscribers, digest | E48, E50, E58 | Not started |
| T3.8b P1: wording editor O18 and `owner_copy_*` functions | Q82 validation, publish, language tests (D3 §9) | Not started |
| T3.9 P1: Zodiac with encrypted birth data | E40, E41, E57 | Not started |
| T3.10 P1: email (Resend, needs Q37) | E39 | Not started |

| ID | Case | Expected | Level | Spec | Status |
|---|---|---|---|---|---|
| E1 | No NFC, NFC off, unsupported iPhone | QR and link work | Manual | D1 | Specified |
| E2 | In-app browser | Loads; graceful downgrade | Manual + E2E | D1 | Specified |
| E11 | Wish spam, bots, scripts, abused token or Published page | Per-device, per-IP, per-page limits; sanitized; queue only | DB + API + E2E | D1, D3 | Specified |
| E12 | Composed vs decomposed Vietnamese, long names, emoji | Stored and rendered correctly in all themes | DB + E2E | D1, D3 | Specified |
| E13 | Missing second-language text | Falls back to the entry's language | DB + E2E | D3 | Specified |
| E20 | Place without photo (after core) | Default scene | E2E | D2 flow 12 | Specified |
| E38 | Member sign-up abused | Valid unused code, verified email, lockouts, cap | DB + API | D1, D3 | Specified |
| E39 | Email provider down, quota, bounce | Queued, retried once, capped; app never blocks | API | D1, D3 (provider-failure row) | Specified |
| E40 | Partner birth date | Validated, encrypted, never shown or logged | DB + API | D3 | Specified |
| E41 | Zodiac cusp dates and year boundaries | Stated sign, cusp note, lunar-year rule | Unit | D3 | Specified |
| E42 | Tour on every visit, traps focus, blocks token exchange | Once, skippable, Esc, never delays the check | E2E | D2 flow 12, D1 | Specified |
| E44 | Two redeem one code, or one submits twice | One wins; same-address retry reuses the reservation | DB + API | D1, D3 | Specified |
| E45 | Wrong email or expired link | Reservation ends by the invite deadline or 30 minutes; only an unexpired code returns to open | DB + API | D1 | Specified |
| E46 | Crowd on one Wi-Fi | Per-IP limit (20) above per-device (3) | API | D1, D3 | Specified |
| E47 | No token on a Token-only or Private page | "Tap the tag" notice, no form | E2E | D1 | Specified |
| E48 | Subscriber link forwarded, scanned, confirmed twice | Button confirmation; second is a no-op | API + E2E | D1 | Specified |
| E50 | Update for a page the recipient cannot open | Counts and a link only; notice on tap | API + DB | D1 | Specified |
| E51 | Enabled section with no published item | Designed empty state | E2E | D2 flow 11 | Specified |
| E54 | Wording field or language not set | Default language; option disabled; no raw key | DB + E2E | D3, D2 flow 11 | Specified |
| E57 | Zodiac without data | Empty state or absent; no error | API + E2E | D3, D2 flow 11 | Specified |
| E58 | Daily job with nothing new | No digest queued | API | D3, D1 | Specified |

Acceptance rows due: EN and VI complete with no hard-coded strings; verified on iPhone Safari, Android Chrome and one in-app browser with a real tag and QR.

### Phase 4: Themes and 3D, Page mode (weeks 10-13)

Content: four token sets, scene presets, per-section scenes, fallbacks, menu, signature entrances, connected backgrounds. Exit criterion: performance and accessibility checks pass. Gate: owner review per theme. Status: Not started.

Security gate (design 7 §6, Q85): Not started. Pass criteria: no open critical or high finding, mediums fixed or accepted, every `needs_validation` resolved or explicitly accepted in PRD §12, Codex security review clean, audit run complete (`run_status` not incomplete, validators pass), all on one recorded `master` SHA.

| ID | Case | Expected | Level | Spec | Status |
|---|---|---|---|---|---|
| E18 | Reduced motion, data saver, battery saver | Motion and 3D reduced or off; reduced motion forces Static | E2E | D4, D5 | Specified |
| E19 | Theme switched after content exists | Content intact; contrast passes | E2E + DB | D4 | Specified |
| E41 | Zodiac scene at cusp dates | Same facts in DOM and scene | Unit | D5 | Specified |

Also: Motion §9 tests (interruptions, focus and history, reduced motion, slow loading, contrast through transitions), theme tests 1-10 (D4), budgets (D5 §6.1), layer rule, 320 px and 200 % text, 44 px targets.

Acceptance rows due: all four themes pass visual, contrast and performance checks in page mode.

### Phase 5: World mode (weeks 13-15)

Content: whole-site 3D world, capability check, switch. Exit criterion: meets budget on test phones or auto-bypasses. Gate: owner go or no-go on keeping it in the release. Status: Not started.

Security gate (design 7 §6, Q85): Not started. Pass criteria: no open critical or high finding, mediums fixed or accepted, every `needs_validation` resolved or explicitly accepted in PRD §12, Codex security review clean, audit run complete (`run_status` not incomplete, validators pass), all on one recorded `master` SHA.

| ID | Case | Expected | Level | Spec | Status |
|---|---|---|---|---|---|
| E17 | WebGL context loss, low memory, slow 3G, offline | Downgrade or retry message; never a blank screen | E2E | D5 | Specified |
| E26 | Switching World, Page, Static mid-session | State and language kept; no memory growth | E2E | D5 test 6 | Specified |
| E43 | Frame rate drops mid-visit | Resolution first, then one step down, announced once, remembered | E2E | D5 test 4 | Specified |

### Phase 6: Hardening (weeks 15-16)

Content: rate limits, monitoring, backups, real-tag test, buffer. Exit criterion: PRD §9.3 core rows ticked. Gate: owner go or no-go. Status: Not started.

Security gate (design 7 §6, Q85): Not started. Runs twice, before any real couple content goes live or a tag is written for guests.

Tasks: re-run every E1-E58 row end to end against production-like data; restore drill (E23); egress alert drill (E24); abuse drills (E11, E22, E38, E46); real tag and QR on an iPhone, an Android phone and one in-app browser (E1, E2); event-day check; privacy scan of the whole history before publishing.

### After core and last

After core: places map and chibi couple (S7, S8), extra sections (S17): E20 and place tests. Last: legal, data export and delete (S15), required before the site is shown to others (E16 export side).

## 4. Edge cases against acceptance rows (PRD §9.3)

| Acceptance row | Edge cases that must pass | Phase |
|---|---|---|
| §1.5 metrics measured and recorded | none (measurements) | 2, 3, 4, 5, 6 |
| All §9.2 rows have a passing test | E1-E58 | 6 |
| Visibility, token and isolation tests pass | E3-E6, E21, E27-E37, E56 | 1 |
| No secrets, names, dates, photos or tag IDs in Git | privacy scan, E39 (no addresses in logs), E40 | 1, then every phase |
| Verified on iPhone Safari, Android Chrome and one in-app browser, real tag and QR | E1, E2, E30 | 3, 6 |
| All four themes pass visual, contrast and performance checks | E18, E19 | 4 |
| EN and VI complete, no hard-coded strings | E12, E13, E54 | 3 |
| Free-tier usage within limits with alerts | E10, E23, E24 | 2, 6 |
| Review by a second reviewer (Codex) against plan and PRD | all | each phase |
| Progress file and plan updated to what was built | all | each phase |

Definition of Done (PRD §1.6): a phase is done when its exit criteria pass, its §9.3 rows are ticked, this file is current and the owner reviewed at the gate. The project is done when the owner's real page is live, a real NFC tag and a QR code open it on an iPhone and an Android phone, and §9.3 is fully ticked for the core scope.

## 5. Open items

| Item | Next step |
|---|---|
| Q16 NFC tag model | Owner (open by choice) |
| Q37 sending domain; blocks every email path | Owner |
| Q66 album limits; Q70 Layers reference | Owner |
| Design 4 review; drafts of guest UI, owner UI, motion, wording | Owner |
| Canvas boards: G20-G26, O16; rendered check of wording boards; Together phone pin overlap | Claude and Codex |
| Co-editor role (Q35) and multi-tenant workspace request (Q84) | Deferred by the owner, low priority |
| Supabase CLI version to pin; `vegenus_server` connection method; storage CORS for photo textures | Before Phase 1 and 2 |
| Private-email push block and `noreply` commit email (D6 §8) | Owner, before the repository is switched public |
| Q88 answered: owner turns on the Vercel promotion hold and Deployment Protection at Phase 6; Q89 answered: the owner applies production migrations manually; confirm the Supabase command in Phase 1 | Owner, Claude (Phase 1) |
| Q90 backups: deferred by the owner (no backup for now); design 7 §6.7 applies if one is added | Owner, later |
| Enable GitHub secret scanning, push protection and Dependabot alerts (Q87); CodeQL once code exists; read `SKILL.md` and the chosen attack-class files before the first audit run | Claude, at the start of Phase 1 |
| Git: all branches uncommitted or unmerged; commits, pushes and PRs only when the owner asks | Owner |

## 6. History (summary)

- 2026-10-21: process documents copied; interview; PRD v0.5-v0.6; Codex challenge of PRD and plan (7 findings fixed); test-first rule and parallel CI added; incident: a ruflo plugin hook downloaded packages without approval (plan §8.2); ruflo files are git-ignored.
- 2026-10-22: designs 1-3 drafted and reviewed by Codex over several rounds (all findings fixed); Zodiac corrected to the couple's own data; astronomy library vetted and pinned in a local environment; Zodiac artwork sheets approved and 24 per-sign SVGs delivered (technical checks pass; visual banding noted); owner rule: Claude runs Codex reviews and fixes valid findings.
- 2026-10-23: plan and designs 1-3, 5, 6 approved; design 4 reviewed over twelve rounds; repository to become public (Q59), pre-public scan rules in D6 §8; menu redesign; owner comments on the canvas handled.
- 2026-10-24: Codex image host approved (text-only prompts) for the design system; Home, Zodiac approved; Memories, Memory detail and Together designed; art byte targets in the image brief.
- 2026-10-25: project renamed Vegenus; logo packaged under `assets/logo/` (Q60).
- 2026-10-26: guest motion, signature entrances (Q71), Wishes, Leave a wish, Settings and owner area designed; decision boards (Q71-Q74) answered; wordmark font decided (Q76); sign-in redesign with no gate, invite codes, subscribers, owner-access request (Q77-Q81); editable wording (Q82).
- 2026-10-27: owner withdrew the Member request to co-manage the page (Q80; O17, G27, E49 and `access_requests` removed); a multi-tenant "request a workspace" flow is recorded as Q84, deferred and low priority.
- 2026-10-27: per-theme Together falls built; daily-limit notice and wording boards built and reviewed (canvas version 95); Codex consistency review of all 24 documents: nine findings fixed (wish permissions, 24-hour windows, registration retry, wording contract, motion and art rules, Zodiac text, coverage, status summaries); Q78-Q81 answered; this tracker written; edge cases E51-E58 (missing information) added.
- 2026-10-28: owner asked for a security section and a security audit after each phase with direct fixes; Cloudflare `security-audit-skill` README read (read-only); design 7 written; PRD §4.3, §9.3, §10, Q85-Q87, plan §9 and §12.1, design 6 §4.2 updated.
- Canvas: private design canvas "Theme Preview" on the owner's account (not in Git); generators live in the session scratchpad and are not committed.
