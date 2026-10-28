# Progress: Vegenus

Live status and the implementation tracker. Decisions and open questions: [PRD](vegenus_PRD.md) §12 (single source). Research: [plan](plans/vegenus_plan.md) §R. Phases, exit criteria and gates: PRD §10. Edge-case catalog: PRD §9.2. Acceptance checklist: PRD §9.3. Definition of Done: PRD §1.6. The round-by-round history that used to fill this file is in Git (commit history of this file); only live status and a short summary are kept.

Update this file after every step. Rule: a task is Done only when its test was seen failing (RED), then passing (GREEN), CI `gate` is green, and the evidence line is filled.

## 1. Status (2026-10-28)

- **Phase 0 is done: the owner approved the PRD, the plan and all designs on 2026-10-28.** Phase 1 in progress: T1.1 (CI walking skeleton) is RED locally on branch `feature/ci-walking-skeleton`, waiting for the owner's push to show it red on GitHub. harness-os is not enabled (enable only with the owner's OK, it commits).
- Approved by the owner: PRD v0.7, plan v0.4, designs 1-7, guest UI, owner UI, guest motion and editable wording (2026-10-28); earlier: designs 1, 2, 3, 5, 6 (2026-10-23), logo (Q60), Home and Zodiac (2026-10-24).
- Open decisions: none blocking Phase 1. Q16 (NFC tag model) and Q37 (sending domain) are parked by the owner until the final phase. Answered 2026-10-28: Q66 (album limits approved as proposed), Q70 (shortlist 01, 02, 04; owner leans to 04; final choice in Phase 4 on the running app), Q92 (Together phone pins may overlap; zoom or the chip list), Q91 (the 24 approved Codex sign renders ship as the built-in Zodiac art). Deferred by the owner: co-editor role (Q35) and multi-tenant workspace requests (Q84, low priority).
- Answered 2026-10-27: Q78 (per-IP wish limit 20 per rolling 24 h), Q79 (two tiers: Owner and Member), Q80 (withdrawn the same day: no Member request to co-manage; see Q84), Q81 (defaults kept).
- Canvas (Theme Preview, version 99): page 15 "Account and invites" holds G20-G26 (12 boards) and O16 (3 boards), approved by the owner 2026-10-28. Page 16 "Section navigation (decide)" holds the Q70 comparison boards; the choice is made in Phase 4 (PRD Q70). Sources and generators: `.design/g20-o16/`, `.design/q70/`. Checked in a browser: no overflow, 44 px targets, keyboard focus and Esc, every screen and state.
- Wording boards, locally prepared versus live canvas (reported by the 2026-10-27 review; the original handoff entry, including Q83, was overwritten when this file was rewritten and its text is not in the repository): 63 boards completed locally, with 169 source and state checks and 432 browser cases passing. They are not yet on the live canvas; sync them when the wording review resumes (housekeeping, does not block Phase 1). Editable wording §6 describes the live canvas. Q83 was re-entered in the PRD on 2026-10-27 from the review's quotation; the originating session should confirm the wording.
- Documentation consistency review of 2026-10-27 is closed (section 6).
- Security review follow-up: five source-level design gaps have proposed documentation fixes (Auth cleanup, invite deadlines, digest dispatch, mailbox-holder consent, UTF-8 byte caps). These contracts and their tests are specified, not implemented or runtime-validated. The G24 confirmation consent preview is complete (canvas page 15, approved 2026-10-28).
- Security (2026-10-28): design 7 `docs/design/vegenus_security.md` adds the security concept, tool selection and a per-phase audit gate (Q85, answered). The Cloudflare `security-audit` skill is installed at project level in `.claude/skills/` (git-ignored, pinned; Q86 answered); GitHub secret scanning and push protection were turned on at the owner's request on 2026-10-28 (read back from the API); Dependabot alerts are to be enabled at the start of Phase 1 and CodeQL once code exists (Q87 answered). The Phase 0 gate (adversarial review of design 7) has passed.

## 2. How to read the tracker

Status values: **Not started** · **Specified** (test row exists in a design document) · **RED** (test written and seen failing, evidence recorded) · **GREEN** (passes) · **Reviewed** (Codex review done) · **Done** (GREEN + CI `gate` green + evidence + gate passed).

Test levels: Unit, DB (SQL against a local database), API, E2E (Playwright, phone viewport), Manual (real devices), CI.

Spec column: D1 token flow §8, D2 screens (flows), D3 data model §9, D4 theme system, D5 3D approach §11, D6 CI spec, D7 security, Motion = guest motion §9.

