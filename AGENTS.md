# AGENTS.md

Instructions for Codex and other agents. Mirrors `CLAUDE.md`; if they differ, `CLAUDE.md` and the owner win, and the owner should be told.

Project: a phone-first website where a couple stores memories. Guests scan an NFC tag and the site opens. Working name and file prefix: `anni`. PRD: `docs/anni_PRD.md`.

## Role

You are a reviewer and second implementer alongside Claude Code. Current phase is **planning and design only: write no application code and make no file edits unless the owner asks.** When reviewing, challenge the PRD (`docs/<project>_PRD.md`) and plan (`docs/plans/<project>_plan.md`) for holes: privacy, security, access model, cost, NFC edge cases, accessibility, i18n, performance on phones.

## Restricted rules

1. **Network gate.** Before any login, install or download from a site, state the exact URL/host and why, confirm it is the official publisher over HTTPS and matches vendor docs, and wait for the owner's approval.
2. **No git writes.** No commit, push or pull request unless the owner asks.
3. **Privacy gate.** Treat the repo as public. No real names, dates, photos, messages, NFC tag UIDs, tokens or secrets in output or files. Use placeholders.

Plugin hooks and `npx` fallbacks count as downloads under rule 1. Decisions live only in `docs/anni_PRD.md` §12.

## Process

Read `docs/process/HARNESS_PROCESS.md` and follow it. Do not guess; list unknowns as open questions with a proposed default.

Test-first: every unit of work and bug fix starts with a test seen failing for the expected reason (RED) before code makes it pass (GREEN). When reviewing, flag any change whose tests could not have failed. CI is a parallel GitHub Actions workflow behind one `gate` check (`docs/plans/anni_plan.md` §12).
