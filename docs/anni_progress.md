# Progress: anni

Live status only. Decisions and open questions: `docs/anni_PRD.md` §12 (single source). Research and tool findings: `docs/plans/anni_plan.md` §R and §8.

## Status (2026-10-22)
Phase 0 Planning & design. PRD v0.6 and plan v0.3 are written (Codex challenge findings and fixes: plan §11). Design 1 (token flow), design 2 (screens) and design 3 (data model) are drafts awaiting owner review. No application code. harness-os not enabled.

## Done
- [x] Process docs in `docs/process/` (copied unchanged); `CLAUDE.md`, `AGENTS.md`, `.gitignore`
- [x] Owner interview (HARNESS §6); PRD answers Q1–Q28
- [x] Research on approved hosts (read-only)
- [x] Codex adversarial review of PRD + plan (7 findings, all verified, all addressed in the docs)
- [x] Docs consolidated: one place per fact (PRD §12 decisions, plan §R research)

- [x] Q29–Q32 answered; ruflo local setting applied (`RUFLO_MCP_SKIP_NPX=1` in `.claude/settings.local.json`, git-ignored)
- [x] Owner: "the PRD looks good" (2026-10-21). Agreed order: system design first, with a low-fidelity screen inventory alongside; visual design last
- [x] Owner rule added: test-first (RED before GREEN) and a parallel CI on GitHub. PRD v0.5 §9.1, plan v0.3 §12, CLAUDE.md, AGENTS.md
- [x] Design 1 draft: `docs/design/anni_token_flow.md` (changes plan §1: the guest cookie carries the token so the database checks it on every call)
- [x] Design 2 draft: `docs/design/anni_screens.md`

- [x] 2026-10-22 owner round: answered Q34 b/c/d (30 days, limits, hidden own message) and Q35 (Google fallback, shared partner login, to confirm); Q33 route accepted. Added deny-by-default (S22, E31-E37), Resend email (S18), guest accounts (S19), tour (S20), Zodiac (S21), Q36-Q41. Updated PRD v0.6, design 1 v0.2, design 2 v0.2, plan. Also added rule 4 (branch + PR + owner merge) to CLAUDE.md and AGENTS.md. No code, no network, no git writes.

