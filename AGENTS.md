# AGENTS.md

Single source of the project rules, loaded by every agent: Claude Code through `CLAUDE.md` (`@AGENTS.md`), Codex directly. Edit this file only; `CLAUDE.md` adds nothing to it. Earlier documents cite these rules as "CLAUDE.md rule N"; the numbering below is unchanged.

Project: a phone-first website where a couple stores memories. Guests scan an NFC tag and the site opens. Project name: **Vegenus**; file prefix: `vegenus` (owner renamed the repository to Vegenus). PRD: `docs/vegenus_PRD.md`.

Process: `docs/process/HARNESS_PROCESS.md` (copied unchanged). PRD template: `docs/process/PRD_TEMPLATE.md` (written for research/ML, so drop sections that do not apply to a website). Review and model routing: `docs/process/REVIEW.md`.

## Roles

- The **owner** decides scope, approves every gate and is the only one who merges.
- **Claude Code** is the single writer of repository files and the only actor on git and network; other agents return findings. Claude starts the Codex reviews itself (see Tools).
- **Codex** (plugin installed, signed in) is a reviewer and second implementer alongside Claude Code. It makes no file edits unless the owner or Claude Code asks. **Design-phase exception (owner, 2026-10-26):** as lead designer Codex may write design boards and specifications in a workspace-write sandbox limited to the git-ignored `.design/` folder, never in tracked files, with privacy-gated input; Claude reviews, renders (Playwright), publishes the canvas and writes the repo docs. Codex cannot open the claude.ai canvas: it reads designs from `.design/` (boards, generators, approved art in `.design/art/`). Any install by Codex goes only into the project `.venv`, after rule 1 approval.
- When reviewing the PRD (`docs/vegenus_PRD.md`) and plan (`docs/plans/vegenus_plan.md`), challenge them for holes: privacy, security, access model, cost, NFC edge cases, accessibility, i18n, performance on phones.
- Code is reviewed by a fresh-context reviewer, never by the agent that wrote the change (`docs/process/REVIEW.md`).

## Current phase

**Phase 2: Owner tools.** The owner approved Phase 1 on 2026-10-30 (security gate passed on `master` `a82c5aa`; Phase 0 approved 2026-10-28). Application code is written test-first, one unit per branch, following the plan and `docs/vegenus_progress.md` (first unit: T2.1 setup wizard). Designs are still drawn in the preview canvas. **Design helpers (owner, 2026-10-28):** local design helper scripts, generators and board drafts may exist only under the git-ignored `.design/` folder; they are never committed, and no application code is written anywhere (session scratchpads are cleared by macOS, so `.design/` replaces them). The canvas stays where the owner reviews designs; `.design/` is the local copy that Codex can read.

**Installs only into the project `.venv`** (owner, 2026-10-24): any package Claude or Codex needs goes into `./.venv` (git-ignored), never system-wide or into another folder, and still needs rule 1 approval.

## Restricted rules (always apply, to Claude and to Codex)

