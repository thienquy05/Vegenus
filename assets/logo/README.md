# Vegenus logo assets

![Vegenus approved emblem, vector export](vegenus-plum.png)

The approved emblem combines two readings: Vega is the swan's eye, and the sweeping body curves suggest a galaxy and its orbit. The decision and name meaning are recorded in [PRD Q60](../../docs/vegenus_PRD.md#12-open-questions-status-and-who-answered).

## Files

| File | Purpose |
|---|---|
| `approved-source.png` | Untouched 1254 × 1254 generated image approved by the owner; visual reference, not a runtime payload |
| `vegenus-plum.svg` / `.png` | Primary emblem: warm ivory and champagne gold on deep plum |
| `vegenus-navy.svg` / `.png` | Gold on midnight navy |
| `vegenus-cream.svg` / `.png` | Dark brown with a gold star on warm cream |
| `vegenus-ivory.svg` / `.png` | Black with a brick-red star on ivory |
| `vegenus-transparent.svg` / `.png` | Ivory and gold, transparent background; use on a dark plain surface |
| `favicon.svg` | Tighter square framing of the same emblem, plum background |
| `favicon-32.png`, `favicon-180.png`, `favicon-512.png` | Raster icon exports at the indicated pixel sizes |
| `manifest.json` | Exact file inventory, SHA-256, byte sizes, dimensions, SVG gzip sizes and palette values |
| `generation-prompt.md` | Original generation prompt and provenance notes |

The five main PNG exports are 2048 × 2048. SVGs contain editable vector paths; they do not wrap or embed a raster image. Paths were traced from the approved PNG with the installed Potrace library, then rendered with Inkscape. The source's tapered strokes are retained as filled contours. Flat export colours replace small generated colour variations; the source remains byte-for-byte intact. These exports do not claim to be the original generator's native vector files.

## Palette

| Variant | Background | Main ink | Vega / eye |
|---|---|---|---|
| Plum | `#24123a` | `#fff8df` | `#e8c875` |
| Navy | `#0a0e2e` | `#e8c875` | `#e8c875` |
| Cream | `#fff1de` | `#4a2c1d` | `#b58b38` |
| Ivory | `#f4f1ec` | `#1a1a1a` | `#b3402a` |

## Use

- Prefer SVG for the website. Retain aspect ratio and the supplied clear space. Use the palette that fits the surrounding surface; do not tint the two colours independently at runtime.
- The approved deliverable is the emblem alone. Earlier script wordmarks and separate swan/galaxy explorations are not part of this approved master. Typeset the name exactly `Vegenus` in surrounding UI when needed.
- Keep the star in the eye position. Do not add a separate galaxy star, extra orbit, feathers, glow, gradients or decorative dots.
- The favicon keeps the approved contours and uses tighter framing. At 32 px, the smallest tapered details soften; inspect on the real browser tab during integration. A separately redrawn micro mark would require a further design decision.
- When used alone as an image, use alt text `Vegenus`; when adjacent to the same visible name, use empty alt text to avoid repetition. If used as a link, the link needs an accessible name and an adequate touch target independently of image size.

## Integrity and privacy

Only files explicitly listed in `manifest.json` belong to this approved asset family. Check SHA-256, dimensions and type against the manifest after any export. SVGs must remain static paths with no scripts, event attributes, external references, fonts, embedded images or animation. PNG exports contain no personal information. The reference image contains generated-art provenance chunks, retained with the untouched source.

The planned privacy checks are described in [plan §12.2](../../docs/plans/vegenus_plan.md#122-workflow-layout-github-actions-proposal) and [CI design §8](../../docs/design/vegenus_ci_spec.md#8-merge-protection-q59-owner-2026-10-23-make-the-repo-public). The owner explicitly authorized publishing this initial approved logo inventory with its checksum manifest (PRD Q60); the scoped exception is recorded in CI design §8. Subsequent binary additions remain subject to the base-branch checksum approval rule. Runtime integration and CI implementation remain separate work.
