# Design 4: Theme system

**Status:** DRAFT v0.13 for owner review. Phase 0 design deliverable "theme system". Replaces the sketch in plan §6. No code. Codex adversarial review rounds 1-10: 20 findings, all fixed (round-by-round log in `docs/vegenus_progress.md`); v0.9 adds a consistency pass over those fixes; v0.10 adds the decor rule (rounds 9-10). v0.11: owner answers Q53-Q55 (2026-10-23); fonts verified and chosen (§8.1). v0.12 (branch `docs/theme-nav-icons`): per-theme icon families and a circular menu replace the bottom bar (owner, 2026-10-23; §2, menu tokens §4, test 12). v0.13: the menu moves to the top left and opens by stepping the page back as a card, so it covers no text; the dashboard uses it too (owner, 2026-10-23; §2, §4, §5, test 12).
**Date:** 2026-10-23
**Inputs:** PRD §4.1 (S2, S11, S21), §6.1-6.2, §7 (accessibility, language), E12, E18, E19, Q3, Q39; plan §6; design 2 (O3, G8, Z2); design 3 §3.1 (`pages.theme`); the owner's mood board (private artifact, read 2026-10-23 with the owner's approval; only colours, font names and layout notes are copied here).
**Owner decisions used (2026-10-23):** designs 1-3 approved; Zodiac art always sits on a night-sky panel; fonts are self-hosted open-licence (OFL) files.
**Privacy:** placeholders only.

**Guest motion supplement (draft):** [connected sections and living backgrounds](vegenus_guest_motion.md), direction recorded in PRD Q69 and reference limits in Q70. It extends this design with overlapping menu/route choreography, grouped content reveals and background treatments for all four themes. Exact motion values remain prototype defaults; the existing contrast checks must be repeated over the new composited frames.

## 1. Principles

**Brand asset handoff:** PRD Q60 records the approved Vegenus swan/galaxy emblem. Use the SVG and PNG exports in [assets/logo](../../assets/logo/README.md). Plum, navy, cream and ivory variants are supplied; the transparent ivory/gold mark needs a dark plain surface. These brand colours are scoped to the logo and do not replace the theme token values or their contrast checks. The emblem is static in all presentation modes. Integration should check its favicon at actual size and give any linked logo an accessible name and touch target.

1. A theme is data, not code: one token file plus one 3D scene preset. Components and scenes read tokens only; no component names a colour, font or duration.
2. Every theme defines every token. A missing token is a test failure, not a fallback.
3. Contrast is part of the token set: each text/background pair a theme can produce is listed and checked (§5). A theme that fails does not ship.
4. Vietnamese is first-class: every font must cover all Vietnamese letters (PRD §7), or it is not used.
5. Motion is a token too, so reduced motion is one switch (E18).
6. Content never depends on the theme: switching theme changes look only (E19).

## 2. The four themes (from the mood board)

The mood board shows one phone home screen (390 × 844) per theme. Each has a centre object that becomes the theme's 3D motif in design 5. The fonts below are the mood board's; three lack Vietnamese and are replaced (§8.1).

| Theme | Feel | Ground | Display / body font (mood board) | Centre object (→ design 5) |
|---|---|---|---|---|
| A Dreamy & romantic | Soft glow, floating | Plum-to-rose vertical gradient, blurred pink/lilac orbs | Cormorant Garamond italic / Nunito Sans | Glowing glass heart; "tap a glowing orb" |
| B Cosmic / night sky | Deep sky, starlight | Navy radial gradient, star dots, one constellation line | Fraunces / Outfit | Two planets on a dashed orbit |
| C Cozy & playful | Warm, toy-like, handmade | Cream with yellow and mint circles | Fredoka / Caveat (handwriting) | Stacked isometric toy blocks with a heart; polaroid photo |
| D Elegant & minimal | Editorial, quiet | Warm off-white, black hairlines | Playfair Display / Inter | Thin-line wireframe sphere with one red dot |

