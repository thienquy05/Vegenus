# Review: model routing and independent reviewers

## 1. Model routing
| Use **Opus** for | Use **Sonnet** for |
|---|---|
| Design and architecture, plans | Single-file or mechanical changes |
| Security, auth, data access, privacy | Docs, comments, renames |
| Bugs crossing modules or without a clear cause | Test scaffolding from a clear spec |
| Reviewing risky or large diffs | Reviewing small, low-risk diffs |

Escalate from Sonnet to Opus after one failed attempt, or as soon as a change touches security or data. In Claude Code the subagent `model` field (`sonnet`, `opus`, `inherit`) or the per-call model choice sets this.

## 2. Independence
The agent that wrote a change does not approve it.
- The reviewer is a **separate subagent with fresh context** (`.claude/agents/reviewer.md`): read-only tools, no write tools, plan permission mode.
- It receives only: the diff (`git diff <base>...HEAD` or `diff -u`), the relevant PRD/plan section, and the test results. Not the author's conversation or reasoning.
- Reason: models tend to rate their own output higher than equally good output from others (Panickssery, Bowman, Feng, NeurIPS 2024, arXiv 2404.13076). The study tested other model families, so treat it as a reason for caution, not a measured size for any one model.
- Phase gates add a **cross-provider** review (for example Codex `/codex:adversarial-review`) when enabled, after the privacy gate on what is sent.

## 3. When
| Moment | Reviewer | Model |
|---|---|---|
| After each unit of work | `reviewer` subagent on the unit's diff | Sonnet for small/low-risk, Opus otherwise |
| After fixes from a review | Same reviewer, **fix diff only** | Same as above |
| End of phase | `reviewer` on the phase diff + cross-provider review + security gate | Opus |

Installed tools that can do the work instead of writing new ones: ECC `orch-review` (multi-dimension review with adversarial verification of critical/high findings), ECC language reviewers (`typescript-reviewer`, `python-reviewer`, …), ECC `security-reviewer`, Claude Code `/security-review`, `/code-review`.

## 4. Findings
Each finding: file and line, what is wrong, a concrete failure scenario (input → wrong result), severity (critical / high / medium / low), suggested fix.
- The author fixes valid findings test-first and records refuted ones with the reason.
- A finding without a failure scenario is a question, not a defect; answer it.
- The owner sees a summary: found, fixed, refuted, accepted.
