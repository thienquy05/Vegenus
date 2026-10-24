# Codex image brief (for the next session)

**Status:** v0.2, 2026-10-24. Home run done (owner approved the host for the whole design system). Owner chose Codex for the art (Q61) and will continue the run in the next session.
**Branch:** `docs/guest-screens-v3`.
**Privacy (rule 3):** text prompts only. No real names, dates, places, photos, messages or tag ids go to Codex. Nothing from `.env`, `.claude-flow/`, `.swarm/` or `ruvector.db`.
**Network (rule 1):** Codex image generation calls OpenAI's image model through the owner's own Codex sign-in. Before the run, state the host (`api.openai.com`, via Codex CLI) and wait for the owner's go.

## How it will run

1. Claude opens Terminal on the owner's Mac (computer use, owner approves screen access) in `~/Project/anni-demo`.
2. Check the installed Codex version and its image tool: `codex --version`, `codex exec --help` (the image skill is reported as `$imagegen` with `gpt-image-2`; **unverified**, confirm in the help text or the official Codex docs before use).
3. One `codex exec` call per image group below, sandbox limited to writing `assets/generated/` only. Prompt = the group's text from this file, nothing else.
4. Claude checks each file (size, transparency, no text or faces), converts to WebP, and records bytes in §4. The owner approves each image before it replaces a code-drawn shape on the canvas.

## 1. Images to make

| # | File (in `assets/generated/`) | Size | Background | Used on |
|---|---|---|---|---|
| 1 | `motif-a-glass-heart.png` | 1024 × 1024 | transparent | A Home hero |
| 2 | `motif-b-twin-planets.png` | 1024 × 1024 | transparent | B Home hero |
| 3 | `motif-c-toy-blocks.png` | 1024 × 1024 | transparent | C Home hero |
| 4 | `motif-d-wire-sphere.png` | 1024 × 1024 | transparent | D Home hero |
| 5 | `zodiac-galaxy.png` | 1290 × 2796 | opaque | Zodiac, all themes |
| 6-9 | `map-a.png` … `map-d.png` | 2048 × 2048 | transparent | Together map, per theme |
| 10-13 | `fab-a.png` … `fab-d.png` | 512 × 512 | transparent | Menu button, per theme |

Shared rules for every prompt: no text, letters, numbers or logos; no people or faces; no real landmarks or real map geography; soft, clean 3D render; strong depth from a low three-quarter camera angle; even lighting from the top left; PNG.

## 2. Prompts

