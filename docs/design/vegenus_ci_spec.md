# Design 6: CI spec

**Status:** v0.13, approved by the owner 2026-10-23; later versions add review fixes only. Last Phase 0 deliverable. No workflow file exists until Phase 1.
**Date:** 2026-10-23
**Inputs:** PRD §9.1, E32, Q33; plan §2, §12; designs 1-5 (their "tests to write first" lists are what the jobs run).
**Privacy:** placeholders only. No secrets in CI at all (plan §12.2), so this design adds no credential.

## 1. Principles

1. **One required check.** Jobs run in parallel; one `gate` job decides. The owner merges only when `gate` is green (rule 4).
2. **Fail closed.** A job that is skipped when it should have run, cancelled, or missing counts as a failure. Only a docs-only change may skip the heavy jobs, and `privacy-scan` never skips (§4).
3. **$0 and no surprise bills.** The repo is public since 2026-10-25 (Q59), so standard runners are free (§2). No payment method is added. If the repo ever goes private again, §6 applies.
4. **Pinned downloads only.** Every third-party action is pinned to a commit SHA, and the CLI and package versions are pinned. The full download list (§7) is approved under rule 1 before `ci.yml` is written.
5. **Local first.** The full suite runs locally before each push. CI confirms it and does not replace it, which is also the main way to save minutes.

## 2. Facts checked (2026-10-23, answers plan §12.5)

| Fact | Finding | Source | Effect here |
|---|---|---|---|
| Repo visibility | **Public** on 2026-10-25 | `gh repo view` (read-only) | Free minutes and branch protection once public (§8). Rule 3 unchanged |
| Actions minutes, private repo, Free plan | 2,000 min/month, 500 MB artifacts, 10 GB cache per repo. Without a payment method "usage is blocked once you use up your quota"; with one, the overage is billed. Public repos are free on standard runners | docs.github.com, "GitHub Actions billing" | §6 budget |
| Branch protection, private repo, Free plan | Not available: "Protected branches" is listed under **Pro** for private repos. Rulesets are for Team/Enterprise. On Free, repository rules are listed only for public repos. Pro's price is not on github.com/pricing (**unverified**) | docs.github.com "GitHub's plans", "About rulesets"; github.com/pricing | Q59 (§8) |
| Supabase CLI on GitHub runners | Supabase's own docs run `supabase/setup-cli` + `supabase start` + `supabase test db` (pgTAP) on `ubuntu-latest`. `supabase start -x <services>` skips containers | supabase.com/docs: testing overview, managing environments, CLI reference | `db`, `e2e` jobs |
| Docker on runners | Ubuntu 24.04 image has Docker 28.0.4, Compose 2.38.2, Node 22 and 24 cached, Chrome and Chromium | github.com/actions/runner-images, Ubuntu2404-Readme | No Docker setup step |
| Next.js advisories | CVE-2025-29927 (middleware bypass) fixed in 15.2.3. 2026 brought more: middleware/proxy bypasses (GHSA-6gpp-xcg3-4w24, GHSA-26hh-7cqf-hhc6) and critical RCEs in Image Optimization (AVIF, SVG) and `use cache`. The newest fixes need **16.4.1** (or 15.5.28 on the 15 line), published 2026-10-14 | github.com/vercel/next.js security advisories (API, read-only) | §5 audit rule; floor 16.4.1 |
| Vercel Hobby cron | Once per day, ±59 min (already verified, plan §R) | vercel.com/docs | Keep-alive uses a Supabase scheduled job or the daily cron. Not a CI matter |
| Resend sending without a domain | Still **unverified** (plan §12.5) | — | Not a CI matter; checked when the owner creates the account |

Two findings confirm earlier designs: the 2026 middleware bypasses are why design 1 checks access in the database on every call and does not trust middleware. The Image Optimization RCEs mean owner-uploaded SVGs (design 3 §3.3) must never go through `next/image` optimisation; keep `dangerouslyAllowSVG` off (the default) and serve SVGs as page media.

## 3. Triggers