**Navigation: a circular menu at the top left** (owner, 2026-10-23; replaces the bottom tab bar. First placed bottom right; moved top left the same day so it never sits on content or covers text). Items: Home, Memories, Together, Wishes (= Guestbook), Zodiac (S21, when enabled) and Settings (opens the G8 sheet).

- **Closed:** a 56 px round button inside the safe area (16 px from the left and the top, plus `env(safe-area-inset-*)`), styled per theme (`--menu-button-*`, §4) with a menu glyph (three lines; A soft with a sparkle, B thin with a star, C chunky, D hairline with the red dot). The button sits in a reserved top bar, 88 px tall plus the top safe area: page headers keep 88 px clear on the button's side (from the left; from the right when G8 moves the button to the top right) and Home's hero art sits around it. The page scrolls only below that bar; once anything has scrolled, the bar takes the page ground (`--bg`) so scrolled content disappears under its lower edge and never shows beside or behind the button.
- **Open:** the page steps back: it scales to 60 % and moves to the bottom right as a tilted card (`--menu-card-shadow`), uncovering the theme ground. The items fan out over that free ground on a quarter arc from the button, rightwards to downwards (radius 200 px, 52 px bubbles about 11 px apart), so no item or label lies on page text. Each item has a visible label on its own chip (`--menu-item-bg`, `--menu-item-border`, `--text`) that is part of its tap target; the current page is highlighted; the button shows ×. A faint ring traces the arc in the theme's style (A soft glow, B dashed orbit, C chunky dots, D hairline). With Zodiac disabled, five items spread over the same arc. The card itself is inert; a separate transparent layer over it (not focusable, hidden from assistive technology) closes the menu on tap, like ×, which stays the accessible way to close.
- **Icons:** each theme has its own icon family (owner, 2026-10-23), 24 × 24 line icons in the theme's stroke style: A soft rounded with hearts, orbs and sparkles; B thin lines with constellations and planets; C chunky toy shapes; D hairline geometry with one red accent dot. Reviewed by Codex on rendered 22 px images (preview canvas, 2026-10-23).
- **Behaviour and accessibility:** the button is a `<button>` with an accessible name ("Mở menu" / "Đóng menu") and `aria-expanded`. While open, the page card is inert (not reachable by keyboard or screen reader); the menu items and the × button stay reachable; focus moves to the first item, follows the arc order and ends on the × button; Escape or the × button closes the menu and focus returns to the button. Choosing an item closes the menu and lifts the inert state, then focus moves to the destination's main heading (Settings: the G8 sheet's first control). Reduced motion: the page card and items appear in place without the step-back or fly-out (§7).
- **Fallback:** when the fan does not fit (any label would overlap or leave the screen, checked at 320 px and 200 % text), the menu opens as a labelled list sheet anchored top-left instead, over the page with `--scrim`.
- **Reach:** a top corner is not reachable by the thumb when the phone is held in one hand; the owner chose the top left knowing this. A G8 option "Nút menu" moves the button and fan to the top right (mirrored). The items fan towards the middle of the screen, where the thumb reaches.
- **Owner area:** the dashboard (`/app`, Q56) uses the same button and fan with its own items (Overview, Content, Wishes, Settings) in the neutral look.

Tests: §11 tests 5 and 12.

**Transition handoff:** the menu's opening, cancellation and destination selection follow [guest motion §3](vegenus_guest_motion.md#3-menu-choreography). Destination selection overlaps card expansion, background adjustment and incoming content instead of playing three effects consecutively. The fallback list uses the same route/focus rules. Page-mode WebGL Views use still motifs while the card transforms, so a fixed canvas cannot detach visually from the card.

## 3. Token contract

CSS custom properties on `[data-theme="<id>"]`, so any element can be a theme root: `<html>` for the guest site, a preview container inside the neutral dashboard (§9), like the night panel (§6). Names are the contract; values per theme are in §4.

