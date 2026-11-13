# Review: model routing and independent reviewers

## 1. Model choice
| Strongest model (`opus`) | Cheaper model (`sonnet`) |
|---|---|
| Design and architecture, plans | Single-file or mechanical changes |
| Security, auth, data access, privacy | Docs, comments, renames |
| Bugs crossing modules or without a clear cause | Test scaffolding from a clear spec |
| Reviewing risky or large diffs | Reviewing small, low-risk diffs |

Use aliases (`opus`, `sonnet`, `inherit`), never version numbers; aliases track the latest model. A running session cannot switch its own model, so this choice applies to subagents (their `model` field) and to which session the owner starts. Re-run a cheaper subagent's failed task on the stronger model rather than retrying it.

## 2. Independence
The agent that wrote a change does not approve it.
- The reviewer is a **separate subagent with fresh context** (`.claude/agents/reviewer.md`): read-only tools, no write tools, plan permission mode.
- It receives only: the diff (`git diff <base>...HEAD` or `diff -u`), the relevant PRD/plan section, and the test results. Not the author's conversation or reasoning.
- Reason: models tend to rate their own output higher (self-preference bias, arXiv 2404.13076).
- Phase gates add a **cross-provider** review (for example Codex `/codex:adversarial-review`) when enabled, after the privacy gate on what is sent.

## 3. When
| Moment | Reviewer | Model |
|---|---|---|
| After each non-trivial unit of work | `reviewer` subagent on the unit's diff | Sonnet for small/low-risk, Opus otherwise |
| After fixes from a review | Same reviewer, **fix diff only** | Same as above |
| End of phase | `reviewer` on the phase diff + cross-provider review + security gate | Opus |

Installed tools that can do the work instead of writing new ones: ECC `orch-review` (multi-dimension review with adversarial verification of critical/high findings), ECC language reviewers (`typescript-reviewer`, `python-reviewer`, …), ECC `security-reviewer`, Claude Code `/security-review`, `/code-review`.

## 4. Findings
Each finding: file and line, what is wrong, a concrete failure scenario (input → wrong result), severity (critical / high / medium / low), suggested fix.
- The author fixes valid findings test-first and records refuted ones with the reason.
- A finding without a failure scenario is a question, not a defect; answer it.
- The owner sees a summary: found, fixed, refuted, accepted.