- `pull_request` to `master` (opened, synchronize, reopened) and `workflow_dispatch` (manual reruns; a dispatch run never counts for the merge requirement below). **No `push` trigger.** The PR run already tests the merge with `master`, and deploys come from Vercel's Git integration (Q33), not from this workflow. A run on every push to `master` would spend minutes on code that was already tested.
- **Merge requirement: the green run tested the current `master`.** A `pull_request` run tests the merge of the PR head with `master` as it was when the run started. Before asking the owner to merge, Claude checks (read-only API) that the latest `pull_request` run's `gate` is green, and the merge commit it tested (`github.sha`) has `master`'s current tip and the PR's head as its two parents. If `master` has moved, the owner presses **Update branch**, CI runs again, and the check repeats. When the requirement holds, the merge commit has exactly the tree that was tested, so a post-merge run on `master` would add nothing. Once the repo is public, branch protection enforces this (§8): until then it is a habit.
- `concurrency: ci-${{ github.ref }}` with `cancel-in-progress: true`.
- `permissions: contents: read` at the top. No `pull_request_target`, no secrets, no `GITHUB_TOKEN` writes.

## 4. Jobs (replaces the plan §12.2 table)

| Job | Runs when | Does | Est. min (§6) |
|---|---|---|---|
| `changes` | always | Lists the PR's changed files with `git diff --no-renames`, so a file moved from app code into `docs/` counts as a deletion of the app path too. `app=false` only if every path is under `docs/` or is a root-level `*.md`. An empty list, a dispatch run, or an error gives `app=true` or a failure, never a silent skip | 1 |
| `privacy-scan` | always | The repo script from plan §12.2 (secrets, real-looking emails/tokens/UIDs, image files only where allowed, Zodiac and Q60 logo SVG/PNG manifests), plus the commit check (§8) on every commit in `origin/$BASE..HEAD`, not only the final tree: a backstop only, because a pushed commit is already public | 1 |
| `lint-types` | app | ESLint, `tsc --noEmit`, ban on `.only`/`.skip`, `npm audit --omit=dev --audit-level=high`, route-table check (E32) | 2 |
| `unit` | app | Vitest with coverage | 2 |
| `db` | app | `supabase start -x studio,imgproxy,mailpit,logflare,vector,edge-runtime,supavisor,realtime` (exclude list checked in the walking skeleton), then `supabase test db` (pgTAP: RLS, every `public_*`/`guest_*`/`account_*` function, designs 1 and 3 tests) | 4 |
| `e2e` | app | Matrix `[chromium, webkit]`, phone viewports. Starts Supabase like `db`, but also keeps storage, auth and the API gateway, then builds and runs Playwright. Traces uploaded on failure only. **Unsharded** at first; shard a browser only when its job passes 10 minutes | 8 + 9 |
| `a11y-perf` | app | axe in Playwright; Lighthouse CI (`@lhci/cli`, a pinned dev dependency) on the guest pages with the budgets from designs 4 and 5 | 6 |
| `red-proof` | app, advisory | §5.2. **Not** in `gate`'s `needs` | 2 |
| `gate` | always (`if: always()`) | Passes only by the rule in §4.1 | 1 |

The docs-only skip is safe only if no app code, test or build step reads `docs/` or a root `*.md`. `lint-types` enforces this with a check that no source or config file references those paths, and runtime files such as the Zodiac assets live outside `docs/`.

WebKit on Linux is Playwright's WebKit build, not iOS Safari. Real-iPhone checks remain the Phase 6 device test (PRD E1, E2).

### 4.1 Gate rule

`gate` passes only if all of these hold:
- every required job ID (`changes`, `privacy-scan`, `lint-types`, `unit`, `db`, `e2e`, `a11y-perf`) is present in `needs`, so a job dropped from `needs` or renamed while editing the workflow fails `gate` (exact names, not substring matches);
- `changes` succeeded and its `app` output is exactly `true` or `false`;
- `privacy-scan` succeeded;
- every other job in `needs`, including any added later, succeeded, or was skipped **and** `app` is `false`. Advisory jobs (`red-proof`) stay out of `needs`.

