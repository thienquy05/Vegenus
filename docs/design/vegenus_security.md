# Design 7: Security concept and per-phase audit gate

**Status:** v0.2, **Approved by the owner 2026-10-28 (Phase 0 sign-off).** The Phase 0 gate (§6.2) has passed. v0.2 adds: private acceptance records (§6.4), machine callers (§3), bounded production probe (§6.6), PR-run order (§6.1), Phase 0 scope (§6.2), Phase 6 header check on the production domain (§6.2), migration recovery marked unverified (§8, Q89). No code. The Cloudflare skill is installed at project level, git-ignored (§5, Q86); no other tool from section 4 is installed.
**Date:** 2026-10-28
**Inputs:** PRD §4.3, §9.2, §11, §12 (Q85-Q87); plan §8, §9, §12; design 1 (token flow, §1 and §9), design 3 (data model), design 5 (3D, §8), design 6 (CI); the Cloudflare `security-audit-skill` README (read 2026-10-28, github.com, read-only).
**Privacy:** placeholders only. Unfixed vulnerability details never enter Git, a PR, a doc or a chat (§6.3).
**Single-source rule:** decisions stay in PRD §12. This document collects the security concept in one place and defines the audit gate; it does not restate the other designs' contracts, it points to them.

## 1. Principles

1. **Defence in depth with one proof per control.** Every control below names the test that fails if it breaks. A control with no test is a wish.
2. **Cheap checks on every change, deep audit once per phase.** Automatic checks run in CI on every PR (§4, layers 1-2). The expensive agent-led audit runs at the end of each phase (layer 3), because it costs tokens and time and finds the most when the code is stable.
3. **Fix inside the gate.** The phase is not offered to the owner for approval until the audit's confirmed findings are fixed test-first (§6). No "we will fix it later" list for high or critical findings.
4. **Platform first** (ponytail). GitHub's own scanners and the database's own row-level security before any extra tool. A new tool needs a gap the existing ones leave.
5. **The repository is public** (Q59). The gate therefore protects the process as well as the product: findings are handled privately until fixed (§6.3).

## 2. Assets, actors and trust boundaries

| Asset | Why it matters | Held in |
|---|---|---|
| Couple's photos, videos, notes | The reason the site exists; private by default | Private storage bucket, signed URLs only |
| Guest token (NFC/QR) | Grants guest read and post-to-queue | Database (hash), URL fragment, POST body |
| Partners' own birth data | Personal data (PRD §4.3) | Database, AES-256-GCM at application level |
| Member and subscriber emails | Personal data | Database behind row-level security |
| Owner account and sessions | Full control | Supabase Auth, cookie |
| `vegenus_server` credentials, service-role key, encryption key | Bypass row-level security / decrypt data | Environment variables on the host only; never Git, never CI |
| Free-tier quotas | Exhaustion is a denial of service and a cost | Hosting and database dashboards |

| Actor | Starts with | Boundary they must not cross |
|---|---|---|
| Visitor, no credential | Nothing | Anything except what a Published page shows and the rate-limited wish post |
| Token holder / Member | A token or an account | Drafts, pending items, other pages, owner actions |
| Owner | Full account | Other tenants (tenant-ready design), the service-role key from the browser |
| Attacker (any of the above, hostile) | Everything public: the repo, the API URL, the public API key | Same boundaries; the repo being public is assumed in every threat |
| Supply chain | npm packages, GitHub Actions, Docker images | Our build and our secrets |

Trust boundaries: browser ↔ Next.js server; Next.js server ↔ database (narrow functions only); browser ↔ database API directly (must open nothing); storage ↔ browser (signed URLs only); GitHub ↔ CI runner (no secrets); owner's machine ↔ everything (local tooling, agent plugins).

## 3. Security concept: controls and proofs

The detailed contracts stay in the cited documents. This table is the one place to see every control and the test that proves it.

