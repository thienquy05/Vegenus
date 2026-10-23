# Zodiac sign artwork: Western set

Owner approved storing these 12 original, non-personal constellation illustrations here on 2026-10-22. They are the **built-in default art** that ships with the app (design 3 §3.3 placeholder rule): the Zodiac section shows them until the owner uploads their own art through the dashboard, which is stored as page media in the private bucket, never in Git. The folder spelling `zodic-sign` follows the owner's request.

One transparent square SVG per Western sign, each with a 400 × 400 viewBox. Total: 58,633 bytes; combined individual gzip sizes: 13,528 bytes. No embedded fonts, scripts, external references, raster images, filters or animation. Coordinates are decorative, not scientific star charts. Every `id` is prefixed with the sign (for example `aries-title`, `aries-h`), so the files can be inlined on one page without clashes. `manifest.json` records dimensions, sizes and SHA-256 checksums.

## Status

| Set | Files | Status |
|---|---|---|
| Western (12 signs) | `aries.svg` … `pisces.svg` | Done |
| Vietnamese 12 con giáp | Tý Chuột, Sửu Trâu, Dần Hổ, Mão Mèo, Thìn Rồng, Tỵ Rắn, Ngọ Ngựa, Mùi Dê, Thân Khỉ, Dậu Gà, Tuất Chó, Hợi Lợn | **Required, not started.** Same style, square and transparent, prefixed ids, same safety checks, own manifest |

## Integration contract

- The Zodiac section is about the couple (design 3 §3.10). Signs are computed on the server when the owner saves birth data in the dashboard (Z1) and stored. Guests see only the published snapshot and never enter a birthday (Z2).
- Guests load only the art for the couple's published signs in the system on screen (design 3 §3.3). The images reveal nothing beyond the published signs.
- Keep one square picture per sign. Budget ≤ 150 KB per processed picture; do not inflate these smaller SVGs. Owner uploads are sanitized SVG or rasterized to WebP if the pipeline disallows SVG.
- Static images now; stars, glow and constellation effects come at integration, with a still image for reduced motion.
- Keep the celestial style and elegant serif direction. Pick a licensed Vietnamese-capable web font later; localized names stay in HTML, not in the images.
- The `privacy-scan` CI job (plan §12.2) allows image files here only if they are listed in `manifest.json`.

Validation (2026-10-22): 12 expected signs, XML parsing, square viewBox, no scripts, external references, raster images or event handlers, ids unique and prefixed per sign, every `url(#…)` and `aria-labelledby` reference resolves, manifest sizes and checksums match. Browser rendering verification is still pending.