## Next
- [x] 2026-10-22: Q35 confirmed (one shared account), Q33 confirmed, Q37 domain deferred by owner
- [x] 2026-10-22: Q38-Q41 approved (guest accounts, Zodiac in galaxy style with owner-drawn characters, tour, auth email after domain)
- [x] 2026-10-22: Q34a (show once), Q36, Q37 docs read, Q20 answered. Codex review of the new designs: PROCEED WITH FIXES; all 7 findings applied (three access contracts `public_*`/`guest_*`/`account_*`, registration hardening, show-once recovery rules, sign vs birthday consent, drift fixes, `master` not `main`)
- [ ] Open: Q16 (tag model), Q37 domain (deferred)
- [x] 2026-10-22: owner pre-approved creating/switching branches (rule 4); commits, pushes and PRs still on request
- [ ] Owner may later replace the built-in Zodiac art through the dashboard. Design 3 §3.3: uploaded art is page media in the private bucket, not committed to Git; budget ≤ 150 KB per image after processing
- [ ] Owner review of design 1 and design 2; answer Q33–Q35 (PRD §12)
- [ ] Owner gate on plan v0.3 as a whole
- [x] 2026-10-22 (branch `docs/data-model`): Design 3 draft `docs/design/anni_data_model.md`. Supersedes plan §4. One `items` table, `page_sections`, composite FKs per page, no `invites`, no birthday column, Zodiac art stored as page media (not in Git), operational tables, access matrix, retention, 20 tests to write first. Added PRD Q42-Q45; O3 gets a time-zone step. Docs only: no tests run (nothing to run yet), no git writes
- [x] 2026-10-22: Q42-Q45 answered (28 Feb; per device + per IP with a guest-visible notice; day 1, hidden until it begins; retention defaults). Written into PRD §12, design 3, G6
- [x] 2026-10-22: Codex challenge of design 3, round 1: needs-attention, 2 findings (rate limits bypassable by direct RPC; concurrent uploads exceed budget). Fixed: design 3 §3.9 trusted write path (`anni_server` role, atomic limits), §3.4 upload reservations
- [x] 2026-10-22: owner corrected Zodiac: it is about the couple's own birth data, guests only view. Rewrote S21, E40, Q39, design 1 §11, design 2 Z1/Z2, design 3 §3.10 (`partner_profiles`, encrypted dates). New Q46-Q49 (research needed)
- [x] 2026-10-22: owner standing rule: Claude runs Codex reviews and fixes findings without asking; summary to owner (CLAUDE.md, AGENTS.md, memory)
- [x] 2026-10-22: Codex rounds 2-6 on design 3, each fixed without asking (owner rule): storage writes only to reserved paths and member table writes only via functions; one charging rule (variants + reservations + undone deletions) with bytes moved in one transaction, including cascade deletes; write fence before freeing a cancelled upload, and never freeing without a verified bound; account writes keep `auth.uid()` with per-account limits. **Round 6 verdict: approve, no material findings.** Phase 2 must verify the storage provider facts marked unverified in design 3 §3.4
- [x] 2026-10-22: Q46-Q49 answered. Q47 decided by Claude at the owner's request: Western + Vietnamese (lunar year from Tết, UTC+7, can chi, mệnh); Q48: research once, store EN/VI reference texts, compose readings (design 3 §3.10-3.11)
- [x] 2026-10-22: owner added birthplace (built-in list) and optional birth time, plus an "event on that day" line (Q50, open). Codex rounds 7-11 fixed: publication snapshot for the couple's Zodiac data; basic vs detailed guest levels (details need opt-in); Tết-boundary warning when basic values narrow the birthday below 14 days. **Round 11: approve**
- [ ] Zodiac research to verify the §3.10 facts, pick the astronomy library and place list (licences), write the reference texts; hosts need rule-1 approval
- [x] 2026-10-22: PR #2 (`docs/zodiac-sign-assets`) read through the GitHub API (owner-approved, read-only) and reviewed by Codex on a local copy: **not ready to merge** (old guest-birthday docs, Western art only, shared SVG ids). SVGs themselves are safe and checksums match
- [x] 2026-10-22: owner: finish the data model, commit, PR to `master` (owner merges). Design 3 marked v1.0. Follow-ups were handed to a new session through a handoff file (removed 2026-10-22 once its items were moved to the list below)
- [x] 2026-10-22 (branch `docs/zodiac-sign-assets-v2`, replaces PR #2 without a force-push, owner's choice): took only `assets/zodiac-sign/` from PR #2 (head `5eb355d`, confirmed through the GitHub API with owner approval; `git fetch` failed for lack of credentials) and dropped its outdated guest-birthday doc edits. Prefixed every SVG id per sign (`aries-title`, `aries-h` …) and their `url(#…)` / `aria-labelledby` references; manifest sizes and checksums updated (58,633 bytes total). README now says "Western set" and lists the 12 Vietnamese animals as required. Design 3 §3.3, Z2, PRD Q39 and plan §12.2 (`privacy-scan` exception limited to manifest files) updated
  - RED: `check_zodiac_svgs.py` (scratchpad, not committed) failed with 115 problems, as expected: 60 ids without the sign prefix and 55 ids repeated across files; safety, size and checksum checks already passed
  - GREEN: same script passes: 12 signs, safe content, unique prefixed ids, all references resolve, manifest matches
  - Owner to close PR #2 once the replacement PR is opened
  - Codex adversarial review of this change: **approve, no material findings**
- [x] 2026-10-22: owner committed work item 1 on `docs/zodiac-sign-assets-v2` (51c4376, ed249cd) and renamed the folder to `assets/zodiac-sign/`; all references updated. Q50 answered (defaults) and worked on the same branch at the owner's request
- [x] 2026-10-22: Zodiac research, first pass (owner-approved hosts, read-only): `assets/zodiac-sign/research.md`. Britannica 403 and Hồ Ngọc Đức's Leipzig pages 404 (not read). Found: pre-1968 Vietnam used UTC+8 for the lunar calendar (new Q51); independent Tết table only 1984-2030 (new Q52); nạp âm table, cycles, sun-sign table, ascendant formula, pillar rules; branch relations only partly verified. Q50 design: `zodiac_ref_day_events` reference table (CC BY-SA, attributed), per-language `birthday_event_ref_en`/`_vi` with attribution copied into the published snapshot, Z1 suggestions. Codex: 3 rounds (1985 example contradicted the month-11 rule, now unverified; attribution not in the snapshot; one ref for two languages), all fixed; **round 3 approve**
- [x] 2026-10-22: owner gave the real birth data for testing; kept briefly in a mode-600 file outside the repo, never in Git or Codex; **deleted 2026-10-22 at the owner's request** (real data will be entered only in the website, Z1). Sample date pages showed no suitable same-year event for either date, which confirms the Q50 fallback design
- [x] 2026-10-22: Q51 and Q52 answered (defaults). Owner gave general read-only approval (no installs). Second research pass: Astronomy Engine (MIT), GeoNames (CC BY 4.0), IANA Vietnam zone (verbatim; South-based, `Asia/Hanoi` only in backzone), HKO tables give independent Tết 1920-1967; tam hợp and tứ hành xung confirmed. Sun-sign rule changed: compute the Sun's longitude, not a fixed table (19 Feb is Pisces in some years, Aquarius in part of others); a standard-library Meeus script agrees with three published Pisces entry times (two to the minute from search summaries, one only to the hour); full validation of all 12 boundaries is a Phase 1 test
- [x] 2026-10-22: owner clarified Q50: the "event" is the sky at birth (Moon phase, planets, sky events), ideally in 3D. Encyclopedia design withdrawn (no `zodiac_ref_day_events`, no Wikipedia data or licence); new `birth_sky` (computed at save, detailed level only), `zodiac_ref_sky`, `zodiac_ref_meteor_showers`, event rules in design 3 §3.11; research §5 rewritten (library functions, meteor-shower list)
  - Codex: 2 more rounds. Found: the ingress check was overstated (2020 only to the hour) and Q52 wording was stale; both fixed. Q50 sky redesign: **approve, no material findings**
- [x] 2026-10-22: owner approved installing the astronomy library "if safe". Vetted (MIT, no dependencies, no install scripts, signed by the registry, publisher matches GitHub) and installed pinned 2.1.19 in a scratch folder outside the repo, scripts disabled. Research checks: Tết rules reproduce all 111 reference rows (64 HKO 1920-1983 in UTC+8, 47 Vietnamese 1984-2030 in UTC+7); UTC+7 1968-1983 still uncompared. Codex: 1 finding (the 111 total was not broken down by source and offset), fixed; **approve**; sign-entry ranges for all 12 signs 1920-2030; Moon phases agree. Research §7
- [ ] Open: Tết 1968-1983 for UTC+7 (computed, no online source to compare); lục hợp and lục hại source; design 5 (3D) takes the sky at birth as its centrepiece, with a 2D fallback
- [x] 2026-10-22: owner-approved Vietnamese and Western celestial artwork source sheets (Codex, commit 3a450cf), moved into `assets/zodiac-sign/western/`, `vietnamese/` with `source-sheets.json` and `source-sheets.md` so the art lives in one folder
- [x] 2026-10-22: owner removed the legacy constellation SVGs and `manifest.json` (in Git history, `ed249cd`); README rewritten for the final layout
- [ ] Per-sign SVGs from the approved sheets: 24 safe square SVGs plus a manifest per folder (rules in `assets/zodiac-sign/README.md`); owner runs the Codex prompt
- [ ] Kept for Phase 2, not now: storage facts marked unverified in design 3 §3.4 and the `anni_server` connection method in §3.9
- [ ] Owner review of design 3
- [ ] Then design 4 theme system, then 5 3D approach; each with an owner gate
- [ ] Before writing `ci.yml`: verify plan §12.5 facts and approve the pinned action list (rule 1)
- [ ] Before implementation: owner approval for harness-os (commits) and for any login/install/download (rule 1)

## Incidents
- 2026-10-21 21:01: a ruflo plugin hook downloaded `ruflo@latest` (267 packages) into `~/.npm/_npx` without a rule-1 approval. Details and scope proposal: plan §8.2.
- Ruflo runtime files appeared in the repo (`.claude-flow/`, `.swarm/`, `agentdb.rvf*`); all git-ignored.

## Approved celestial artwork delivery

- Owner approved the final blue Western and Vietnamese linh vật collections and requested upload to `docs/zodiac-sign-assets-v2`.
- Delivered `western/approved-atlas.png`, `vietnamese/approved-atlas.png`, checksums/sign-order manifest and handoff README (first in a top-level `zodiac-sign/`; moved into `assets/zodiac-sign/` the same day). (The earlier Western SVG defaults were later removed at the owner's request.)
- Current couple-only Zodiac model and publication/privacy rules are unchanged. No guest birthday form or runtime switching implementation was added.
- RED: pre-upload branch inventory was missing both approved images and the new manifest, as expected. GREEN: both images decode, dimensions and exact-byte hashes match the manifest, and remote tree/blob identities are verified after upload.
- Artwork/source-sheet delivery is done; individual square optimized images, any required editable vectors, font selection and runtime integration remain pending. Full source sheets are not website payloads and exceed the per-image production budget.

## Per-sign Zodiac SVG extraction — visual approval pending

- On `docs/zodiac-sign-assets-v2`, created 12 Western SVGs, 12 Vietnamese SVGs and a manifest per set under `assets/zodiac-sign/`. Paths contain true vector contours from the approved figures, with no embedded raster.
- RED before creating outputs: the temporary checker failed with 26 issues (24 missing SVGs and 2 missing manifests), on the requested branch.
- GREEN: all 24 names, XML, square viewBox/dimensions, prohibited elements/attributes/URIs, prefixed IDs, local references, manifest bytes/gzip sizes/checksums and the 150,000-byte ceiling passed. Total uncompressed SVG bytes: 3,252,094.
- Rendered every SVG with the installed Inkscape and checked 400 × 400 output and transparent corners. Reviewed two source-versus-vector contact sheets and enlarged difficult figures; these review artifacts and the checker are outside the repo.
- Finite-palette tracing has visible tonal banding compared with raster source shading, particularly for Vietnamese figures; owner visual approval is pending. Technical GREEN does not approve visual fidelity.
- The two approved PNGs and `source-sheets.json` are byte-for-byte unchanged. No installation, application code, authored commit or push. Branch retrieval was explicitly approved by the owner; the existing remote snapshot was imported via the GitHub connector because shell fetching could not reach its proxy.