**1. Glass heart (A, Dreamy).** A single glowing glass heart floating in the air, 3D render, low three-quarter angle with strong depth and perspective. Soft pink (#ff9cbf) glass fading to lilac (#b69cff), light glowing inside it, a bright rim highlight, a small white specular streak on the upper left lobe. A few tiny soft glowing orbs drift around it. Dreamy, gentle, night mood. Isolated on a transparent background.

**2. Twin planets (B, Cosmic).** Two small planets on one thin dashed orbit ring, seen from a low three-quarter angle so the ring tilts towards the viewer. The larger planet is periwinkle blue (#5b7cff) with a faint pale ring, the smaller is rose (#e8679a). A warm gold (#ffe6a8) point of light sits on the orbit. Soft glow, deep space feel without a background. Transparent background.

**3. Toy blocks (C, Cozy).** Three chunky rounded wooden toy blocks stacked like a little tower, colours mustard yellow (#ffd36b), mint (#9ad7c9) and coral (#f7a27c), a glossy red (#e8445f) heart resting on top. Soft clay look, slightly rounded edges, warm and playful, gentle contact shadow under them. Low three-quarter angle. Transparent background.

**4. Wire sphere (D, Elegant).** A precise thin black wireframe globe (meridians and parallels only), one small matte red (#b3402a) sphere sitting on its surface at the upper right. Minimal, editorial, gallery-like, fine lines, slight perspective from a low angle. Transparent background.

**5. Galaxy (Zodiac, all themes).** A tall phone-wallpaper spiral galaxy tilted towards the viewer, two arms and a soft halo, warm white-gold core (#ffe6a8) at about one third from the top, magenta (#e8679a) and indigo (#6b4bd6) dust in the arms, deep navy space (#05071a to #1b2260). Many small stars, none forming shapes. The lower half is calmer and darker so text cards can sit on it. Opaque, no border.

**6-9. Illustrated maps (Together).** A small made-up town as a floating square diorama tile with visible thickness, seen from above at an isometric three-quarter angle. A gentle river crosses the lower third, one park with round trees at the upper right, a few small houses, two curving roads. Leave four open, flat spots (upper left, upper right, lower right, lower left) where photo pins will stand. No labels, no street names, no real geography. Palettes:
- A (`map-a`): dusk purple ground (#3a1d52), lilac water (#6b4bd6), pink edges (#ff9cbf), soft glow.
- B (`map-b`): night navy ground (#141a50), black-blue water (#05071a), dotted periwinkle roads (#8fa0ff), tiny stars around the tile.
- C (`map-c`): sand ground (#ffe3b8), mint water (#9ad7c9), cream roads (#fff7c2), coral roofs (#f7a27c), thick dark-brown outlines (#4a2c1d), toy-like.
- D (`map-d`): white paper ground, thin black ink lines (#1a1a1a), pale grey water (#e6e1d8), architectural drawing style, one red dot (#b3402a) as the only colour.

**10-13. Menu button art (128 px on screen).**
- A (`fab-a`): a glass crescent moon in the same pink-to-plum glass as the heart, three tiny four-point stars in its hollow.
- B (`fab-b`): a small periwinkle planet with a tilted gold ring and a tiny pale moon beside it.
- C (`fab-c`): one chunky isometric toy block, yellow top, mint and coral sides, dark-brown outline, a red heart on the top face.
- D (`fab-d`): a slim black satin bookmark ribbon hanging straight down with a V-notched end, a fine stitched edge, no letters (the "&" is drawn in code).

## 3. After generation (Claude)
- Check: transparent corners where asked, no text, no faces, no recognisable real place; 1 image per prompt, re-run at most once on a miss.
- Convert to WebP (q≈82); targets: motif ≤ 120 KB, galaxy ≤ 250 KB, map ≤ 250 KB, button ≤ 30 KB. Keep PNG masters out of the site payload.
- Design 5 §1 principle 4 ("procedural before assets") and §6.1 ("0 model and texture bytes in Page mode") change if these images ship: proposal in Q61, owner decides.
- Upload the approved WebP to the preview canvas and swap the code-drawn shapes; keep the code-drawn versions as the Static fallback.

## 4. Log (fill in during the run)
| # | File | Codex call (time) | Result | Bytes (WebP) | Owner OK |
|---|---|---|---|---|---|
| 1-4 | home-a-heart, home-b-planets, home-c-blocks, home-d-sphere (768 px) | codex exec, 2026-10-24 | transparent, no text/faces | 127 082 / 101 602 / 60 078 / 159 662 (D over the 120 KB target: recompress in code phase) | pending |
| 10-12 | fab-a, fab-b, fab-c (256 px) | same run | transparent; fab-d made but not used (D keeps the code ribbon) | 14 010 / 14 666 / 8 278 | pending |
| new | bg-a-tall/wide (dusk clouds), bg-b-tall/wide (nebula) | same run | opaque, calm middle | 77 810 / 78 072 / 134 094 / 152 300 | pending |

Prompts used: the Home prompt (photoreal 3D render style, same colours as §2) is kept in the session scratchpad, not in Git. Masters (PNG) stay out of Git and out of the site payload.
| new | bg-c-tall/wide (playroom wall), bg-d-tall/wide (gallery wall) | codex exec, 2026-10-24 | opaque, calm centre | 45 750 / 37 618 / 91 992 / 72 298 | pending |
