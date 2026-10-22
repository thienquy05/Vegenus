# Progress: anni

Live status only. Decisions and open questions: `docs/anni_PRD.md` §12 (single source). Research and tool findings: `docs/plans/anni_plan.md` §R and §8.

## Status (2026-10-21)
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

## Next
- [ ] Owner review of design 1 and design 2; answer Q33–Q35 (PRD §12)
- [ ] Owner gate on plan v0.3 as a whole
- [ ] Design 3 data model (from design 2), then 4 theme system, then 5 3D approach; each with an owner gate
- [ ] Before writing `ci.yml`: verify plan §12.5 facts and approve the pinned action list (rule 1)
- [ ] Before implementation: owner approval for harness-os (commits) and for any login/install/download (rule 1)

## Incidents
- 2026-10-21 21:01: a ruflo plugin hook downloaded `ruflo@latest` (267 packages) into `~/.npm/_npx` without a rule-1 approval. Details and scope proposal: plan §8.2.
- Ruflo runtime files appeared in the repo (`.claude-flow/`, `.swarm/`, `agentdb.rvf*`); all git-ignored.
