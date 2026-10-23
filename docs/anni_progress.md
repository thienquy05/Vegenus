# Progress: anni

Live status only. Decisions and open questions: `docs/anni_PRD.md` §12 (single source). Research and tool findings: `docs/plans/anni_plan.md` §R and §8.

## Status (2026-10-22)
Phase 0 Planning & design. PRD v0.5 and plan v0.3 are written (Codex challenge findings and fixes: plan §11). Design 1 (token flow) and design 2 (screens) are drafts awaiting owner review. No application code. No commits. harness-os not enabled.

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
- [x] 2026-10-22: Zodiac constellation artwork complete: 12 original square SVGs in `assets/zodic-sign/`, explicitly approved by owner for repo storage; source artwork has no personal content. Q39 records the production upload, motion, typography and privacy contract.
- [ ] Zodiac dashboard upload, format handling, private storage and runtime integration (including loading all 12 images together); font selection and browser visual verification pending
- [ ] Owner review of design 1 and design 2; answer Q33–Q35 (PRD §12)
- [ ] Owner gate on plan v0.3 as a whole
- [ ] Design 3 data model (from design 2), then 4 theme system, then 5 3D approach; each with an owner gate
- [ ] Before writing `ci.yml`: verify plan §12.5 facts and approve the pinned action list (rule 1)
- [ ] Before implementation: owner approval for harness-os (commits) and for any login/install/download (rule 1)

## Incidents
- 2026-10-21 21:01: a ruflo plugin hook downloaded `ruflo@latest` (267 packages) into `~/.npm/_npx` without a rule-1 approval. Details and scope proposal: plan §8.2.
- Ruflo runtime files appeared in the repo (`.claude-flow/`, `.swarm/`, `agentdb.rvf*`); all git-ignored.

## Zodiac artwork verification (2026-10-22)
- Branch: `docs/zodiac-sign-assets`, based on `origin/master`.
- RED: pre-copy check failed as expected because the 12 SVG assets were missing.
- GREEN: verified all 12 expected signs, square SVG dimensions, XML safety constraints, manifest checksums and file sizes below 150 KB. Total source bytes: 56,886.
- No tools installed. No application code added. Browser visual verification remains pending (browser launch blocked in this environment).
