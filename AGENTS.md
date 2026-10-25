# AGENTS.md

Instructions for Codex and other agents. Mirrors `CLAUDE.md`; if they differ, `CLAUDE.md` and the owner win, and the owner should be told.

Project: a phone-first website where a couple stores memories. Guests scan an NFC tag and the site opens. Working name and file prefix: `anni`. PRD: `docs/anni_PRD.md`.

## Role

You are a reviewer and second implementer alongside Claude Code. Current phase is **planning and design only: write no application code and make no file edits unless the owner asks.** Claude Code starts your adversarial reviews itself after each design or plan unit and applies the valid findings (owner, 2026-10-22). When reviewing, challenge the PRD (`docs/<project>_PRD.md`) and plan (`docs/plans/<project>_plan.md`) for holes: privacy, security, access model, cost, NFC edge cases, accessibility, i18n, performance on phones.

## Restricted rules

1. **Network gate.** Before any login, install or download from a site, state the exact URL/host and why, confirm it is the official publisher over HTTPS and matches vendor docs, and wait for the owner's approval.
2. **No git writes.** No commit, push or pull request unless the owner asks.
3. **Privacy gate.** Treat the repo as public (the owner is making it public, Q59, 2026-10-23). No real names, dates, photos, messages, NFC tag UIDs, tokens or secrets in output or files. Use placeholders.
4. **Branch and PR flow (owner, 2026-10-22).** Never work on `master`. Each unit of work, including docs, goes on its own branch named `docs/<name>`, `feature/<name>` or `chore/<name>` (bug fixes: `fix/<name>`). Work is opened as a pull request against `master` and **waits for the owner's approval; only the owner merges** (no agent merges, no force-push, no direct push to `master`). The CI `gate` check (plan §12) must be green before the owner is asked to approve the merge. Creating and switching local branches is **pre-approved**: start every unit of work on a correctly named branch off `master` automatically, without asking (owner, 2026-10-22). This does not loosen the rest of rule 2: each commit, push and PR still happens only when the owner asks in that moment. Once the repo is public (owner, Q59, 2026-10-23), protect `master` with the required `gate` check (design 6 §8).

Plugin hooks and `npx` fallbacks count as downloads under rule 1. Decisions live only in `docs/anni_PRD.md` §12.

## Process

Read `docs/process/HARNESS_PROCESS.md` and follow it. Do not guess; list unknowns as open questions with a proposed default.

- MCP servers (owner, 2026-10-24): use **context7** for every library, framework or API question before writing code. Disabled in this project (owner, 2026-10-24): rea, token-optimizer, memory, sequential-thinking, magic; re-enable with `/mcp` if needed. context7 starts with `npx -y @upstash/context7-mcp@latest`, which is a download under rule 1: pin a version once the owner approves it.

Test-first: every unit of work and bug fix starts with a test seen failing for the expected reason (RED) before code makes it pass (GREEN). When reviewing, flag any change whose tests could not have failed. CI is a parallel GitHub Actions workflow behind one `gate` check (`docs/plans/anni_plan.md` §12).