| Area | Control | Proof (test) | Defined in |
|---|---|---|---|
| Authorization | Four layers: route table, auth check inside every handler, row-level security on every table, private storage with signed URLs | Crawler test; build fails on an unclassified route; pgTAP anon-role tests (E32, E33) | Design 1 §9; PRD §4.3 |
| Tokens | 256-bit random; hash stored; fragment/POST body only; `Referrer-Policy: no-referrer`; rotation in one action | Token tests (design 1 §8); header test (below) | Design 1 §3, §6 |
| Database | No anon table access. Three separate contracts (design 1 §5.1): `guest_*` validates the current token and takes the token, never a page ID; `public_*` needs no credential and validates Published visibility; `account_*` validates `auth.uid()` and an active `guest_accounts` row for the page. All three also require published wording and the publication predicates. `SECURITY DEFINER` functions with a fixed `search_path` | pgTAP over every function, per contract: token cases for `guest_*`, no-credential cases for `public_*`, identity and membership cases for `account_*`; Supabase security advisors clean | Design 1 §5.1; design 3; plan §1 |
| Guest text | Plain text, escaped on render, length caps in user-perceived characters (Q73) plus a UTF-8 byte cap per field and per request (design 3 §1 principle 7), no HTML or Markdown | Unit + e2e script-injection test (E11) | Design 1 §1; PRD E11 |
| Abuse | Rate limits per device, IP and page (Q75, Q78); login and reset limits; moderation queue | Limit tests; abuse drills in Phase 6 (E11, E22, E38, E46) | PRD E11, E22 |
| Media | Type and size validation by content, not name; location metadata stripped; thumbnails at upload; video cap; no public bucket | Upload tests with spoofed types and oversize files; EXIF test (FR7); signed-URL expiry test | PRD FR7, E7-E10 |
| Email and invites | Single-use invite codes; confirmation needs a deliberate button, not a GET; consent from the mailbox holder; unsubscribe without sign-in | Tests E48 and the design 1 §10 list | Design 1 §10 |
| Machine callers | Routes of class `machine` (design 1 §9): the daily scheduled job (cleanup, digest dispatch, keep-alive) accepts only a request carrying the scheduler's shared secret from an environment variable; email-provider events (bounces, complaints) are accepted only with a valid provider signature over the raw body and a timestamp inside the provider's tolerance. Anything else gets one generic refusal, does no work and changes no state. How the host scheduler sends its secret and how the provider signs events are **unverified** (check with context7 when the scheduler and provider are approved) | Tests per `machine` route: no credential, wrong secret or signature, stale timestamp, replayed event → refused with no row written, no mail sent, no cleanup run; valid → work done once | Design 1 §9, §10.5 |
| Sessions and CSRF | `SameSite=Lax` cookie, `Origin` check, custom header on guest POSTs | CSRF e2e tests (design 1 §8) | Design 1 §1 |
| Secrets | Environment variables only; `.env` git-ignored; no secrets in CI; encryption key separate from the database | `privacy-scan` + GitHub secret scanning (§4); rotation drill in Phase 6 | CLAUDE.md rule 3; design 6 |
| **Security headers (new)** | Baseline for every response: a strict `Content-Security-Policy` (no `unsafe-inline` scripts; `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy` (`no-referrer` on `/g`), `Permissions-Policy`, HSTS (the host may add it; **unverified** for `*.vercel.app`) | One Playwright test fetches the guest, owner and API routes and asserts the header set and cookie flags (`Secure`, `HttpOnly`, `SameSite`). Final values are chosen in Phase 1 and re-tested in Phases 4-5, because 3D (workers, textures) needs CSP allowances | **This document** |
| Supply chain | Actions pinned to a full SHA; `permissions: contents: read`; no `pull_request_target`; lockfile + exact versions; `npm audit` fails the build on high/critical | Design 6 checks; `lint-types` job | Design 6 §4, §5; plan §12.2 |
| Client side | Third-party textures only from our storage with CORS set; no third-party scripts on `/g`; analytics excluded from `/g` | Header test; Phase 4 and 5 audit focus (§6.2) | Design 5 §8; PRD §4.3 |
| Availability and spend | Per-account limits; usage meter and alerts; keep-alive; automatic downgrade of 3D | Limit tests; egress alert drill (E24) | PRD S14, E24 |
| Data lifecycle | Export is read-only: it returns the data and media and leaves records, media and access unchanged. Deletion is a separate, explicitly confirmed action that removes the page, its media and encrypted fields. No backup mechanism exists (Q90, deferred); if one is ever added, recovery from an older snapshot must not bring back deleted data or revoked access (§6.7) | Export test asserting records, media and access are unchanged afterwards; deletion tests (E16). E23 covers only recovery from a paused database | PRD S15 (export and delete are separate); E16, E23; §6.7 |
| Local tooling | Agent plugins and MCP servers are downloads under rule 1; their data folders are git-ignored and never sent to Codex | Process (CLAUDE.md); `.gitignore` checked by `privacy-scan` | CLAUDE.md |

Accepted risks stay as recorded in the PRD (for example a leaked link grants guest read until rotation). The audit may re-open an accepted risk only with new evidence.

## 4. Tool selection

Picked for the most coverage per minute of cost, in four layers. Only the Cloudflare skill is installed (§5); every other new download waits for the owner (rule 1).

| Layer | When | Tool | What it catches | Cost / status |
|---|---|---|---|---|
| 0 Local | Before every push | Commit check and `privacy-scan` script (design 6 §8) | Secrets, personal emails, tag UIDs, stray images in history | Already designed |
| 1 Every PR, automatic | CI `gate` | `npm audit --omit=dev --audit-level=high` (in `lint-types`); pgTAP (`db`); route-table crawler; the new header test (in `e2e`) | Vulnerable runtime dependencies, broken authorization, missing headers | Already in design 6, plus one test |
| 1 Every PR, platform | GitHub settings, no workflow file | Secret scanning with push protection; Dependabot **alerts** (not version-update PRs, to avoid noise); CodeQL **default setup** for JavaScript/TypeScript | Leaked keys, known-vulnerable packages, injection and unsafe-data-flow patterns in our code | The repo is public; on 2026-10-28 the API listed secret scanning, push protection and Dependabot security updates as available and disabled; secret scanning and push protection were then **enabled** the same day (owner request, read back from the API). Dependabot and CodeQL still to do (Q87) |
| 2 Every PR, review | Before asking for approval | `security-review` (built-in skill) on the branch diff; the `security-reviewer` agent in addition for any unit that touches tokens, row-level security, auth, email or media (plan §12.1 step 5) | Logic flaws a scanner misses, in the diff only | Already in the plan |
| 3 Phase gate | End of every phase (§6) | **Cloudflare `security-audit` skill** (`github.com/cloudflare/security-audit-skill`, MIT): isolated agents for reconnaissance, coverage-led hunting, fresh-agent validation of every candidate, structured `findings.json`, independent record verification, report | Multi-step flaws: authorization gaps across layers, tenant isolation, request-framing and cache issues, client-side injection, resource exhaustion, supply chain and deployment configuration | Costs model tokens and time. Source-only audit unless a sandbox is provided (§5) |
| 3 Phase gate | Same | **Codex adversarial review** with a security brief (standing rule, CLAUDE.md), run after the fixes | A second model family checking the fixes and what the first audit missed | Existing process |
| 4 Phase 6 only | Before go/no-go | OWASP ZAP **baseline** (passive) scan of the deployed preview, **optional**; Supabase security advisors; the whole-history commit check | Header and cookie mistakes on the real deployment; database configuration drift | Needs a Docker image download and a deployed URL; decide at Phase 6 (add when the header test proves too thin) |

**Why the Cloudflare skill is the phase-gate tool.** It targets what scanners cannot: it forces a coverage ledger (what was and was not examined), validates every candidate with a different agent that tries to disprove it, and keeps "defence-in-depth gaps" apart from real vulnerabilities, which keeps the fix list short and honest. Its authors report that one run found about half of what repeated runs found, so Phase 6 runs it twice (§6.2). It is one repo, so it fits this project's size.

**Considered and not chosen**

| Tool | Reason |
|---|---|
| Semgrep or another SAST | CodeQL (platform, no install) already covers JavaScript/TypeScript; a second SAST adds noise. Revisit if CodeQL misses a class the audit finds twice |
| gitleaks / TruffleHog | `privacy-scan` plus GitHub secret scanning cover it. Add gitleaks only if custom patterns outgrow the script |
| Snyk, Trivy, OSV-Scanner | Snyk needs an account (login, rule 1). Trivy targets container images and we ship none (the Docker images are Supabase's, local only). OSV adds little over `npm audit` and Dependabot alerts |
| Dependency-review action | Already declined in design 6 §11 |
| Cloudflare WAF, Turnstile | Not in the plan (host is Vercel). A bot check on the visitor wish form is a product decision, not an audit tool; raise it only if the Phase 6 abuse drills show the rate limits are too weak |
| DAST suite beyond ZAP baseline | Out of proportion for a personal site |

## 5. The Cloudflare skill: how we would use it

Facts from the README (read 2026-10-28):
- Six phases: reconnaissance, coverage-led hunting, candidate validation, structured output (`findings.json`, validated against `report-schema.json`), independent record verification, reporting (`REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`).
- Verdicts: `confirmed` (complete source trace and a bounded observed result), `needs_validation` (an exact unresolved fact, no severity), `rejected`.
- Attack-class files by target type: core and wildcard classes, web protocol and auth, client side, cloud and deployment, supply chain and release, data isolation and lifecycle, resource exhaustion, protocols/RPC/messaging, AI/LLM, memory safety, desktop/mobile.
- Requirements: an agent with tool use and parallel sub-agents; Node.js for two zero-dependency validators; **an OS-enforced sandbox** (no external network, sanitized environment, resource limits, scratch-only writes) before it executes any target code. Without a sandbox it keeps the lead as `needs_validation` instead of running code.
- Output defaults to a directory outside the repo (`~/security-audit-skill/<repo-name>/run-<N>`) and writes inside the repo only if the owner picks an ignored directory. We keep the default.
- Install command (run by the owner globally on 2026-10-27, not by us): `npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit`, with `--global` for a user-level install.

How we use it:
1. **Source audit by default.** We have no OS sandbox set up and the project must stay free of extra installs, so the agent audits source and configuration and does not run target code. Behaviour we can only learn by running (real headers, rate limits, the Supabase stack) is covered by our own tests in CI and by the Phase 6 checks, not by this skill. Anything the skill cannot settle becomes `needs_validation` and is turned into one of our tests.
2. **Attack classes per phase** (§6.2). We leave out memory safety, AI/LLM (no model runs at runtime; Codex image generation happens at design time only) and desktop/mobile. Whether the skill lets us select classes, or only suggests emphasis in the prompt, is **unverified**; we state the emphasis in the request either way.
3. **Installed and checked (2026-10-28).** The owner had already installed the skill globally on 2026-10-27 with the `skills` CLI (`~/.agents/skills/security-audit`, source `cloudflare/security-audit-skill`). Claude Code did not load that copy. On the owner's instruction (Q86) it was copied, with no new download, to `.claude/skills/security-audit` in this project, and `.claude/skills/` was added to `.gitignore`. Checks done before first use:
   - All 20 files match upstream `main` (GitHub contents API, read-only) by git blob hash; no file is missing or extra.
   - A pattern scan of every file (download, execute, shell-pipe, credential-path patterns) found only audit checklist text. The two validators contain no network or process-execution calls.
   - The 14 instruction files were **not** read line by line, only scanned. Read `SKILL.md` and the files for the chosen attack classes before the first real run.
   - **Pin:** sha256 over the sorted lines `<file name> <git blob sha1>` of the 20 files = `2822e3ade65bb08130f46ce04e649f7e30a88fc233ef687d2bb5a11a92c20b76`. Recompute it before each audit run; a different value means the skill changed and must be re-checked before it is used. The upstream commit SHA was not captured (the contents API does not return it).
4. **Location.** Project level, git-ignored, so no third-party skill text enters the public repo. The global copy still exists and is visible to other agents (Codex reads `~/.agents/skills`); it can be removed if the owner prefers one copy.

## 6. The per-phase audit gate

The gate is the last step of every phase, after CI is green and before the owner is asked to approve the phase. It becomes a standing rule in CLAUDE.md and AGENTS.md (Q85).

### 6.1 Procedure

1. **Freeze and name the candidate.** Stop adding features. Every PR of the phase is merged by the owner (rule 4), or explicitly moved out of the phase and listed. The **candidate** is the resulting `master` commit; its SHA is recorded. Nothing is audited from an open PR or a feature branch, so the audited tree is the tree that ships.
2. **Layer 1-2 sweep.** `gate` green; GitHub alerts and CodeQL results for the phase read and triaged; `security-review` done on every PR of the phase.
3. **Layer 3 audit.** Run the Cloudflare skill with the focus for the phase (§6.2). Output goes outside the repo.
4. **Triage.** For each record: `confirmed` goes to step 5; `needs_validation` is resolved by writing a test, or kept with its exact unresolved fact; `rejected` is archived; defence-in-depth notes go to a hardening list.
5. **Fix, test-first, directly in the gate** (after go-live, §6.6 replaces steps 5-8 for confirmed findings). One branch per finding group, `fix/security-p<N>-<slug>` (rule 4). For each finding: a regression test that fails for the stated reason (RED, recorded), the smallest fix (GREEN), the full local suite green; then, when the owner asks (rule 2), push and open the PR; the PR's own `pull_request` run of `gate` must be green (design 6 §3; a manual dispatch does not count). The branch stays local until the fix and its test are complete. The owner merges the fix PR, which creates a **new candidate** (new `master` SHA).
6. **Re-run on the new candidate.** Run the skill again on the current `master` commit, so the fixes are inside what is audited. New `confirmed` records repeat steps 5 and 6. Phase 6 runs the audit twice from the start (the skill reports that repeated runs find more).
7. **Codex review of the final candidate.** Claude runs `/codex:adversarial-review` with a security brief on the phase's diff against the previous phase's candidate, plus the sanitized findings summary, at the **same SHA** as the last clean re-run. It fixes every valid finding and reports what, why and how (standing rule); any fix merged creates a new candidate and returns to step 6. Anything sent is checked against the privacy gate first.
8. **Record and ask.** Fill the phase's security line in the progress file (§6.4) with the final candidate SHA. Then ask the owner to approve the phase. If `master` moves after that, the approval does not carry to the new commit: re-run step 6 on the new SHA (a diff-only run is enough for a docs-only change) before the phase is called done.

### 6.2 Focus per phase

| Phase | Skill emphasis (attack-class files) | Our own checks added at this gate |
|---|---|---|
| 0 Planning | No code, so no skill run. Adversarial review of the threat model and this document (documents only, PRD §10) | Design 1 §1 and this §3 reconciled. Run the whole-history `privacy-scan` at the Phase 1 gate, once its checker exists (T1.6, design 6 §8); it covers Phase 0's history |
| 1 Foundations | Core and wildcard; web protocol and auth; data isolation and lifecycle; cloud and deployment; supply chain and release (CI, Actions, Supabase config) | Anon-role pgTAP over every function; route-table crawler; header test written and green; secrets rotation notes; Supabase security advisors |
| 2 Owner tools | Data isolation and lifecycle; resource exhaustion (uploads, quotas); core classes (path handling, file parsing) | Spoofed-type and oversize uploads; EXIF strip; signed-URL expiry; owner-action authorization tests |
| 3 Guest experience | Client side (guest text, DOM injection); web protocol (CSRF, token handling); resource exhaustion (Q75/Q78 limits); protocols/messaging (email sending, webhooks) | Script-injection e2e (E11); rate-limit tests; email flow tests (E48); real tag and QR check |
| 4 Themes and Page 3D | Client side (assets, CSP with 3D, third-party content); run on the phase's diff only | Header test re-run with CSP changes for workers/textures; no third-party origin on `/g` |
| 5 World mode | Client side; resource exhaustion on the client; run on the phase's diff only | Same as phase 4 |
| 6 Hardening | **Everything relevant, full repo, two runs** | Header and cookie check (the §7 test) against the **production domain** serving the recorded candidate, signed in with synthetic accounts before go-live (a preview runs against the development project, plan §12.3, so it does not prove the production baseline); Deployment Protection check (unauthenticated requests to staged and historical deployment URLs are rejected, production domain answers, §6.5); optional ZAP baseline; Supabase advisors; whole-history commit check; abuse drills (E11, E22, E38, E46); restore drill (E23); secret rotation drill. **Runs before any real couple content goes live or the NFC tag is written for guests** |

### 6.3 Handling findings in a public repository

- The audit's output folder is outside the repo. Only counts, severities and fix PR links go into the progress file.
- A finding's exploit detail (steps, payloads, working proof) is never committed, pushed, pasted into a PR or issue, or sent to any tool other than Codex for the review in step 7. The owner hears the area and severity in the local session only. After go-live the fix itself is published through the embargoed path of §6.6. After the fix has merged, a short class-and-fix note may go into the progress file, still without exploit steps.
- Before real content exists (Phases 1-5) a leaked finding exposes no personal data. From Phase 6 on it could, which is why Phase 6 runs before go-live.
- A regression test names the control, not the exploit.

### 6.4 Pass criteria

The gate passes when all of these hold:
- No open `confirmed` finding of critical or high severity.
- Every medium is fixed, or accepted by the owner.
- Every `needs_validation` is resolved by a test or a runtime check. A record about authorization, tenant isolation or data exposure is never left open at Phase 6; in earlier phases it stays open only through an explicit owner acceptance that names the unresolved fact, the bounded impact and the compensating control. Any other open record needs the same acceptance.
- **Where an acceptance is recorded.** Its technical content (unresolved fact, impact, compensating control) stays in the private audit folder (§6.3). PRD §12 gets only a neutral entry: the owner's decision, the severity, the phase and the private record identifier, with no detail that describes the weakness. The owner having seen the list is not acceptance. Because the audit is source-only (§5), these records are expected, so each one becomes one of our tests or a Phase 6 deployment check.
- **The audit run is complete.** Every counted run ended in the skill's complete terminal state: `run_status` is not `incomplete`, `validate-findings.cjs` and `validate-coverage-ledger.cjs` both exit successfully on the final records, and every candidate has a final disposition (`confirmed`, `needs_validation` or `rejected`). A candidate left only in the coverage ledger because the validation budget ran out is not a disposition. An incomplete run blocks the phase until it is resumed and completed; its reason is recorded. Units the skill marks `deferred` for budget reasons are run before the gate passes, so the gate runs are not given a budget that defers units.
- The coverage ledger shows no unexamined unit in the phase's scope, or the gaps are listed and accepted.
- The final re-run adds no new `confirmed` finding, and Codex's review has no unresolved valid finding.
- The final re-run, Codex's review and the checks of step 2 all refer to **one recorded `master` SHA**, and every PR of the phase is merged into it (or listed as moved out). For Phase 6, the build served on the production address (which the NFC tag and QR always point to, Q19) is the one built from that SHA, checked before go-live.
- The phase's security line in the progress file is filled in.

Progress-file line per phase: `Security gate: candidate master SHA, tools run, run_status and validator results, skill commit SHA, runs (N), findings (confirmed / needs_validation / rejected, counts by severity), fixes (PR links), accepted items (Q numbers), Codex review result, date`.

### 6.5 Release and promotion (reconciles Q33 and plan §12.3; Q88, answered)

Q33 and plan §12.3 deploy production from `master` once `gate` is green and the owner merges. The phase audit (§6.1) runs on the merged commit, so it always runs after that deployment. Two rules close the gap:

1. **Before go-live, production holds no real data.** The production project is empty or seeded with fake data, no real content is entered, and no NFC tag is written for guests until the Phase 6 gate has passed (§6.2). Merges deploy as Q33 says; the phase audit gates the phase approval, not the deploy. A finding found in this period cannot expose real memories. Entering real content and writing the tag are the go-live act, and they happen only after the recorded Phase 6 candidate passes.
2. **After go-live, promotion is held until the candidate passes.** Production does not take a merged commit automatically. The change deploys as a staged production build; the audit of §6.1 steps 3-7 runs on that commit, scoped to the diff against the currently promoted commit; the owner then promotes that exact SHA. The previous promoted SHA stays available for rollback. The setting is Environments > Production > Branch Tracking > **Auto-assign Custom Production Domains** (turned off), then **Promote** on the chosen deployment; the CLI equivalents are `vercel --prod --skip-domain` and `vercel promote` (Vercel docs, read through context7 2026-10-28). Its availability on the free Hobby plan is **unverified**; confirm before Phase 6. A staged production build uses production environment variables, so any test of it touches production services and data. Per-PR checks (layers 1-2) still run before every merge.

3. **Staged builds must not be reachable.** Holding promotion only decides which build the production domain serves. Every staged and historical deployment also has its own generated URL, and a staged production build runs with production configuration. Before go-live the owner enables Vercel Authentication under Deployment Protection with the **Standard Protection** scope (all deployments except production domains; API value `prod_deployment_urls_and_all_previews`). The legacy "Pre-Production Deployments" scope is not acceptable, because it does not protect past production deployments. Vercel states that Vercel Authentication is available on all plans at no cost (Vercel docs, read through context7 2026-10-28). Password Protection is not available on Hobby and is not used.

4. **A release has two production artifacts: the app build and the database.** Promoting a Vercel build deploys no migration, and authorization lives in row-level security and database functions (§3). Database migrations are applied to the production project from the candidate's migration files (how: Q89), before any app build that needs them is promoted. They are written so that both the new build and the previously promoted build (the rollback target) work against the migrated schema (add first, remove only in a later release). The applied migration version is recorded with the candidate SHA, and the promotion check compares the production database's applied version with the candidate's.

Checks before go-live and after any change to project settings: an unauthenticated request to a staged deployment URL and to a historical deployment URL is rejected, while the approved production domain still answers. The promoted deployment's commit must equal the recorded candidate SHA; this is checked before go-live and before every later promotion.

### 6.6 Embargoed fixes after go-live

A public fix PR and its regression test show the weakness while production still runs the old build. Before go-live that costs nothing (§6.5 rule 1: no real data). After go-live, a `confirmed` finding follows this path instead of §6.1 steps 5-8:

1. **Contain first.** If the weakness is exploitable now (critical or high, or any confidentiality or isolation flaw), the owner disables the affected function before anything is published: set the page Private, rotate tokens, pause the route behind a switch, or pause the project. The owner is told the area and severity in the local session only; details never go to a public place.
2. **Fix and test privately.** One local branch, regression test seen RED then GREEN, full local suite. The record of these runs stays in the private audit folder (§6.3).
3. **Audit the candidate before it is public.** Run the skill (diff scope) and the Codex review on the local branch's tree. The candidate is identified by its **git tree hash**, recorded privately.
4. **Publish at the last moment.** When steps 2 and 3 are clean and the owner asks for the push (rule 2): open the PR with a neutral title and description (no exploit text, a test named for the control, §6.3); `gate` must be green (rule 4). Using GitHub's private security-advisory fork to run this step privately is **unverified** for this repo (availability, whether Actions run there); until verified, the public PR window is the CI run, kept to minutes by step 3 having been done first.
5. **Verify, then deploy every affected artifact at once.** The owner merges; check that the merged tree hash equals the audited tree hash (a different value sends the change back to step 3). If the fix includes a migration, the owner applies it to the production database first (§6.5 rule 4), then promotes the staged build (§6.5 rule 2). No second full audit is needed, because the tree is the one already audited.
6. **Verify in production, then close.** Before containment is lifted, a probe against production confirms the affected control now holds, and the applied migration version matches the merged commit. The probe is read-only where a read proves the control (the regression test's check, run with the public key or a test account, reading no real data). Where only a write proves it (an unauthorized write, a posting limit, a cleanup), the owner authorizes a bounded probe on dedicated synthetic records (a test page and test account holding no real content), which are removed afterwards. If neither can run safely, the containment from step 1 stays in place. Only then lift the containment from step 1, record the tree hash, the merged SHA, the migration version and the PR link in the progress file, and add the class-and-fix note allowed by §6.3.

If step 1 cannot contain it, the site stays down or Private until the promotion is done. Availability yields to confidentiality.

### 6.7 Recovery from an older snapshot (dormant until a backup mechanism exists)

The owner decided on 2026-10-28 that no backup is needed for now (Q90, deferred). Nothing in this section is a gate item until a backup or snapshot restore is introduced; at that point these rules and the test below apply before the mechanism is used on real data.

Restoring an older snapshot or backup brings back what was deleted or revoked after it was taken: deleted items and media, removed Members, consumed invite codes, and tokens that were rotated. E23 only covers a paused database, so this is a separate requirement. Rules, to be built into the backup design if one is ever added:
1. **Restore into an isolated environment first** (a separate project or a local instance), never over production directly.
2. **Reconcile before access reopens.** Set the page Private; rotate the guest token (every earlier token is dead); expire all open invite codes; sign out all sessions; re-apply the deletion and revocation record (item, media and account deletions and Member removals made after the snapshot). The record holds identifiers and times only, no content, and is kept somewhere the restore cannot overwrite.
3. **The owner reviews and reopens** the page. Nothing reopens automatically.

**Snapshot-restore test** (mandatory once a backup mechanism exists): take a snapshot; then delete an item with media, remove a Member, consume an invite code and rotate the token; restore the snapshot into an isolated environment; run the reconciliation; assert the deleted item and media are unreachable, the removed Member is refused, the used code and the old token are rejected, and the page stays Private until the owner reopens it.

## 7. Tests to write first (RED before GREEN)

Added to design 6's job list; no new job.
1. **Header test** (Playwright, inside `e2e`): asserts the baseline in §3 on a guest route, the owner area, the token-exchange route and an API route, and cookie flags. RED first: against the bare skeleton it fails because the headers are absent.
2. Existing tests named in §3 stay where they are. The gate itself is a process step, enforced by the PRD §9.3 checklist row and the owner's approval, not by code (a script parsing the progress file would be fragile for little gain).

## 8. Open items

| # | Item | Default | Who |
|---|---|---|---|
| Q85 | Adopt the security section and the per-phase audit gate (this document) | Adopted; tool picks delegated to Claude | Answered (owner, 2026-10-28) |
| Q86 | Install the Cloudflare skill and choose the location | Done 2026-10-28: project level, git-ignored, checked and pinned (§5) | Answered (owner, 2026-10-28: it was already installed globally; "put them in project level") |
| Q87 | Enable GitHub secret scanning with push protection, Dependabot alerts and CodeQL default setup | Owner delegated the timing: "turn on whenever we need". Planned: secret scanning, push protection and Dependabot alerts at the start of Phase 1 (task T1.1); CodeQL once JavaScript/TypeScript code exists. Exact setting names confirmed on the page when set | Answered (owner, 2026-10-28); secret scanning and push protection enabled 2026-10-28, Dependabot alerts and CodeQL not yet |
| Q88 | Production promotion hold (§6.5): before go-live, merges deploy as Q33 says and production holds no real data; after go-live, merged commits are staged and promoted by the owner only after the audit of that commit | Adopt as written (with the embargoed fix path of §6.6); amends Q33 for the after-go-live period only | **Answered (owner, 2026-10-28): adopted; the owner will turn on the Vercel settings at Phase 6.** Hobby availability of turning off auto-assign is unverified |
| Q89 | How database migrations reach the production Supabase project (the plan does not say) | The owner applies the reviewed migration files from the candidate with the Supabase CLI, never from CI (no secrets in CI); the command and how it connects are confirmed with context7 in Phase 1 (**unverified**). Recovery from a bad migration is **unverified**: E23 covers only a paused database and no backup exists (Q90), so migrations stay additive (§6.5 rule 4) until a recovery method is chosen and shown in a drill on synthetic data | **Answered (owner, 2026-10-28): manual for now; the owner applies migrations to production personally** |
| Q90 | Backup mechanism and the deletion and revocation record (§6.7) | — (no default) | **Deferred (owner, 2026-10-28): no backup for now, maybe in the future.** §6.7 stays as a dormant rule |

Verification still owed: whether Auto-assign Custom Production Domains can be turned off on the Hobby plan; whether the skill selects attack classes by option or by prompt; GitHub's free tier for the three platform features on this repo; Supabase's exact advisor command (check with context7 in Phase 1).