Anything else fails `gate`: failure, cancellation, a skip on an app change, a missing job, or a missing output. The check is one `jq` expression over `toJSON(needs)` (§9). It was tested against 14 cases (RED with a stub, then GREEN, see §10).

### 4.2 Security checks (design 7, Q85)

No new job and no new download. The security checks that run in CI are the ones already listed: `npm audit` (`lint-types`), pgTAP (`db`), the route-table check (`lint-types`) and one added Playwright header test inside `e2e` (design 7 §7). GitHub's secret scanning, Dependabot alerts and CodeQL default setup are repository settings, not workflow files (Q87). The agent-led audit is a phase-end process step, not a CI job (design 7 §6).

## 5. Rules inside the jobs

### 5.1 Versions
- Node 24, the same major as the Vercel project setting (to set in Phase 1). npm with a committed `package-lock.json`, `npm ci` only. npm comes with Node, so it needs no extra action (plan §2 left the package manager open; Claude's choice, the owner can override).
- Next.js at least **16.4.1** when Phase 1 starts (newest fixes, §2). `npm audit` in `lint-types` fails on high or critical advisories in runtime dependencies, so later advisories block merges until they are patched.
- Supabase CLI pinned to an exact version in `setup-cli`'s `version` input, never `latest` (Supabase's own example uses `latest`). The version is read when `ci.yml` is written: the GitHub API was unreachable at the end of this session.
- Caches: `setup-node` npm cache; Playwright browsers in `actions/cache`, keyed on the Playwright version.

### 5.2 `red-proof` (plan §12.1, advisory)
Finds the PR's new or changed **unit** test files (`*.test.ts`), checks out `master`'s code, copies only those test files over it and runs them. The job passes if they **fail**. It cannot tell a meaningful failure from an import error, so it stays advisory. Its ✗ shows on the PR but does not block `gate`. RED evidence for review stays in the progress file. Database and e2e tests are left out to save minutes; add them only if unit coverage proves too thin.

## 6. Minutes budget (only if the repo is private)

Public repos run on standard runners for free (§2), so this section is dormant. It applies again only if the repo goes private: 2,000 min/month, blocked (not billed) at 100 % without a payment method, and **nothing merges without a green `gate`** while blocked. Estimates, **unverified** until the walking skeleton measures them: about 36 min for an app change and 3 for a docs-only change, so about 55 app runs a month. Run time still matters when public: push when a unit is ready, after the full local suite passes; superseded runs are cancelled (§3).

## 7. Downloads (rule 1: **approved by the owner 2026-10-23**)

