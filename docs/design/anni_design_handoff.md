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

## Rules that apply on every device
- No code of any kind in the repo until the owner approves all design previews. Tools stay in the scratchpad or the canvas.
- Installs only into the project `.venv` (git-ignored), after rule-1 approval. The toolkit needs only python3 (standard library) and `cwebp` for images.
- Codex image runs: host `api.openai.com` through the Codex CLI, approved for the whole design system, text-only prompts with placeholders.
- No commit, push or PR unless the owner asks in that moment.

## Status
- Page 1 Home: approved (2026-10-24).
- Menu: circular fan on every size; phone flips the page, tablet/laptop blur it; labels the same 10 px from every icon. Waiting for owner review.
- Next proposed: page 3 Zodiac (bright twinkling star field, no solar system, sign art stands out), then the remaining pages in order.