1. **Network gate.** Before any login, install or download from a site: tell the owner the exact URL/host, validate it (official publisher, HTTPS, matches the vendor's own docs), and wait for approval. No exceptions, including package installs, CLI logins and dashboard sign-ins.
2. **No git writes unless asked.** No commit, push or pull request unless the owner asks for it in that moment. Earlier approval does not carry over.
3. **Privacy gate.** Treat the repo as public (the owner is making it public, Q59, 2026-10-23). Real names, dates, photos, messages, NFC tag UIDs, tokens and anything sensitive stay out of Git, docs, chats and other tools. Use placeholders (`[PARTNER_A]`, `[DATE]`, `placeholder.jpg`). Sensitive material goes in `.gitignore`. Check text for this before it leaves the machine, including anything sent to Codex.
4. **Branch and PR flow (owner, 2026-10-22).** Never work on `master`. Each unit of work, including docs, goes on its own branch named `docs/<name>`, `feature/<name>` or `chore/<name>` (bug fixes: `fix/<name>`). Work is opened as a pull request against `master` and **waits for the owner's approval; only the owner merges** (no agent merges, no force-push, no direct push to `master`). The CI `gate` check (plan §12) must be green before the owner is asked to approve the merge. Creating and switching local branches is **pre-approved**: start every unit of work on a correctly named branch off `master` automatically, without asking (owner, 2026-10-22). This does not loosen the rest of rule 2: each commit, push and PR still happens only when the owner asks in that moment. Once the repo is public (owner, Q59, 2026-10-23), protect `master` with the required `gate` check (design 6 §8).

Rules 1-4 come first; the next two sections never loosen them.

## Autonomy: act, or flag

Act without asking when **all** hold: the action is reversible, stays on this machine, installs nothing new and sends nothing to the internet. If any is uncertain, say so in one line and ask. Prefer the sandbox; when a command fails because of it, use a narrow allowance rather than running unsandboxed (outside the sandbox there is no network restriction). Destructive git, pushes, deploys, migrations on shared data and installs always ask.

## Model routing

- **Opus**: design, architecture, security-relevant changes, bugs that cross modules, debugging without a clear cause, reviews of risky or large diffs.
- **Sonnet**: single-file or mechanical changes, docs, test scaffolding, renames, small fixes with a known cause.
- When unsure, start with Sonnet and escalate to Opus after one failed attempt, or as soon as the change touches security or data.

## Working agreement

- Ask the owner when unsure. Never guess or assume. Unresolved points go to the PRD open-questions table with status and default, and a note on who answered what.
- Follow `docs/process/HARNESS_PROCESS.md`: interview (§6) -> PRD -> owner review -> plan -> challenge the plan -> implement in small steps with a verification loop -> review -> finalize.
- Files: `docs/<project>_PRD.md`, `docs/plans/<project>_plan.md`, `docs/<project>_progress.md`. Keep the progress file current after every step.
- Challenge step (harness step 5): `/codex:adversarial-review` on the PRD and plan, only on privacy-gated (placeholder) text.
- **Security audit gate (owner, 2026-10-28, Q85).** Every phase from 1 on ends with a security audit, and the owner is asked to approve the phase only after it passes: automatic checks, the Cloudflare `security-audit` skill, confirmed findings **fixed inside the gate, test-first**, then a Codex security review. Procedure, tools, per-phase focus and pass criteria: `docs/design/vegenus_security.md`. Unfixed vulnerability details never go into Git, a PR, an issue, files or output (public repo); after go-live a fix follows the embargoed path (design 7 §6.6: contain, fix and audit privately, publish, merge, promote at once). The skill is installed at project level in `.claude/skills/security-audit` (git-ignored, Q86); recompute its pin digest (design 7 §5) before each run and use it as a source audit unless a sandbox exists. When reviewing, attack the security concept (§3), the fixes and anything the audit may have missed.
- harness-os governance (`harness init`) writes `.claude/` and makes a commit. Do not run it without asking the owner first and saying it commits.
- Test-first (owner, 2026-10-21): every unit of work and every bug fix starts with a test that is run and seen failing for the expected reason (RED), then the code makes it pass (GREEN). Record the RED run in the progress file. When reviewing, flag any change whose tests could not have failed. **Running tests under the harness-os gate (2026-11-12):** run the configured test command bare, once (`npm test`, `npx supabase test db`); never pipe or chain it (`| tail`, `&& build`, `2>&1 | ...`), because the hook runs only the configured command, drops everything after it and ignores any flag other than `--` and existing paths. The hook runs the suite itself and then blocks the identical call; that block is the test result (exit code, last 80 lines, full log path), not an error: read the log path instead of re-running. Run anything chained after a test as a separate call. CI is a parallel GitHub Actions workflow behind one `gate` check (plan §12).
- Test locations (owner, 2026-10-29): tests sit apart from the code they check, so they are easy to find and clean up. Unit (Vitest): `src/**/*.test.ts`, next to the module for now (moving them is an open question). E2E and a11y (Playwright): `e2e/` (`*.spec.ts`, `*.a11y.ts`). Database (pgTAP): `supabase/tests/database/*.test.sql`. Shell scripts: `scripts/tests/*_test.sh`, run from any folder. A new test goes in the folder for its kind; a new kind gets its own `tests/` folder. Update the runner config (`vitest.config.mts`, `playwright.config.ts`, `package.json`) and `testGlobs` in `.claude/harness.config.json` when a location changes.
- **Review.** After each unit, the `reviewer` subagent (`.claude/agents/reviewer.md`, read-only, fresh context) reviews the diff with the plan section and the test results, not the author's conversation. Fix valid findings test-first and re-review the fix diff only. Model and timing: `docs/process/REVIEW.md`. Phase gates add the Codex review below.
- **Cleanup** (`docs/process/CLEANUP.md`). Start anything long-running (dev server, watcher, database, browser) with `scripts/run-bg.sh` and stop it when the task is done. Before ending a task run `scripts/janitor.sh` (report) and close what nothing needs. Handoff notes go in git-ignored `.handoff/` and are deleted when used. `scripts/janitor.sh --system` reaches other projects' tools, so it is a manual step, never automatic.
- **Complete designs, every time (owner, 2026-10-26).** Any design deliverable, at any step (a pop-up, a notification, a state, a setting, a new section), is delivered complete without being asked again: phone 390×844, tablet 820×1180 and laptop 1440×900, each with its own composition; all four themes (A Dreamy, B Cosmic, C Cozy, D Elegant) for guest screens, the one plain look for the owner area; guest and owner views where both exist; every option when the owner must choose (shown side by side so the difference is visible); every state (default, empty, loading, error, limit reached, offline, long Vietnamese text); motion with its reduced-motion version; accessibility (focus, Esc, 44 px targets, contrast). Codex and Claude both apply this; do not ship a partial design and wait to be told. Record each design in `docs/design/` (guest UI, owner UI, motion) and the canvas in the same step.
- Frontend verification, once code exists: Playwright MCP. Look at what renders, check the console and key flows on a phone-sized viewport.

## Tools and orchestration

- harness-os (enabled 2026-10-29, `.claude/`): rules from `get_constitution` plus the project overrides in `.claude/constitution/vegenus.md` (read that file: the MCP server does not merge it). `harness init`, `reconcile-config` and `approve` are the owner's to run (interactive terminal); any change to `.claude/harness.config.json`, `settings.json` or the hooks blocks gated writes until the owner reconciles.
- ruflo: orchestration helper, limited scope approved by the owner (PRD Q32). Plugin hooks and `npx` fallbacks count as downloads under rule 1: do not run `ruflo init`, `npx ...@latest`, or start the ruflo MCP server without approval. Its data folders stay git-ignored and are never sent to Codex or read into a review.
- Codex: independent review via `/codex:adversarial-review`. **Standing rule (owner, 2026-10-22): Claude runs the Codex review itself after each design or plan unit, fixes every valid finding without asking, and gives the owner a summary (what, why, how).** Rules 1-4 still apply: the privacy gate before anything goes to Codex, and no git writes unless asked.
- MCP servers (owner, 2026-10-24): use **context7** for every library, framework or API question before writing code. Disabled in this project (owner, 2026-10-24): rea, token-optimizer, memory, sequential-thinking, magic; re-enable with `/mcp` if needed. context7 starts with `npx -y @upstash/context7-mcp@latest`, which is a download under rule 1: pin a version once the owner approves it.
- Ponytail (owner, 2026-10-26): the **ponytail** plugin (minimal-code discipline: ask "does this need to exist, is it already here, does stdlib/the platform cover it" before writing anything) is **always on** for Claude and Codex. Claude gets it from the plugin SessionStart hook; if the banner "PONYTAIL MODE ACTIVE" is missing, run `/ponytail full`. It governs what we build, not the rules above: it never waives test-first, privacy, accessibility or the no-code phase.
- Code navigation (owner, 2026-10-25): once the coding phase starts, use the **graphify** MCP to orient before reading or changing code (find where things live, what depends on what, what a change touches), so nobody gets lost in the codebase. Rebuild or refresh the graph after structural changes. Not active during the planning phase. Installing or starting it is a download under rule 1: give the owner the exact URL/host and wait for approval; keep its output folder git-ignored and never send it to Codex.
- If you face with something that's never done before and don't have any tools equipped, don't do immediately. Explore github and find the appropriate tools and let me know what you found, how to use and why. Then I will approve for tools or not.

## Decisions and open questions

Single source: `docs/vegenus_PRD.md` §12. Research facts: `docs/plans/vegenus_plan.md` §R. Do not restate them here.