"Missing information" rows (E51-E58) are edge cases where the data, record or language does not exist; they are required tasks like every other row.

## 3. Phase tracker (PRD §10)

### Phase 0: Planning and design (weeks 1-2)

Exit criterion (PRD §10): the owner approves each deliverable. Gate: owner review after the PRD, after the Codex challenge and after each design deliverable.

| Deliverable | Status |
|---|---|
| PRD v0.6 | Done (owner approved) |
| PRD v0.7 (v0.6 plus the §12 entries Q42-Q92) | Done (owner approved 2026-10-28) |
| Codex challenge of PRD and plan (7 findings, all addressed) | Done |
| Plan v0.3 | Done (owner approved 2026-10-23) |
| Plan v0.4 (guest-access and wording changes) | Done (owner approved 2026-10-28) |
| Design 1 token flow, 2 screens, 3 data model | Done (approved 2026-10-23; later revisions Q77-Q82 approved 2026-10-28) |
| Design 4 theme system | Done (owner approved 2026-10-28) |
| Design 5 3D approach | Done (approved 2026-10-23); motion supplement approved 2026-10-28 |
| Design 6 CI spec | Done (approved 2026-10-23) |
| Design 7 security concept and audit gate (Phase 0 gate = adversarial review of it) | Done (v0.2; Phase 0 gate passed; owner approved 2026-10-28) |
| Guest UI, owner UI, guest motion, editable wording | Done (owner approved 2026-10-28) |
| Canvas boards for every screen, size, theme and state (CLAUDE.md complete-designs rule) | Done: G20-G26 and O16 approved 2026-10-28; Q70 shortlist on the canvas, decided in Phase 4 |

Edge-case tasks in this phase: every row E1-E58 has a designed behaviour and a test row in a design document (section 3 "Spec" columns). A row without a test row is a Phase 0 defect. Current count without a test row: 0.

**Phase 0 signed off by the owner 2026-10-28.** Carried forward: Q16 and Q37 parked until the final phase; Q70 decided in Phase 4; sync of the 63 local wording boards to the canvas.

### Phase 1: Foundations (weeks 3-4)

Content: skeleton, auth, tenancy, visibility, token, privacy rules, CI. First unit: the CI walking skeleton (plan §12.4: a failing test, a push that shows CI red, then green). Exit criterion: visibility, token and isolation tests green. Gate: owner OK before enabling harness-os or any spend. Status: Not started.

Security gate (design 7 §6, Q85): Not started. Pass criteria: no open critical or high finding, mediums fixed or accepted, every `needs_validation` resolved or explicitly accepted in PRD §12, Codex security review clean, audit run complete (`run_status` not incomplete, validators pass), all on one recorded `master` SHA.

| Task | Test first | Status |
|---|---|---|
| T1.1 CI skeleton with the `gate` check (D6) | one failing test shown red on GitHub, then green | RED (local, 2026-10-28; see T1.1 evidence below) |
| T1.2 Route table and deny-by-default checks | crawler test, build fails on an unclassified route | Not started |
| T1.3 Supabase project, RLS on every table, `guest_*` and `public_*` read functions with the `page_is_live` guard (`pages.copy_published_at` exists from Phase 1; test fixtures set it directly, seeding and acceptance come with T2.7), `vegenus_server` role. `account_*` functions come with their tables in T3.6 (D3 §3.6) | schema lint and anon-role tests (D3 §9) | Not started |
| T1.4 Owner auth (closed registration, Google for pre-created accounts) | E22, E25, E29, E33-E35 | Not started |
| T1.5 Pages, sections, guest token (hash, fragment, cookie, rotation), visibility, publication status | E3-E6, E21, E27, E28, E30 | Not started |
| T1.6 Privacy scan job | seed and repo contain only placeholders | Not started |

T1.1 evidence:

- Versions (exact, `package-lock.json`): next 16.4.3, react 19.3.1, typescript 6.0.3 (7.0 is outside typescript-eslint's `<6.1.0` range), eslint 10.13.0, vitest 5.0.5, @playwright/test 1.64.1, @axe-core/playwright 4.14.0, @lhci/cli 0.15.1, supabase 2.122.0. `npm audit --omit=dev`: 0 advisories; dev tools carry 13 high advisories, outside the CI rule.
- Gate rule (`scripts/gate_test.sh`, 14 cases of D6 §10): RED with the stub rule `true` (11 should-fail cases passed); GREEN with `scripts/gate.jq`.
- Focused-test ban (`scripts/no-focused-tests.sh`) and docs-reference check (`scripts/no-docs-refs.sh`): each fails on a fixture with the offending line and passes on clean input.
- Unit, RED: `npx vitest run` fails `src/lib/site.test.ts` with `Cannot find module './site'`; `tsc --noEmit` fails with TS2307 for the same import. GREEN (checked locally, then removed again for the red push): `src/lib/site.ts` exporting `SITE_NAME`.
- DB, RED: `supabase test db` failed test 2 (`has_schema` on a schema that does not exist); GREEN with `has_schema('public')`.
- E2E and a11y (Chromium Pixel 7, WebKit iPhone 15, production build): axe found `document-title` (serious) on the first run; fixed with page metadata; 3 of 3 pass. Lighthouse: FCP ≤ 3 s and total bytes ≤ 3 MB pass; a 1-byte budget fails as expected.
- Placeholders in CI until their units: `privacy-scan` (T1.6), route-table check (T1.2), Supabase in `e2e` (first unit that reads from it), `red-proof` (advisory, later).
- Open: Dependabot alerts (Q87) are not on yet (the agent's settings call was blocked; the owner turns them on); required `gate` check on `master` after the first green run.

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
| E29 | Attacker registers the owner account's email first | Registration closed | API | D3 | Specified |
| E30 | In-app browser drops fragment or cookies | Works in memory or shows "open in your browser" | E2E | D1 | Specified |
| E31 | Unauthenticated request to owner route or token route | Allowed result only | API (crawler) | D1 | Specified |
| E32 | New route without an access rule | Build and CI fail | CI | D1 | Specified |
| E33 | Member or other-page user attempts an owner action | Refused by RLS and handler (the Member case is added with the account tables in T3.6) | API + DB | D1, D3 | Specified |
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

Content: four token sets, scene presets, per-section scenes, fallbacks, menu, signature entrances, connected backgrounds, section transitions (Q70: build 01, 02 and 04 switchable; the owner chooses on real devices; remove the other two). Exit criterion: performance and accessibility checks pass. Gate: owner review per theme. Status: Not started.

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
| Repository public since 2026-10-25 (Q59). Checked 2026-10-28 (read-only API): this checkout commits with the GitHub `noreply` address; `master` has an active ruleset (pull request required, no deletion, no force-push) but no required `gate` check yet; secret scanning and push protection were **off** and were turned **on** on 2026-10-28 (owner request, read back from the API) | Owner: confirm the GitHub email setting "block command line pushes that expose my email" (not readable by the API); add `gate` as a required check in T1.1 |
| Git (2026-10-28): the 11 merged local branches were deleted at the owner's request | Done |
| Q91 answered: the 24 approved sign renders ship. Integration (T3.9) follows design 6 §8: first a PR with `assets/zodiac-sign/renders.json`, the allowlist and `privacy-scan` extension (plan §12.2) and exact-file `.gitignore` exceptions reaches `master`; then the files are added | Claude, T3.9 (each push needs the owner's OK, rule 2) |
| Design workspace (done 2026-10-28): the git-ignored `.design/` holds `art/` (the 42 approved WebPs from the canvas and the Home run, named, with `SHA256SUMS`) and `archive/` (a full copy of the earlier session scratchpads: generators, board drafts including the 63 locally prepared wording boards, Codex logs). New generators and Codex design output go to `.design/` (CLAUDE.md, AGENTS.md); the canvas stays the owner's review surface | Claude: sync the 63 wording boards to the canvas when the wording review resumes |
| Q88 answered: owner turns on the Vercel promotion hold and Deployment Protection at Phase 6; Q89 answered: the owner applies production migrations manually; confirm the Supabase command in Phase 1 | Owner, Claude (Phase 1) |
| Q90 backups: deferred by the owner (no backup for now); design 7 §6.7 applies if one is added | Owner, later |
| Enable Dependabot alerts (Q87; secret scanning and push protection are already on); CodeQL once code exists; read `SKILL.md` and the chosen attack-class files before the first audit run | Claude, at the start of Phase 1 |
| Git: every earlier branch is merged into `master` (PRs up to #18) and deleted locally and on GitHub. Commits, pushes and PRs only when the owner asks | Owner: consider "Automatically delete head branches" in GitHub |

### 5.1 Facts to verify before building (from the designs)

One list of the **unverified** facts that block a build step, so Phase 1 does not start by hunting through ten documents. Each source document stays the owner of its fact; tick a row here and record the answer in the source.

| Needed by | Fact to verify | Source |
|---|---|---|
| ~~T1.1 (CI, first app)~~ | Done 2026-10-28: Next.js 16.4.3 (React 19.3.1). context7 was unreachable; versions and peer ranges read from the npm registry and the installed packages. i18n library deferred to the first unit that needs translations | plan §2; D6 §2, §5.1 |
| T1.1 (CI) | Done locally 2026-10-28: Supabase CLI 2.122.0 (npm package ships the binary, no extra host); the §4 exclude list is valid and the db tests pass with it (the CLI still pulls `realtime` while it sets up the schema); action SHAs unchanged from §7, inputs read from each `action.yml`; local hosts: `registry.npmjs.org`, `cdn.playwright.dev`, `public.ecr.aws`; npm cache in `.npm-cache/`, browsers in `node_modules/`. Still open: the hosts the runner contacts and minutes per job, from the first GitHub run | D6 §4, §5.1, §7, §7.1 |
| T1.3 (database) | How the server connects as `vegenus_server` (pooler login or signed token); if neither works, guest writes wait for an owner decision, never the service role (D3 §3.9); pgTAP through the Supabase CLI; the Supabase security-advisor command | D3 §3.9, §9; D7 §8 |
| T1.3, Q89 | Command and connection for applying migrations to production by hand | D7 §6.5 rule 4, §8 |
| T1.4 (auth) | `auth.admin.createUser` with a confirmed email, a chosen user id and a password, else the SMTP fallback; breached-password check availability | D1 §10.3 |
| T1.5 (headers) | HSTS on `*.vercel.app` | D7 §3 |
| T1.5 (E30) | URL fragment and cookies in Zalo, Facebook and Messenger browsers: E2E behaviour in T1.5, confirmed on real devices in T3.5 | plan §1; D1 §4 |
| Phase 1 audit | Whether the Cloudflare skill selects attack classes by option or by prompt | D7 §5 |
| T2.3 (uploads) | Bucket-level size limits; whether a storage policy sees object size at insert; maximum duration of an accepted upload (the write-fence `drain`); reading object sizes from the storage schema; reading egress usage on the free plan | D3 §3.4 |
| T3.5 (NFC), Q16 | Tag model and capacity; NDEF URI prefix code; iPhone background tag reading | D1 §3; plan §5, §R |
| T3.9 (Zodiac) | Install approval for the vetted astronomy library (rule 1); the birthplace list's source and licence; historical UTC offsets per place (IANA); Tết 1968-1983 in UTC+7 cross-check (Q52); a readable source for lục hợp and lục hại before they become seed data; the library's ascendant / sidereal-time API | D3 §3.10-§3.11; `assets/zodiac-sign/research.md` §2, §3, §7; plan §R |
| T3.10 (email), Q37 | Resend sending without a domain; `List-Unsubscribe` header support | plan §R; D1 §10.5 |
| Phase 6, Q88 | Turning off Auto-assign Custom Production Domains on Hobby; GitHub private security-advisory fork for embargoed fixes | D7 §6.5, §6.6 |
| If media moves to R2 | Whether R2 needs a payment method | plan §3 |

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
- 2026-10-28: production-readiness review of every document: statuses synced (PRD v0.7, plan, designs 1, 2, 3, 7), stale references fixed (repo visibility, development machine, withdrawn O17 and owner-access request, tour step count, Zodiac SVG status, cron fact), the route class for the owner account renamed `owner` so it no longer collides with "Member", Q91 raised, the build-blocking unverified facts gathered in §5.1, live GitHub settings checked (read-only). Codex adversarial review: round 1 six findings, all fixed (service-role fallback removed from design 3 §3.9, Phase 1 schema scope, Member access on Token-only pages, video media variant, register order, PRD status wording); round 2 approved with no findings. Owner answers the same day: Q91 (the 24 sign renders ship); the design working set moved from temporary scratchpads into the git-ignored `.design/` (approved art fetched from the canvas by asset id, mapped to signs from the canvas boards); merged local branches deleted. Codex round 3 found two conflicts introduced by those changes (the no-code rule versus generators in `.design/`; the WebP renders versus the binary gates), fixed with one narrow exception in CLAUDE.md and AGENTS.md and the `renders.json` manifest rule in design 6 §8; round 4 approved with no findings.
- Canvas: private design canvas "Theme Preview" on the owner's account (not in Git); generators, board drafts and approved art live in the git-ignored `.design/` folder and are not committed.
