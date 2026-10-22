# Progress: anni

Live status only. Decisions and open questions: `docs/anni_PRD.md` §12 (single source). Research and tool findings: `docs/plans/anni_plan.md` §R and §8.

## Status (2026-10-21)
Phase 0 Planning & design. PRD v0.4 and plan v0.2 are written and have been through the Codex adversarial challenge (findings and fixes: plan §11). No application code. No commits. harness-os not enabled. Waiting on the owner gate.

## Done
- [x] Process docs in `docs/process/` (copied unchanged); `CLAUDE.md`, `AGENTS.md`, `.gitignore`
- [x] Owner interview (HARNESS §6); PRD answers Q1–Q28
- [x] Research on approved hosts (read-only)
- [x] Codex adversarial review of PRD + plan (7 findings, all verified, all addressed in the docs)
- [x] Docs consolidated: one place per fact (PRD §12 decisions, plan §R research)

## Next
- [x] Q29–Q32 answered; ruflo local setting applied (`RUFLO_MCP_SKIP_NPX=1` in `.claude/settings.local.json`, git-ignored)
- [ ] Owner gate: review PRD v0.4 and plan v0.2 as a whole
- [ ] Design deliverables, each with an owner gate: sections, NFC flow, data model, theme system, 3D approach
- [ ] Before implementation: owner approval for harness-os (commits) and for any login/install/download (rule 1)

## Incidents
- 2026-10-21 21:01: a ruflo plugin hook downloaded `ruflo@latest` (267 packages) into `~/.npm/_npx` without a rule-1 approval. Details and scope proposal: plan §8.2.
- Ruflo runtime files appeared in the repo (`.claude-flow/`, `.swarm/`, `agentdb.rvf*`); all git-ignored.
