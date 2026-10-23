# Zodiac sign artwork

Built-in default art for the Zodiac section (design 3 §3.3). It ships with the app until the owner uploads their own art through the dashboard, which is stored as page media in the private bucket, never in Git. All files here are original and non-personal.

## Status

| Set | Files | Status |
|---|---|---|
| Western, approved source sheet | `western/approved-atlas.png` (4 × 3 sheet) | Approved by the owner 2026-10-22; details in [source-sheets.md](source-sheets.md), checksums in `source-sheets.json` |
| Vietnamese 12 con giáp, approved source sheet | `vietnamese/approved-atlas.png` (Tý Chuột, Sửu Trâu, Dần Hổ, Mão Mèo, Thìn Rồng, Tỵ Rắn, Ngọ Ngựa, Mùi Dê, Thân Khỉ, Dậu Gà, Tuất Chó, Hợi Lợn) | Approved by the owner 2026-10-22 |
| Per-sign SVGs (24) | `western/<sign>.svg`, `vietnamese/<branch>.svg`, one `manifest.json` per folder | **Generated; technical checks pass, owner visual approval pending.** 24 per-sign SVGs and two manifests are present; runtime integration is still pending |

The first Western set (12 simple constellation SVGs from PR #2) was removed on 2026-10-22 at the owner's request; it is in Git history (commit `ed249cd`).

## Rules for the per-sign SVGs

- One square SVG per sign, `viewBox="0 0 400 400"`, transparent background, faithful to the approved sheet (no labels or headings inside the image; names stay as localized HTML text).
- File names: Western `aries.svg` … `pisces.svg`; Vietnamese by branch, ASCII: `ty.svg` (Tý), `suu.svg`, `dan.svg`, `mao.svg`, `thin.svg`, `ti.svg` (Tỵ), `ngo.svg`, `mui.svg`, `than.svg`, `dau.svg`, `tuat.svg`, `hoi.svg`.
- Safe SVG only: no `<script>`, no event handlers, no `href`/`xlink:href`, no external `url()`, no `<image>`, no embedded raster (`data:`), no `<foreignObject>`, no animation elements. Every `id` prefixed with the file's sign (`aries-…`, `ty-…`) and every `url(#…)` and `aria-labelledby` reference resolving inside the file.
- `<title>` and `<desc>` in English, with `role="img"`.
- Budget ≤ 150 KB per file (gzip size recorded too).
- `manifest.json` per folder: id, names (EN and VI), file, width, height, bytes, gzipBytes, sha256.

## Integration contract

- The Zodiac section is about the couple (design 3 §3.10). Signs are computed on the server when the owner saves birth data in the dashboard (Z1) and stored. Guests see only the published snapshot and never enter a birthday (Z2).
- Guests load only the art for the couple's published signs in the system on screen (design 3 §3.3); the requests reveal nothing beyond the published signs.
- Static images now; stars, glow and constellation effects come at integration, with a still image for reduced motion.
- The `privacy-scan` CI job (plan §12.2) allows image files here only if they are listed in `source-sheets.json` (the two PNG sheets, never sent to the browser as they are) or in a folder's `manifest.json` (the per-sign SVGs, with the safety checks above).
- Research behind the Zodiac calculations: [research.md](research.md).

## Per-sign vector extraction

The 24 exports are true vector paths traced from the approved sheet figures with the installed Potrace library; no raster images are embedded. Source positions come from `source-sheets.json`, with individual framing adjusted to exclude headings, labels and neighboring figures. Each artwork is centered inside a 400 × 400 transparent canvas with padding. The two PNG sheets and source-sheets metadata are unchanged.

To meet the 150,000-byte limit, traces use a finite blue/silver palette and simplified cubic/quadratic curves. This introduces tonal banding compared with the original soft raster shading, most visibly in the dense Vietnamese engraving. Poses, constellation lines, stars and figure details are traced from the source rather than replaced by new simplified icons. **Visual approval remains pending**; passing the structural checks is not visual approval. No raster fallback or external resources are used.

The checker, trace experiments, 24 transparent renders, source-versus-vector contact sheets and size report are held outside the repository in the task's temporary review folder. No checker script or rendered PNG was added to the repository. The per-folder manifests record exact bytes, individual gzip sizes and SHA-256 values. Recheck these whenever an SVG changes.
