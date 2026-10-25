# CLAUDE.md

Project: a phone-first website where a couple stores memories. Guests scan an NFC tag and the site opens. Project name: **Vegenus**; file prefix: `vegenus` (owner renamed the repository to Vegenus). PRD: `docs/vegenus_PRD.md`.

Partner agent: Codex (plugin installed, signed in). Codex reads `AGENTS.md`; keep it in sync with this file. Process: `docs/process/HARNESS_PROCESS.md` (copied unchanged). PRD template: `docs/process/PRD_TEMPLATE.md` (written for research/ML, so drop sections that do not apply to a website).

## Current phase

Planning and design only. **No code of any kind in the repo** (application code, scripts, generators) until the owner approves the PRD, the plan and **all design previews** (owner, 2026-10-24). Docs, `.gitignore` and design notes are allowed; designs are drawn directly in the preview canvas. Helper scripts live in the session scratchpad, never in the repo.

**Installs only into the project `.venv`** (owner, 2026-10-24): any package Claude or Codex needs goes into `./.venv` (git-ignored), never system-wide or into another folder, and still needs rule 1 approval.

## Restricted rules (always apply, to Claude and to Codex)

1. **Network gate.** Before any login, install or download from a site: tell the owner the exact URL/host, validate it (official publisher, HTTPS, matches the vendor's own docs), and wait for approval. No exceptions, including package installs, CLI logins and dashboard sign-ins.
2. **No git writes unless asked.** No commit, push or pull request unless the owner asks for it in that moment. Earlier approval does not carry over.
3. **Privacy gate.** Treat the repo as public (the owner is making it public, Q59, 2026-10-23). Real names, dates, photos, messages, NFC tag UIDs, tokens and anything sensitive stay out of Git, docs, chats and other tools. Use placeholders (`[PARTNER_A]`, `[DATE]`, `placeholder.jpg`). Sensitive material goes in `.gitignore`. Check text for this before it leaves the machine, including anything sent to Codex.
4. **Branch and PR flow (owner, 2026-10-22).** Never work on `master`. Each unit of work, including docs, goes on its own branch named `docs/<name>`, `feature/<name>` or `chore/<name>` (bug fixes: `fix/<name>`). Work is opened as a pull request against `master` and **waits for the owner's approval; only the owner merges** (no agent merges, no force-push, no direct push to `master`). The CI `gate` check (plan §12) must be green before the owner is asked to approve the merge. Creating and switching local branches is **pre-approved**: start every unit of work on a correctly named branch off `master` automatically, without asking (owner, 2026-10-22). This does not loosen the rest of rule 2: each commit, push and PR still happens only when the owner asks in that moment. Once the repo is public (owner, Q59, 2026-10-23), protect `master` with the required `gate` check (design 6 §8).

## Working agreement

- Ask the owner when unsure. Never guess or assume. Unresolved points go to the PRD open-questions table with status and default, and a note on who answered what.
- Follow `docs/process/HARNESS_PROCESS.md`: interview (§6) -> PRD -> owner review -> plan -> challenge the plan -> implement in small steps with a verification loop -> review -> finalize.
- Files: `docs/<project>_PRD.md`, `docs/plans/<project>_plan.md`, `docs/<project>_progress.md`. Keep the progress file current after every step.
- Challenge step (harness step 5): `/codex:adversarial-review` on the PRD and plan, only on privacy-gated (placeholder) text.
- harness-os governance (`harness init`) writes `.claude/` and makes a commit. Do not run it without asking the owner first and saying it commits.
- Test-first (owner, 2026-10-21): every unit of work and every bug fix starts with a test that is run and seen failing for the expected reason (RED), then the code makes it pass (GREEN). Record the RED run in the progress file. CI is a parallel GitHub Actions workflow behind one `gate` check (plan §12).
- Frontend verification, once code exists: Playwright MCP. Look at what renders, check the console and key flows on a phone-sized viewport.

## Tools and orchestration

- harness-os: governance gates per unit of work, enabled only after PRD and plan approval (it commits, so ask first).
- ruflo: orchestration helper, limited scope approved by the owner (PRD Q32). Plugin hooks and `npx` fallbacks count as downloads under rule 1: do not run `ruflo init`, `npx ...@latest`, or start the ruflo MCP server without approval. Its data folders stay git-ignored and are never sent to Codex.
- Codex: independent review via `/codex:adversarial-review`. **Standing rule (owner, 2026-10-22): Claude runs the Codex review itself after each design or plan unit, fixes every valid finding without asking, and gives the owner a summary (what, why, how).** Rules 1-4 still apply: the privacy gate before anything goes to Codex, and no git writes unless asked.
- Claude Code is the single writer of files and the only actor on git and network; other agents return findings.
- MCP servers (owner, 2026-10-24): use **context7** for every library, framework or API question before writing code. Disabled in this project (owner, 2026-10-24): rea, token-optimizer, memory, sequential-thinking, magic; re-enable with `/mcp` if needed. context7 starts with `npx -y @upstash/context7-mcp@latest`, which is a download under rule 1: pin a version once the owner approves it.
- Code navigation (owner, 2026-10-25): once the coding phase starts, use the **graphify** MCP to orient before reading or changing code (find where things live, what depends on what, what a change touches), so nobody gets lost in the codebase. Rebuild or refresh the graph after structural changes. Not active during the planning phase. Installing or starting it is a download under rule 1: give the owner the exact URL/host and wait for approval; keep its output folder git-ignored and never send it to Codex.

## Decisions and open questions

Single source: `docs/vegenus_PRD.md` §12. Research facts: `docs/plans/vegenus_plan.md` §R. Do not restate them here.
