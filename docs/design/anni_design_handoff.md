# Design phase handoff (where everything lives)

**Updated:** 2026-10-24. Read this first when continuing the design round on another device.

## Where things are
| What | Where | How to reach it from Claude Code on any device |
|---|---|---|
| Design previews (all screens, 11 pages, one per section) | Private claude.ai design canvas **"anni Theme Preview"** on the owner's account (link not kept in Git, the repo is treated as public) | `/artifacts` in Claude Code, or the Artifact tool `list`, then `read` |
| Web images used by the canvas (WebP) | Canvas stored files (assets) | Artifact `list` with `scope: "assets"` on the canvas |
| Full-size Codex originals (16 PNG, about 22 MB) | Canvas stored files, names `home-*`, `fab-*`, `bg-*` (.png) | same; never commit them (privacy and size) |
| Scratch toolkit: board generators, label fixer, tag check, static preview, Codex prompts, image map | Canvas stored file `anni-design-toolkit.md` (one Markdown file, each tool in its own block) | Artifact `read` with its asset id from the assets list; save the blocks to a scratch folder, never into the repo |
| Decisions, open questions | `docs/anni_PRD.md` §12 | Git (branch `docs/guest-screens-v3`) |
| Progress and status | `docs/anni_progress.md` | Git |
| Image brief and log | `docs/design/anni_codex_image_brief.md` | Git |
| Rules for this phase | `CLAUDE.md`, `AGENTS.md` | Git |

## Pre-flight checklist (run on the new device before any design work)
Nothing here installs anything; each line is a check. If one fails, stop and tell the owner (rule 1 covers any install, and installs go only into `./.venv`).

| # | Tool | Needed for | Check | Notes |
|---|---|---|---|---|
| 1 | Git + GitHub access to the repo | Getting the docs and rules | `git fetch && git checkout docs/guest-screens-v3 && git log --oneline -1` | Pushes need credentials (an earlier `git fetch` failed without them on another device) |
| 2 | Claude Code signed in to the **same claude.ai account** | Reaching the private canvas, its assets and the toolkit | `/artifacts` lists "anni Theme Preview" | A different account cannot see it. The canvas link is not in Git |
| 3 | Artifact tool (read, publish, assets) | Reading and publishing boards, uploading images | Artifact `list` with `scope: "files"` on the canvas shows `project/canvas.json` | Read the canvas files before editing: someone may have saved on the page |
| 4 | python3 (standard library only) | The toolkit scripts | `python3 --version` | 3.9 or newer is enough; no packages |
| 5 | Codex CLI, signed in, `image_generation` feature on | Making images | `codex --version`; `codex features list` shows `image_generation stable true` | Version used here: 0.160.0. Needs its own sign-in on each device. Host `api.openai.com` was approved for the design system (owner, 2026-10-24) |
| 6 | `cwebp` | PNG to WebP (web versions) | `cwebp -version` | Installed with Homebrew here; if missing, ask before installing |
| 7 | A local browser tool (Playwright MCP) | Rendering boards before publishing | Open `http://127.0.0.1:<port>/…` served by `python3 -m http.server --bind 127.0.0.1` from the scratch folder | `file://` is blocked, so serve over localhost; stop the server afterwards |
| 8 | `sips` (macOS only) | Small previews of the PNGs | `sips --help` | Optional; elsewhere use any image resizer or skip |
| 9 | Rules files | The no-code and `.venv` rules | `grep -n venv CLAUDE.md AGENTS.md` | Read `CLAUDE.md` and `AGENTS.md` first |
| 10 | A scratch folder outside the repo | Toolkit, generated boards, images | A folder the session names as scratchpad, not under `docs/` | Save the blocks from `anni-design-toolkit.md` here |

Hooks may ask extra questions before the first Bash or Write call on a new device (a "fact-forcing" gate was active on the Mac). Answer with the facts it asks for, or ask the owner to relax it; do not work around it.

## Rules that apply on every device
- No code of any kind in the repo until the owner approves all design previews. Tools stay in the scratchpad or the canvas.
- Installs only into the project `.venv` (git-ignored), after rule-1 approval. The toolkit needs only python3 (standard library) and `cwebp` for images.
- Codex image runs: host `api.openai.com` through the Codex CLI, approved for the whole design system, text-only prompts with placeholders.
- No commit, push or PR unless the owner asks in that moment.

## Status
- Page 1 Home: approved (2026-10-24).
- Menu: circular fan on every size; phone flips the page, tablet/laptop blur it; labels the same 10 px from every icon. Waiting for owner review.
- Next proposed: page 3 Zodiac (bright twinkling star field, no solar system, sign art stands out), then the remaining pages in order.