Read 2026-10-23 through the GitHub API (`releases/latest`, then the tag's commit). Re-read and check release notes when `ci.yml` is written.

| What | Version | Pinned SHA | Why |
|---|---|---|---|
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | Check out code (`fetch-depth: 0` in `changes`) |
| `actions/setup-node` | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` | Node 24 + npm cache |
| `actions/cache` | v6.1.0 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | Playwright browsers |
| `actions/upload-artifact` | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | Playwright traces, Lighthouse report, on failure |
| `supabase/setup-cli` | v3.0.1 | `45a513f8c64c0bc8e0e3dfe572b5c95be85f6359` | Supabase CLI (its own version pinned, §5.1) |

Done by those steps on GitHub's runners (hosts **unverified**, confirmed in the walking skeleton's logs):
- npm packages from the npm registry, exact versions from the lockfile.
- Playwright browsers and their system packages: `npx playwright install --with-deps chromium webkit`.
- The Supabase CLI binary (fetched by `setup-cli`) and the Supabase Docker images pulled by `supabase start`.

checkout and setup-node are new major versions since Supabase's example (`checkout@v4`); their inputs are checked against their READMEs when the file is written.

### 7.1 Local installs (owner: "stays in venv or inside this project only")

On the owner's machine everything goes inside the project folder; nothing global. The `PLAYWRIGHT_BROWSERS_PATH` and npm `supabase` behaviours are **unverified** until the first install:
- npm packages in `node_modules/` (git-ignored), from the lockfile. A project `.npmrc` sets `cache=.npm-cache` (git-ignored), so npm's download cache stays in the project instead of `~/.npm`. The first `npm` command checks that `npm config get cache` points inside the project.
- Supabase CLI as the npm dev dependency `supabase`, run with `npx --no-install supabase`. `--no-install` makes `npx` fail instead of silently fetching a package that is not installed. Not Homebrew.
- Playwright browsers inside `node_modules/` with `PLAYWRIGHT_BROWSERS_PATH=0`, not the default user cache (`~/Library/Caches/ms-playwright`).
- No Python packages are needed. If one ever is, it goes in a `.venv/` in the project (git-ignored).
- **Exception, approved by the owner 2026-10-23:** the Supabase Docker images live in Docker's own storage, which cannot be a project folder. Docker 29 is already installed. Remove them with `npx supabase stop --no-backup` and `docker image prune`.
- Node: the machine has Node 26, CI uses Node 24 (§5.1). `package.json` sets `engines.node` to `>=24` and CI is the reference. Installing a second Node version is not needed.

## 8. Merge protection (Q59: owner, 2026-10-23: make the repo public)

Option b of three (a: keep private, merge by habit; b: public; c: GitHub Pro, price unverified). Public gives free minutes and branch protection on GitHub Free (§2).

**Before the owner switches visibility.** History becomes public too, and a force-push to rewrite it is not allowed (rule 4). Scan on 2026-10-23 (local, read-only, all 17 commits on every local and remote-tracking branch; the local stash, which is never pushed, was scanned too):
- File contents: no keys or tokens, no UID-like strings, no phone numbers, no full dates in the years people are born, only one email (`onboarding@resend.dev`, the vendor's public sender). The two PNG source sheets have no metadata chunks (no EXIF, text or time).
- **Commit metadata** (author and committer, and emails in commit messages): 9 existing commits carry the owner's personal email as both author and committer, and switching to public exposes them. The other 8 use the owner's GitHub `noreply` address as author; 6 of those were merged on GitHub, so their committer is GitHub's generic `noreply@github.com`. Messages contain only `noreply@anthropic.com` (co-author lines). No tags. Changing `user.email` protects only future commits. Removing the address from existing commits means rewriting history and force-pushing, which rule 4 forbids unless the owner decides otherwise.
- **Not scanned:** branches and pull-request refs that exist only on GitHub (for example closed PR #2). Pull-request refs stay public after a branch is deleted. GitHub could not be reached.

**The switch waits until both hold:** (1) the owner explicitly accepts that the personal address on the 9 existing commits becomes public (**accepted 2026-10-23**, plus the commit that added this design, which carries the same address), or approves a remedy (a history rewrite with force-push is the owner's call, not Claude's); (2) **immediately before the switch**, the commit check (below) passes over every commit on all local branches and all GitHub refs, including pull-request refs, except for the address the owner accepted in (1). The 2026-10-23 scan above is not enough by itself: a value added and then removed by later commits stays in history.

**Future commits** (a commit's emails are public the moment it is pushed, before CI runs):
- Owner, in GitHub's email settings: keep the email private and block command-line pushes that expose it. GitHub then refuses such a push, so nothing is exposed (setting names confirmed when set).
- With the owner's OK, Claude sets this repo's local `user.email` to the owner's GitHub `noreply` address.
- Before every push, Claude runs the **commit check** on the outgoing commits. It reads each commit's author, committer and message, and the lines that commit added (`git log -p --diff-merges=first-parent`; merge commits are diffed against their first parent, because plain `git log -p` leaves merge resolutions out, and root commits against the empty tree), so a value added and later removed is still caught. Every email must match the allowlist: any `<id>+<user>@users.noreply.github.com`, `noreply@github.com`, `noreply@anthropic.com`, `onboarding@resend.dev`. Any other address stops the push. One exemption (Q93): an address inside a `"deprecated"` field of `package-lock.json`, which is npm's public deprecation text and not project content; the same address anywhere else still stops the push. Binary files are invisible to `git log -p`, so the check also takes **every binary blob** a commit adds (by git's own binary detection, whatever the name or extension, including ones deleted later). Each must match a `sha256` in `assets/zodiac-sign/source-sheets.json` or `assets/logo/manifest.json` as it is on `master`, not as it is in the range being checked, so a commit cannot approve its own image. **Zodiac sign renders (Q91):** a third manifest, `assets/zodiac-sign/renders.json` (file, sign, type, dimensions, bytes, `sha256` for the 24 WebP renders), is added to this allowlist and to `privacy-scan` (plan §12.2) in its own owner-reviewed PR that reaches `master` **before** any branch adding the WebP files is pushed (T3.9), together with exact-file `.gitignore` exceptions; the files must match it exactly. A new image needs the owner's explicit OK and lands in the manifest first. Scoped owner-authorized exception (Q60, 2026-10-25): after approving this exact logo handoff, the owner explicitly requested committing and pushing it for review. The initial nine non-personal logo PNGs may therefore accompany their reviewed checksum manifest on `chore/vegenus-logo-assets`; validate every file against that manifest before publication. This exception covers only the approved initial logo inventory, not arbitrary new images or later changes. The normal base-branch approval rule remains for subsequent binary additions. Images can also hide inside text (an SVG carrying a photo as a data URI), so any data URI in a commit's added lines whose type is an image, or whose payload is base64, stops the push too, with or without parameters such as a charset and in any letter case. The approved SVGs are pure vectors. Docs describe these URIs in words, never as a literal, so the check does not trip on itself. `privacy-scan` runs the same script in CI as a backstop. Phase 1 adds the other `privacy-scan` patterns (keys, tokens, UIDs, phone numbers) to the same per-commit pass.

**State on 2026-10-28** (read-only API): the repo is public and `master` has an active ruleset that requires a pull request and blocks deletion and force-pushes. Still to add: the required `gate` check and "up to date before merging" (they need the workflow, so in T1.1), and the Actions approval setting below.

**After the switch** (owner, or Claude on request; settings changes are outward-facing): protect `master`. Require the `gate` status check and "branches up to date before merging" (this enforces the §3 merge requirement), block force-pushes and deletions, and require a pull request. Under Actions settings, require approval before workflows run for outside contributors. Exact setting names are confirmed when they are set.

## 9. Sketch (not a file; Phase 1 writes `ci.yml` from it)

```yaml
on:
  pull_request: { branches: [master] }
  workflow_dispatch:
permissions: { contents: read }
defaults: { run: { shell: bash } }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs: { app: ${{ steps.f.outputs.app }} }
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with: { fetch-depth: 0 }
      - id: f
        env: { BASE: '${{ github.base_ref }}' }
        run: |
          if [ -z "$BASE" ]; then echo app=true >> "$GITHUB_OUTPUT"; exit 0; fi
          files=$(git diff --no-renames --name-only "origin/$BASE...HEAD")
          # here-string, not a pipe: under pipefail, grep -q exiting early
          # makes printf fail with SIGPIPE and the else branch would say false
          if grep -qvE '^(docs/.+|[^/]+\.md)$' <<< "$files"
          then echo app=true; else echo app=false; fi >> "$GITHUB_OUTPUT"

  # privacy-scan: no `if`. lint-types, unit, db, e2e, a11y-perf, red-proof:
  #   needs: changes
  #   if: needs.changes.outputs.app == 'true'

  gate:
    if: always()
    needs: [changes, privacy-scan, lint-types, unit, db, e2e, a11y-perf]
    runs-on: ubuntu-latest
    steps:
      - env: { NEEDS: '${{ toJSON(needs) }}' }
        run: |
          printf '%s' "$NEEDS" | jq -e '
            (["changes","privacy-scan","lint-types","unit","db","e2e","a11y-perf"] - keys == [])
            and .changes.result == "success"
            and (.changes.outputs.app == "true" or .changes.outputs.app == "false")
            and .["privacy-scan"].result == "success"
            and ((.changes.outputs.app) as $app
                 | [to_entries[] | select(.key != "changes" and .key != "privacy-scan") | .value.result]
                 | all(. == "success" or (. == "skipped" and $app == "false")))'
```

Values reach the shell through `env`, never through `${{ }}` inside `run`, so a branch name cannot inject commands.

## 10. Tests

Done for this design (scratchpad scripts, not committed):
- `gate` rule: 13 cases (all green; docs-only with skips; skip on an app change; failure; cancelled; `privacy-scan` skipped, failed or missing; `changes` failed; missing `app`; `e2e` missing from `needs`; `e2e` renamed `e2e-old`; an extra job that succeeded; an added job in `needs` that failed). RED: a stub expression `true` passed every input, so the cases that should fail did not. The first rule still passed with `e2e` missing (Codex round 1), and the round-1 rule passed with an added failed job (round 2): RED each time. GREEN: the §9 expression gives the expected result in all 14.
- Commit check (Codex rounds 8-9), in throw-away repos: 10 cases (noreply author and committer; personal author and committer; noreply author with a personal committer; an Anthropic co-author line; a personal email in the message; a message line starting with "d"; no new commits; a private value added then removed; a personal email in an added line; the public Resend sender added; a private value added in a merge resolution and removed later; a root commit; a photo added then deleted; binary content named `.md`; an approved PNG; a photo whose checksum is added to the manifest in the same range; an SVG with a base64 photo, removed later; a plain vector SVG; data URIs with a charset parameter, percent-encoded, in upper case, and base64 of a non-image type). RED: a stub accepted the unsafe cases; the metadata-only version missed the added-then-removed and added-line cases; a line-filter version missed the message line; plain `git log -p` missed the merge resolution; the text-only version passed both unapproved binaries; reading the manifest from `HEAD` let a commit approve its own photo; the base64 SVG passed until data URIs were checked; the first data-URI rule missed the charset and percent-encoded forms. GREEN: all 22. Run over this repo's branches, it reports only the known personal address. Phase 1 commits it as `scripts/check-commits.sh`.
- `changes` classifier: 7 path lists (docs only; docs + root README; an asset; docs + a workflow file; `src/docs/…`; empty; nested `README.md`). All as expected; an empty list gives `app=true`. Rename case (Codex round 3), in a throw-away git repo: `src/app.ts` moved to `docs/app.md`. RED: plain `git diff --name-only` lists only `docs/app.md`, so `app=false`. GREEN: with `--no-renames` both paths are listed and `app=true`. The same script gave a different result under zsh, so the sketch sets `shell: bash`. Large list (Codex round 4), under `bash -eo pipefail` as on the runner: one app path, then 10,000 docs paths. RED: piping into `grep -q` gives `app=false` (SIGPIPE fails the pipeline). GREEN: a here-string gives `app=true`; the 7 lists, the rename, docs-only and empty cases are unchanged.

To write first in Phase 1 (walking skeleton, plan §12.4):
1. A trivial failing unit test, pushed with the owner's OK, shows `gate` **red** on GitHub; the fix turns it green.
2. A PR that skips a heavy job by hand (temporary `if: false`) on an app change shows `gate` red, and so does one that removes a job from `gate.needs` (fail-closed check on GitHub, not only in `jq`).
3. A docs-only PR runs only `changes`, `privacy-scan` and `gate`, and `gate` is green.
4. A PR with a test using `.only` fails `lint-types`.
5. Measured minutes per job, recorded in the progress file and compared with §6.
6. `supabase start -x …` with the §4 exclude list passes the db tests. The hosts the runner contacts are recorded from the logs (§7).

## 11. Alternatives considered

- **A third-party paths filter action** (for `changes`). Rejected: another download to approve, and `git diff` plus `grep` is enough.
- **Separate workflows per job.** Rejected: there would be no single `gate`, and without branch protection the owner would read several checks.
- **`push` trigger on `master`.** Rejected (§3): with the merge requirement, the merged tree is the tested one, so the run would double minutes for no new information; Vercel deploys on its own.
- **Sharded e2e from day one.** Rejected for now: each shard pays Supabase start-up and build again. Shard when a job passes 10 minutes.
- **Dependency review action.** Not used: `npm audit` covers the need without another download. On a public repo the action is free (recollection, **unverified**), so it can be added later if `npm audit` proves too coarse.
