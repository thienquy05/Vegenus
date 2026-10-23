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
- [x] 2026-10-22 (branch `docs/zodiac-sign-assets-v2`, replaces PR #2 without a force-push, owner's choice): took only `assets/zodic-sign/` from PR #2 (head `5eb355d`, confirmed through the GitHub API with owner approval; `git fetch` failed for lack of credentials) and dropped its outdated guest-birthday doc edits. Prefixed every SVG id per sign (`aries-title`, `aries-h` …) and their `url(#…)` / `aria-labelledby` references; manifest sizes and checksums updated (58,633 bytes total). README now says "Western set" and lists the 12 Vietnamese animals as required. Design 3 §3.3, Z2, PRD Q39 and plan §12.2 (`privacy-scan` exception limited to manifest files) updated
  - RED: `check_zodiac_svgs.py` (scratchpad, not committed) failed with 115 problems, as expected: 60 ids without the sign prefix and 55 ids repeated across files; safety, size and checksum checks already passed
  - GREEN: same script passes: 12 signs, safe content, unique prefixed ids, all references resolve, manifest matches
  - Owner to close PR #2 once the replacement PR is opened
  - Codex adversarial review of this change: **approve, no material findings**
- [ ] Q50 (event on the birthday): ask the owner where suggestions come from and whether guests may see the line
- [ ] Zodiac research (design 3 §3.10-3.11): list exact hosts first and wait for approval (proposed `www.informatik.uni-leipzig.de`, `en.wikipedia.org`, `vi.wikipedia.org`). Verify the UTC+7 new-moon and solar-term method plus an independent Tết table (1920-2030, including years where Vietnam and China differ); Vietnam's historical UTC offsets in the IANA database; Western sign boundaries, cusps, Moon and ascendant; an offline astronomy library with a fitting licence (install needs rule 1); the birthplace list's source and licence; nạp âm, branch relations and element cycles. Then write our own EN/VI reference texts with sources, labelled "for fun / theo quan niệm dân gian"
- [ ] Vietnamese animal artwork: 12 square transparent SVGs in the same style, prefixed ids, same safety checks, own manifest
- [ ] Kept for Phase 2, not now: storage facts marked unverified in design 3 §3.4 and the `anni_server` connection method in §3.9
- [ ] Owner review of design 3
- [ ] Then design 4 theme system, then 5 3D approach; each with an owner gate
- [ ] Before writing `ci.yml`: verify plan §12.5 facts and approve the pinned action list (rule 1)
- [ ] Before implementation: owner approval for harness-os (commits) and for any login/install/download (rule 1)

## Incidents
- 2026-10-21 21:01: a ruflo plugin hook downloaded `ruflo@latest` (267 packages) into `~/.npm/_npx` without a rule-1 approval. Details and scope proposal: plan §8.2.
- Ruflo runtime files appeared in the repo (`.claude-flow/`, `.swarm/`, `agentdb.rvf*`); all git-ignored.
