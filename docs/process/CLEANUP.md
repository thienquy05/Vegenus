# Cleanup: close what nothing needs

Long-running things that agents start (dev servers, watchers, databases, browsers, MCP servers, containers) often outlive the task. Rule: **if no agent or person needs it, it is closed.** Agents decide; `scripts/janitor.sh` makes it easy and safe.

## 1. Start long-running things through `run-bg.sh`
```
scripts/run-bg.sh <name> <command...>
```
It starts the command in its own process group, writes its log to `.handoff/logs/<name>.log`, and registers `name pid pgid start-time owner-pid cwd` in `.handoff/procs`. Stop it with `scripts/run-bg.sh --stop <name>` when the task no longer needs it. `--list` shows what is registered.

A process id can be reused by an unrelated process after the first one exits. Before it stops a registered group, `run-bg.sh` checks that the pid still belongs to the group it was registered with; if not, it stops nothing and drops the entry. Where `ps` is blocked (agent sandboxes) the check is skipped.

## 2. `scripts/janitor.sh`
| Command | Effect |
|---|---|
| `scripts/janitor.sh` | Report only, for this repo: registered processes, old `.handoff/` files, sizes of git-ignored folders |
| `scripts/janitor.sh --apply` | Also closes this repo's leftovers: registered processes whose agent session has ended (or whose owner is unknown and that are older than `JANITOR_ORPHAN_HOURS`, default 2), and `.handoff/` files older than `JANITOR_HANDOFF_DAYS` (default 2) |
| `scripts/janitor.sh --system` | Adds a machine-wide report: orphaned agent tool trees, orphaned MCP containers, listening ports, Docker reclaimable space |
| `scripts/janitor.sh --apply --system` | Also closes the orphaned agent tool trees and MCP containers. Machine-wide: it can reach tools that belong to other projects, so run it by hand after reading the `--system` report, never from a hook |

What counts as **orphaned** (never matched by name or port alone, because that can hit your own processes):
- An agent tool process (`app-server-broker`, `codex app-server`, MCP servers) whose parent is PID 1 and older than `JANITOR_ORPHAN_HOURS` and older than every live agent session.
- A container started from an image in `JANITOR_MCP_IMAGES` (default `harness-os:latest`) that is older than every live `docker run` client of that image. Containers named in `JANITOR_KEEP_CONTAINERS` (default `harness_gate_daemon harness_postgres`) are never touched.

Never touched: Docker infrastructure, databases and servers not registered through `run-bg.sh`, anything owned by another user, caches.

## 3. When
- **End of a task:** stop what you started (`run-bg.sh --stop`), then run `scripts/janitor.sh` (report) and close what is clearly yours.
- **Session start and end hooks:** not enabled in this project yet. When they are, the end hook may only run the repo-scoped `--apply` (detached, because hooks have a very short time budget at session end); `--system` stays manual.

## 4. Handoffs
Agents exchange notes in git-ignored `.handoff/`. Name each file `<task>-<topic>.md`. Delete it when the receiving agent has acted on it. Never put secrets or personal data in it (rule 3). The janitor lists files older than the limit.

## 5. Caches and disk
Caches stay inside the repo that uses them (git-ignored). The janitor reports their size; clearing them is the owner's choice. Regenerable large outputs (build output, generated corpora, release bundles) are listed so they can be deleted and rebuilt when needed.

## 6. Tests
`scripts/tests/janitor_test.sh` covers both scripts in a temporary git repo (run it from any folder). The cases that need `ps` skip themselves where `ps` is blocked.