| Group | Tokens | Notes |
|---|---|---|
| Colour: ground | `--bg`, `--bg-image` (gradient or `none`), plus the theme's decor (orbs, sparkles, stars, circles) | **Decor never sits directly behind text or functional graphics** (icons, controls, focus rings, chart or counter marks); anything over decor needs a surface. Contrast is measured against the worst point of the gradient *and* the brightest (dark themes) or darkest (light themes) decor that can sit behind a surface |
| Colour: surfaces | `--surface`, `--surface-border`, `--scrim` | Cards, sheets; `--scrim` sits behind text placed over photos. **Only `--text` may sit on a photo** (on `--scrim`); muted, accent and small labels never do (C and D muted text fall to 4.16 and 3.64 over a black photo) |
| Colour: text | `--text`, `--text-muted`, `--text-on-accent` | `--text-muted` is still body text and must pass 4.5:1 |
| Colour: accent | `--accent` (graphics, large text ≥ 24 px), `--accent-text` (small text, links) | Two tokens because a decorative accent may pass 3:1 but not 4.5:1 (theme C) |
| Colour: lines and state | `--line`, `--focus`, `--danger`, `--success`; optional D-only `--line-gold` (`#927132`, about 4.03:1 on `#f4f1ec`, ≥ 3:1 graphic; used only for the transient Together entrance perimeter hairline, never for text, focus, ordinary borders or the settled map; Q72). Token-completeness tests do not require it in A/B/C or the neutral dashboard | `--focus` ring: 2 px, ≥ 3:1 against every surface it can sit on (`--bg` at its worst point, `--surface`, cards, night panel) |
| Colour: menu (§2) | `--menu-button-bg`, `--menu-button-fg`, `--menu-item-bg`, `--menu-item-border`, `--menu-item-fg`, `--menu-item-active-bg`, `--menu-item-active-fg`, `--menu-card-shadow`, `--menu-ring` | Replaces the bottom bar's `--nav-*` tokens (2026-10-23). Bubbles take the page `--focus` ring |
| Scheme | `--color-scheme` → `color-scheme` (`dark` / `light`) | Native controls and scrollbars match the theme |
| Type | `--font-display`, `--font-body`, `--font-hand` (C only, else = body), `--display-style` (normal/italic), `--display-weight`, scale `--fs-xs … --fs-display` | Scale is shared (§3.1); only the families and display style change |
| Space and shape | `--space-1 … --space-8` = 4, 8, 12, 16, 24, 32, 48, 64 px; `--radius-sm`, `--radius-md`, `--radius-pill` | Spacing is shared; radius is per theme |
| Motion | `--dur-fast`, `--dur-slow`, `--ease`, `--ease-enter`; proposed guest extension: `--dur-route`, `--dur-menu`, `--dur-reveal`, `--delay-stagger`, `--motion-enter-distance`, `--ease-route` | Durations and delays become `0ms`, entrance distance zero under effective reduced motion or Static. Guest extension values and scope: [motion §6](vegenus_guest_motion.md#6-motion-tokens-and-timing-defaults) |
| Elevation | `--shadow` | `none` allowed |
| 3D (read by scenes, not CSS) | `scene.json`: palette (3-5 colours taken from the tokens above), fog colour and density, ambient light, particle style, motif id | Design 5 defines the scene side; this design fixes only that scenes take colours from tokens |

### 3.1 Shared type scale (phone first)

The mood board uses 11 px nav labels and 14 px body text. Raised here for readability, and inputs at 16 px or more so iOS does not zoom on focus (**unverified** platform behaviour, check on the test iPhone).

| Token | Size | Use |
|---|---|---|
| `--fs-xs` | 12 px | Eyebrow lines (uppercase, tracked); menu labels use 13 px semibold |
| `--fs-sm` | 14 px | Captions, metadata |
| `--fs-md` | 16 px | Body, inputs |
| `--fs-lg` | 20 px | Section headings |
| `--fs-xl` | 28 px | Counter number, page titles |
| `--fs-display` | 44 px (A: 52 px) | Couple title on Home |

Line height 1.5 for body, 1.05 for display. Vietnamese stacked marks (for example ặ, ẫ) need room above: display line height is checked with a Vietnamese title in the visual test (E12).

## 4. Token values per theme

Values are from the mood board, except the changes marked **fix** (§5). `--danger` and `--success` are proposals, added to the contrast check in Phase 4.

| Token | A Dreamy | B Cosmic | C Cozy | D Elegant |
|---|---|---|---|---|
| `--color-scheme` | dark | dark | light | light |
| `--bg` | `#24123a` | `#0a0e2e` | `#fff1de` | `#f4f1ec` |
| `--bg-image` | linear 180°: `#24123a` → `#4a2459` → `#934060` (**fix**, was `#a94a6b`) | radial: `#1b2260` → `#0a0e2e` → `#05071a` | none (decor circles `#ffd36b`, `#9ad7c9`) | none |
| `--surface` | `#24123a` at 75 % (**fix**, was white at 14 %) | `#141a50` at 75 % | `#ffffff` | `#f4f1ec` |
| `--surface-border` | white at 28 % | `#8fa0ff` at 35 % | `#e9cfae` | `#1a1a1a` |
| `--text` | `#fff6f0` | `#eef0ff` | `#4a2c1d` | `#1a1a1a` |
| `--text-muted` | `#ffd9e6` | `#c6cbf5` | `#6b4430` | `#555555` |
| `--accent` | `#ff9cbf` (**fix**, was `#ff7fab`) | `#ffe6a8` | `#b9553a` | `#b3402a` |
| `--accent-text` | `#ffd9e6` | `#ffe6a8` | `#a3472e` (**fix**, new) | `#b3402a` |
| `--text-on-accent` | `#24123a` | `#0a0e2e` | `#ffffff` | `#f4f1ec` |
| `--scrim` (under text on photos) | `#24123a` at 70 % | `#0a0e2e` at 70 % | `#fff1de` at 75 % | `#f4f1ec` at 75 % |
| `--line` | white at 28 % | `#8fa0ff` | `#e9cfae` | `#1a1a1a` |
| `--line-gold` (entrance perimeter only; Q72, 2026-10-26) | not defined | not defined | not defined | `#927132` |
| `--focus` | `#fff6f0` | `#ffe6a8` | `#4a2c1d` | `#b3402a` |
| `--danger` / `--success` | `#ffb3b3` / `#b8f0c8` | `#ffb3b3` / `#b8f0c8` | `#a3262e` / `#2e6b3a` | `#a3262e` / `#2e6b3a` |
| `--menu-button-bg` / `-fg` | radial `#ffe3ee` → `#ff9cbf` → `#8e2f6b`, pink glow / `#24123a` | radial `#d6e4ff` → `#5b7cff` → `#101a63`, `#8fa0ff` edge / `#0a0e2e` | `#4a2c1d`, toy shadow / `#ffd36b` | `#1a1a1a` / `#f4f1ec` |
| `--menu-item-bg` / `-border` / `-fg` | `#24123a` at 88 % / white at 35 % / `#ffd9e6` | `#0a0e2e` / `#8fa0ff` / `#c6cbf5` | `#fff1de` / `#4a2c1d` 2.5 px / `#4a2c1d` | `#f4f1ec` / `#1a1a1a` / `#1a1a1a` |
| `--menu-item-active-bg` / `-fg` | `#ff9cbf` / `#24123a` | `#ffe6a8` / `#0a0e2e` | `#ffd36b` / `#4a2c1d` | `#1a1a1a` / `#f4f1ec` |
| `--menu-card-shadow` / `--menu-ring` | white 1 px ring + `#ff9cbf` glow at 35 % / `#ffd9e6` at 30 % | `#8fa0ff` 1 px ring + `#5b7cff` glow at 40 % / `#8fa0ff` dashed | `#4a2c1d` 2.5 px ring + `0 10px 0 #e9cfae` / `#b9553a` dots | `#1a1a1a` 1 px ring + soft shadow / `#1a1a1a` at 45 % |
| `--font-display` / `--font-body` / `--font-hand` | Cormorant Garamond / Nunito Sans / = body | Fraunces / Be Vietnam Pro / = body | Grandstander / Baloo 2 / Patrick Hand | Playfair Display / Inter / = body |
| `--radius-sm` / `--radius-md` / `--radius-pill` | 12 / 24 / 999 | 10 / 20 / 999 | 6 (photo) / 24 / 999 | 0 / 0 / 0 |
| `--shadow` | none (glow via blur) | none | `0 6px 0 #e9cfae` (flat "toy" shadow) | none |
| `--dur-fast` / `--dur-slow` | 300 / 900 ms | 300 / 1200 ms | 150 / 350 ms | 150 / 300 ms |
| `--ease` / `--ease-enter` | ease-in-out (float) / ease-out | ease-in-out (drift) / ease-out | ease-in-out / `cubic-bezier(.34,1.56,.64,1)` (bounce) | ease-out / ease-out |
| `--display-style` / `--display-weight` | italic / 500 | normal / 400 | normal / 600 (+ handwriting accents) | normal / 400 (second line italic) |

**Neutral set** (`themes/neutral/tokens.css`): the screens shown before a theme is known (§9 step 2) and the dashboard `/app` (Q56) use theme D's colour, radius and motion values with system fonts (`system-ui, sans-serif`; no font download). It is held to tests 1-3 like the four themes.

## 5. Contrast check of the mood board (WCAG 2.2 AA)

Computed 2026-10-23 with a standard-library script (WCAG relative luminance; translucent surfaces composited over the worst background point). Text needs 4.5:1; large text (≥ 24 px, or ≥ 18.66 px bold) and graphics need 3:1. The script is not committed; it becomes test 2 in §11.

| Pair | Mood board | Result | After fix |
|---|---|---|---|
| A muted text on gradient light end | `#ffd9e6` on `#a94a6b` | **4.21 fail** | on `#934060`: 5.19 |
| A nav label on white glass | `#ffd9e6` on `#b56380` (composited) | **3.22 fail** | on dark glass at 75 %: 10.97 |
| A nav label on glass over a white sparkle (Codex round 9) | at 40 % glass | **2.53 fail** | at 75 % glass: 6.82 (pink orb 9.20); B over a gold star 5.13; C text and graphics on its decor circles not allowed (accent text there 3.70; accent graphic on mint 2.92, Codex round 10) |
| A body text on light end | `#fff6f0` on `#a94a6b` | 5.08 | on `#934060`: 6.27 |
| C rust as small text | `#b9553a` on `#fff1de` | **4.27 fail** | `#a3472e`: 5.40 (rust `#b9553a` kept for graphics and large text: 4.27 ≥ 3) |
| A accent graphic on gradient light end (Codex round 1) | `#ff7fab` on `#934060` | **2.82 fail** | `#ff9cbf`: 3.42 (dark end 8.80) |
| Text on accent, all themes | see §4 | — | 4.75 (C) to 15.37 (B) |
| Focus ring on bg, cards and menu bubbles, all themes | see §4 | — | 3.0 needed; lowest 5.06 (D) |
| Menu (§2): icons on bubbles and active bubbles, button glyph (3:1); labels on their chips (4.5:1), including over decor on the uncovered ground (v0.13) | see §4 | B gold glyph on the blue button: **2.97 fail** | navy `#0a0e2e`: 5.18; all menu pairs pass; lowest label on its chip 13.68 (A, chip over a pink orb) |
| `--text` on `--scrim` over a pure white and a pure black photo, all themes | see §4 | — | lowest 6.06 (A on white); muted text is not allowed on photos (§3, Codex round 2) |
| B text, muted, eyebrow, gold, nav | — | 7.45 to 16.63 | — |
| C text, muted, nav active/inactive, heart graphic | — | 3.48 (graphic) to 11.32 | — |
| D text, muted, accent | — | 5.06 to 15.45 | — |
| Zodiac night panel text (§6) | `#eef0ff` on `#0a0e2e` | 16.63 | — |

The fixes keep each hue and only darken. They need the owner's eye (Q53).

## 6. Zodiac night-sky panel (owner, 2026-10-23)

The approved blue celestial art (`assets/zodiac-sign/`) is never recoloured. In every theme the Zodiac section (Z2, and the Z1 preview) sits on a **night panel**: a scoped override `[data-surface="night"]` that sets the colour tokens to theme B's values. Fonts, radius and motion stay the page theme's, so the panel still belongs to the page.

- **Full page (owner, 2026-10-23 v3, confirmed in Zodiac v4, 2026-10-24):** in every theme the night sky is the whole Zodiac page, not an inset block. The earlier rule (A, C, D: a block with `--radius-md` and a 16 px margin) is replaced. The page still belongs to its theme through fonts, radius, the menu button and the accent glow around the sign art.
- **Tone, not colour (owner, 2026-10-24):** the owner asked for brighter sign art. Allowed: a brightness change only (no hue, saturation or palette change), per system (Con Giáp less than Cung Hoàng Đạo); in the code phase it is baked into the exported images, not applied as a runtime CSS filter. A soft glow around the art in the theme accent is decoration, not recolouring.
- The 3D sky-at-birth scene (design 5) uses the same panel tokens.
- Owner-uploaded replacement art (design 3 §3.3) is shown on the same panel; the upload screen says so.

## 7. Reduced motion, data saver and modes

- Effective Reduce motion (G8's explicit choice when set, otherwise `prefers-reduced-motion`, design 5 §3.2) sets all durations and delays to `0ms`, entrance distance to zero, and swaps animated decor (orbs, stars, blocks, sphere) for its still frame. The page stays fully usable (E18). G8 can explicitly override the system preference, as already specified in design 5.
- Static mode (no WebGL) uses the same tokens; the centre object is a 2D SVG drawn from tokens, as on the mood board.
- The theme never decides the mode; FR13 does.
- The proposed guest motion handoff makes Static fully still, including CSS backgrounds, menu effects and smooth scrolling. New ambient motion pauses for menus/forms/sheets/tours and stops when hidden or idle. A mid-transition motion change settles the destination while retaining focus, scroll and input ([motion §§6-7](vegenus_guest_motion.md#6-motion-tokens-and-timing-defaults)).

### 7.1 Connected backgrounds (draft)

[Guest motion §5](vegenus_guest_motion.md#5-dynamic-backgrounds-by-theme) defines the theme-specific compositions: A soft light fields and orbs; B a sparse star field, haze and recurring orbit; C layered cream, yellow/mint shapes and soft paper shadows; D a quiet tonal plane and hairline arc. Preserve the ground across section routes and change only its decorative composition. The approved logo stays static. These layers share design 5's budgets and obey §3's decor exclusion rule throughout movement; existing static contrast results do not approve their new frames.

## 8. Fonts (owner: self-hosted OFL)

Self-hosting means no request to a font CDN, so the guest's network address is not sent to a third party. The mood board loads Google Fonts directly; the site will not.

### 8.1 Vietnamese coverage

**Verified 2026-10-23** in two ways. First, the licence and `subsets` lines of each family's `METADATA.pb` in the official `google/fonts` repo (read-only). Second, a rendered Vietnamese specimen in a browser (scratchpad, not committed), which showed which families loaded a Vietnamese face. Q54: the owner asked Claude to choose creative fonts that match each theme.

| Theme | Role | Family | Licence | Vietnamese | Why |
|---|---|---|---|---|---|
| A | display / body | Cormorant Garamond (italic) / Nunito Sans | OFL | yes / yes | Mood board, kept |
| B | display | Fraunces | OFL | yes | Mood board, kept |
| B | body | **Be Vietnam Pro** (replaces Outfit) | OFL | yes | Clean modern sans like Outfit; designed by Vietnamese type designers, so the stacked marks sit naturally |
| C | display | **Grandstander** (replaces Fredoka) | OFL | yes | Bouncy, chunky, toy-like: matches the stacked toy blocks |
| C | body | **Baloo 2** (replaces Fredoka) | OFL | yes | Rounded cousin of Fredoka, readable at 16 px |
| C | handwriting | **Patrick Hand** (replaces Caveat) | OFL | yes | Casual pen hand, compact like Caveat, for polaroid captions and notes |
| D | display / body | Playfair Display / Inter | OFL | yes / yes | Mood board, kept |

Rejected: **Outfit**, **Fredoka** and **Caveat** have no Vietnamese subset (`METADATA.pb`), and in the specimen letters such as ỏ, ủ, ừ, ặ, ữ fell back to another font mid-word. Also considered: Lexend (B; wider, less like Outfit), Quicksand (C; too light), Pangolin, Itim, Mali (C handwriting; wider or more formal than Caveat), Sora (no Vietnamese).

C now uses three families (one weight each for display and handwriting), so its share of the §8.2 font budget is measured first in Phase 4.

### 8.2 Loading rules

- WOFF2 only; subsets latin + latin-ext + vietnamese; only the weights in §4 (2-3 files per family).
- Only the active theme's fonts load; `font-display: swap`; preload the body font only.
- Budget (proposal): ≤ 150 KB of font files per theme on first visit, measured in Phase 4.
- Fallback stack per role (serif display → `Georgia, serif`; sans body → `system-ui, sans-serif`; handwriting → body stack) so text is readable before the font arrives.
- Before a family is adopted: confirm its licence is OFL and its Vietnamese coverage from the official `google/fonts` folder (`METADATA.pb`, `OFL.txt`). Each family's `OFL.txt` is committed next to its files. Downloads go through rule 1 (exact URL, owner approval) in Phase 4.
- Text is stored and rendered in NFC (PRD §7, E12), so composed letters are what the fonts must cover.

## 9. How a theme is applied

1. `pages.theme` (design 3 §3.1, enum `a_dreamy` … `d_elegant`) comes back in the page summary of every open call: `guest_open` (token), `public_open` (Published page) and `account_open` (signed-in guest account), design 1 §5 and §5.1.
2. G0 (Opening), G11 (guest sign-in, which a returning guest can open without a token) and the error screens G-E1 to G-E3 use the neutral set, because no theme is known before the access check passes (and the error screens must not hint which page a token belonged to). The first content screen sets `data-theme` on `<html>` and loads only that theme's token file and fonts.
3. Per theme, the repo holds `themes/<id>/tokens.css` and `themes/<id>/scene.json` (paths are proposals until the stack is fixed in Phase 1).
4. The owner/co-editor dashboard (`/app`) uses one fixed neutral look (Q56). The O3 wizard preview and the "view as guest" preview are containers with their own `data-theme`; they load that theme's token file and fonts, and the dashboard around them stays neutral.
5. Changing the theme (E19) changes only `pages.theme`; no content is touched.

**Adding a theme:** new enum value (migration), `tokens.css`, `scene.json`, its contrast pairs, its fonts (rule 1), its six menu icons and menu tokens, and a preview. No component changes; if one is needed, the token contract is missing something.

## 10. Alternatives considered

- **A JavaScript theme object (CSS-in-JS).** Rejected: CSS custom properties work in Static mode without JavaScript, and the 3D layer can read them through `getComputedStyle`.
- **Following the phone's light/dark setting inside each theme.** Rejected for now: each theme's mood depends on its ground (A and B are night themes, C and D day themes), and a second scheme doubles the contrast work (Q55).
- **Recolouring the Zodiac art per theme.** Rejected by the owner (2026-10-23); tracing banding would show more.

## 11. Tests to write first (RED before GREEN, Phase 1/4)

1. Every theme file defines every token in §3 (fails on a missing token).
2. Contrast, token level: every pair in §5 in every theme, plus the night panel, meets its threshold (the §5 script becomes this test). Contrast, rendered: an automated accessibility scan of each screen and theme combination in test 5, including nav, cards, text on photos (scrim) and the night panel, so a pair missing from the list still fails.
3. No hard-coded colour, font family or duration outside `themes/` (lint rule).
4. Font coverage: for each font role and weight, the **union** of the files loaded for it (subsets split by `unicode-range`) covers every Vietnamese letter (all precomposed vowels with tone marks, both cases, plus đ/Đ). Plus a rendered check: a Vietnamese sample, entered decomposed and saved, comes back NFC and renders without a fallback font. The check must read the font files' character maps: the browser's `document.fonts.check()` returned `true` for Outfit, Fredoka and Caveat with Vietnamese text in the 2026-10-23 specimen, so it cannot detect missing coverage. Tool chosen in Phase 1; adding one is a rule-1 install.
5. Visual: **every screen in design 2**, with its states (loading, empty, error, form validation, open sheets and dialogs).
   - Themes: G1-G10, Z2 and the first content screen after a G11 sign-in in all four themes; G0, G11, G-E1 to G-E3 and owner screens (O*, Z1) in the neutral set; the O3 and "view as guest" previews in each of the four themes.
   - Sizes: 390 × 844, and 320 px wide with text at 200 % (WCAG 1.4.10 reflow, 1.4.4 resize text).
   - Content: maximum-length Vietnamese titles and labels (E12).
   - Pass: no clipped marks, no horizontal scroll, controls still usable.
   - A screen added to design 2 joins this test in the same unit of work.
6. Theme switch (E19): a snapshot of the whole `pages` row (by `id`) and of every row carrying the page's `page_id`, in every table of design 3 (content, media, guestbook, `partner_profiles` and its published snapshot, and the access rows `memberships`, `guest_tokens`, `guest_accounts`), is identical before and after the switch, except `pages.theme`, `pages.version` and `pages.updated_at`. The snapshot covers every page-scoped table that exists at that phase; the migration that adds one (for example `guest_accounts`, `partner_profiles`) adds a populated fixture to this test in the same unit of work; Home, one memory with media and (once built) Zodiac render the same text and images in both themes; the contrast tests still pass.
7. Reduced motion, data saver, battery saver (E18): for each trigger (media query, G8 switch, data saver, battery saver where the browser exposes it), the chosen mode is the expected one, no WebGL scene renders frames or animates, no scripted or particle animation runs, and no CSS animation or transition longer than 0 ms runs.
8. Focus ring: tabbing through every interactive element in every theme and in the neutral set shows a ring that meets 3:1 against the surface it sits on (bg, card, nav, night panel).
9. Night panel: the Zodiac section uses theme B colour values in all four themes; the art files are byte-identical to the manifest.
10. Preview isolation: switching the O3 preview through all four themes leaves the dashboard's computed tokens and fonts unchanged (neutral set).
11. Theme on every entry path: `guest_open`, `public_open` and `account_open` each return the page's theme, and the first content screen renders in it.
12. Circular menu (§2), in every theme: the button has an accessible name and `aria-expanded`; while open, Tab and the screen reader reach only the menu items (in arc order) and the × button, which can be reached and activated; Escape and the × button close it and focus returns to the button; activating each item closes the menu, the page is no longer inert, and focus lands on the destination's main heading (Settings: G8's first control); at 320 px and at 200 % text the list fallback is used and nothing overlaps or leaves the screen; while open, no menu item or label overlaps text on the page card (bounding boxes, every theme, on Home, the longest section page, Zodiac, the G8 sheet and both dashboard looks, including focus order there); a tap on the card closes the menu while the card stays inert; with the button in either corner, closed and after scrolling, no page text is under, beside or behind it; with reduced motion nothing animates: the page takes the open pose at once without tilt (translate and scale only, so the menu items stay uncovered) and the items appear in place without the fly-out (matches the canvas Menu note, 2026-10-23); the "Nút menu" option mirrors it to the top right. Manual, Phase 4 on the test phones: taps on each item with the phone held normally, 20 taps; more than one miss means switching to a two-ring layout.
