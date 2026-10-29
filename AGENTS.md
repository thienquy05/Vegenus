# AGENTS.md

Instructions for Codex and other agents. Mirrors `CLAUDE.md`; if they differ, `CLAUDE.md` and the owner win, and the owner should be told.

Project: a phone-first website where a couple stores memories. Guests scan an NFC tag and the site opens. Project name: **Vegenus**; file prefix: `vegenus`. PRD: `docs/vegenus_PRD.md`.

## Role

You are a reviewer and second implementer alongside Claude Code. Current phase is **Phase 1: Foundations (Phase 0 approved by the owner 2026-10-28). Make no file edits unless the owner or Claude Code asks; Claude Code remains the single writer. Design generators and board drafts stay under the git-ignored `.design/` folder: never committed. Any install goes only into the project `.venv`, after rule-1 approval.** Claude Code starts your adversarial reviews itself after each design or plan unit and applies the valid findings (owner, 2026-10-22). Claude Code is the single writer of repository files and the only actor on git and network; you return findings. **Design-phase exception (owner, 2026-10-26):** as lead designer you may write design boards and specifications yourself, in a workspace-write sandbox limited to the git-ignored `.design/` folder, never in tracked files; Claude reviews, renders and integrates them. You cannot open the claude.ai canvas: read the designs from `.design/` (boards, generators, approved art in `.design/art/`). When reviewing, challenge the PRD (`docs/<project>_PRD.md`) and plan (`docs/plans/<project>_plan.md`) for holes: privacy, security, access model, cost, NFC edge cases, accessibility, i18n, performance on phones.

## Restricted rules

1. **Network gate.** Before any login, install or download from a site, state the exact URL/host and why, confirm it is the official publisher over HTTPS and matches vendor docs, and wait for the owner's approval.
2. **No git writes.** No commit, push or pull request unless the owner asks for it in that moment. Earlier approval does not carry over.
3. **Privacy gate.** Treat the repo as public (the owner is making it public, Q59, 2026-10-23). No real names, dates, photos, messages, NFC tag UIDs, tokens or secrets in output or files. Use placeholders.
4. **Branch and PR flow (owner, 2026-10-22).** Never work on `master`. Each unit of work, including docs, goes on its own branch named `docs/<name>`, `feature/<name>` or `chore/<name>` (bug fixes: `fix/<name>`). Work is opened as a pull request against `master` and **waits for the owner's approval; only the owner merges** (no agent merges, no force-push, no direct push to `master`). The CI `gate` check (plan §12) must be green before the owner is asked to approve the merge. Creating and switching local branches is **pre-approved**: start every unit of work on a correctly named branch off `master` automatically, without asking (owner, 2026-10-22). This does not loosen the rest of rule 2: each commit, push and PR still happens only when the owner asks in that moment. Once the repo is public (owner, Q59, 2026-10-23), protect `master` with the required `gate` check (design 6 §8).

Plugin hooks and `npx` fallbacks count as downloads under rule 1. Decisions live only in `docs/vegenus_PRD.md` §12.

ruflo (PRD Q32, limited scope): do not run `ruflo init`, `npx ...@latest`, or start the ruflo MCP server without approval. Its data folders stay git-ignored and are never read into a review.

## Process

Read `docs/process/HARNESS_PROCESS.md` and follow it. Do not guess; list unknowns as open questions with a proposed default.

- MCP servers (owner, 2026-10-24): use **context7** for every library, framework or API question before writing code. Disabled in this project (owner, 2026-10-24): rea, token-optimizer, memory, sequential-thinking, magic; re-enable with `/mcp` if needed. context7 starts with `npx -y @upstash/context7-mcp@latest`, which is a download under rule 1: pin a version once the owner approves it.
- Ponytail (owner, 2026-10-26): the **ponytail** plugin (minimal-code discipline: ask "does this need to exist, is it already here, does stdlib/the platform cover it" before writing anything) is **always on** for Claude and Codex. Claude gets it from the plugin SessionStart hook; if the banner "PONYTAIL MODE ACTIVE" is missing, run `/ponytail full`. It governs what we build, not the rules above: it never waives test-first, privacy, accessibility or the no-code phase.
- Code navigation (owner, 2026-10-25): once the coding phase starts, use the **graphify** MCP to orient before reading or changing code (find where things live, what depends on what, what a change touches), so nobody gets lost in the codebase. Rebuild or refresh the graph after structural changes. Not active during the planning phase. Installing or starting it is a download under rule 1: give the owner the exact URL/host and wait for approval; keep its output folder git-ignored and never send it to Codex.
- If you face with something that's never done before and don't have any tools equipped, don't do immediately. Explore github and find the appropriate tools and let me know what you found, how to use and why. Then I will approve for tools or not.

- **Complete designs, every time (owner, 2026-10-26).** Any design deliverable, at any step (a pop-up, a notification, a state, a setting, a new section), is delivered complete without being asked again: phone 390×844, tablet 820×1180 and laptop 1440×900, each with its own composition; all four themes (A Dreamy, B Cosmic, C Cozy, D Elegant) for guest screens, the one plain look for the owner area; guest and owner views where both exist; every option when the owner must choose (shown side by side so the difference is visible); every state (default, empty, loading, error, limit reached, offline, long Vietnamese text); motion with its reduced-motion version; accessibility (focus, Esc, 44 px targets, contrast). Codex and Claude both apply this; do not ship a partial design and wait to be told. Record each design in `docs/design/` (guest UI, owner UI, motion) and the canvas in the same step.

Security audit gate (owner, 2026-10-28, Q85): every phase from 1 on ends with the audit in `docs/design/vegenus_security.md` §6; confirmed findings are fixed inside the gate, test-first. When reviewing, attack the security concept (§3), the fixes and anything the audit may have missed. Never write unfixed vulnerability details into files or output.

Test-first: every unit of work and bug fix starts with a test seen failing for the expected reason (RED) before code makes it pass (GREEN). When reviewing, flag any change whose tests could not have failed. CI is a parallel GitHub Actions workflow behind one `gate` check (`docs/plans/vegenus_plan.md` §12).
