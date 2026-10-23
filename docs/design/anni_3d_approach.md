# Design 5: 3D approach

**Status:** v0.5, **approved by the owner 2026-10-23**. Phase 0 design deliverable "3D approach". Replaces plan §7 (its proposals are kept or refined here). No code. v0.2: Codex round 1, 4 findings fixed (context-loss timeout, no horizon arc, nearby events in text only, texture-byte budget test). v0.3: round 2, 2 findings fixed (G8 reduce-motion override, stored World choice). v0.4: round 3, 2 findings fixed (layer rule for View boxes, FPS measured only while animating). Round 4: approve, no material findings. v0.5: owner answered Q57 (basic set first, then rich versions in all four themes equally) and Q58 (rail navigation).
**Date:** 2026-10-23
**Inputs:** PRD §4.1 (S10, S11, S16, S21), §6.4-6.5, §7 (performance, accessibility), FR9, FR13, E2, E17, E18, E26, E30, E41, Q3, Q21, Q50; plan §1-§3, §7; design 2 (G1-G8, Z1, Z2); design 3 §3.10-3.11 (`birth_sky`, `published`); design 4 (token contract, `scene.json`, night panel, decor rule, §7, tests 2, 5, 7).
**Privacy:** placeholders only. Scenes read only what the guest calls already return; no new data, endpoint or third-party host.
**Labels:** **Verified** = read 2026-10-23 on the publisher's own documentation or data (sources in plan §R). **Unverified** = background knowledge; check before relying on it. All numbers marked "proposal" are set from a prototype on the test phones in Phase 4.

## 1. Principles

1. **Content first, 3D second.** Every mode first renders the same DOM content (the Static layout). 3D is loaded after first content and only adds to it. A failed or slow scene never hides content (E17).
2. **3D is decor or navigation, never the only carrier of content.** Text, photos, forms and buttons are DOM in every mode, so fonts, Vietnamese marks, contrast (design 4) and screen readers work the same everywhere. WebGL draws no text.
3. **One WebGL context per page.** One full-viewport canvas; sections draw into it through scissored views. No canvas per section.
4. **Procedural before assets.** The four theme motifs and the night sky are built from three.js primitives and shaders: zero model files to download. Model files (GLB) arrive only with the chibi couple and places map (after core, §9).
5. **Scenes read tokens.** Colours come from the theme's CSS tokens at runtime (design 4 §3); `scene.json` names tokens, never colour values.
6. **Rest when idle.** Render on demand; animate only while something visibly moves; stop when off-screen, hidden or idle.
7. **Mode is decided by rules that can be tested** (§3.2), then corrected by measurement at runtime (§3.3).

## 2. Stack (plan §2 recommendation, unchanged)

three.js via React Three Fiber v9 and drei (all MIT). Features this design relies on, **verified** in the libraries' own docs (read through context7):

| Feature | What it gives | Used for |
|---|---|---|
| drei `View` + `View.Port` | "Views use `gl.scissor` to cut the viewport into segments… multiple views with a single, performant canvas"; each view follows a DOM element as it scrolls and resizes | Page mode: one canvas, a view per section (§4.2) |
| R3F `frameloop="demand"` + `invalidate()` | Renders only when something changes; idle otherwise | Principle 6 |
| drei `PerformanceMonitor` | Averages FPS over fixed time windows; `onDecline` / `onIncline` with bounds; `flipflops` limit, then `onFallback` | Considered, not used: with on-demand rendering a window can hold an idle gap or a short camera flight, so §3.3 uses a small frame-time sampler instead |
| `Canvas dpr` | Device pixel ratio for the canvas | DPR cap (§6) |

No post-processing library (bloom and similar effects cost a full-screen pass on a phone): glow is additive sprites. No physics library.

## 3. Mode selection (FR13)

### 3.1 Signals and what they can tell us (verified, MDN browser-compat-data, 2026-10-23)

| Signal | Support | Use |
|---|---|---|
| WebGL 2 context (`getContext('webgl2', { failIfMajorPerformanceCaveat: true })` on a 1 × 1 probe canvas, released after) | Chrome 56, Firefox 51, Safari 15 (desktop and iOS) | Hard gate: no context → Static |
| `prefers-reduced-motion` | Chrome 74, Firefox 63, Safari 10.1 | Forces Static (design 4 §7, test 7) |
| `navigator.deviceMemory` (GiB, rounded to a power of two, clamped; HTTPS only) | Chromium only (Chrome 63); **not** Safari or Firefox | Low-memory hint where present |
| `navigator.connection.saveData` | Chromium only (Chrome 65); **not** Safari or Firefox | Data-saver hint where present |
| `prefers-reduced-data` | Behind a flag in Chrome; experimental; ships nowhere | Not used |
| `navigator.getBattery()` | Chromium only; removed from Firefox in 52; no Safari. Exposes only level and charging, **no battery-saver flag** | Not used |
| In-app browser (Zalo, Facebook, Messenger, Instagram) | User-agent substrings; the exact strings are **unverified** (checked on real devices in Phase 3, E2/E30) | Caps auto mode at Page |
| Measured frame rate | Everywhere | Runtime downgrade (§3.3) |

Consequence: on iPhones only WebGL 2, reduced motion, the in-app check and the measured frame rate are available. Battery saver cannot be detected on any browser; it is covered by the frame-rate monitor (iOS Low Power Mode lowering the frame rate is **unverified**, checked on the test iPhone). PRD E18's "battery saver" therefore means "if the browser exposes it, else the runtime monitor".

### 3.2 Rules (first match wins; a pure function, test 1)

| # | Condition | Mode | G8 shows |
|---|---|---|---|
| 1 | No WebGL 2 context, or the probe fails the performance-caveat check | Static | World and Page disabled: "3D isn't available on this device" |
| 2 | Reduce motion is on: the G8 switch's value if the guest has set it on this device, else the media query | Static | World and Page disabled: "Turn off Reduce motion to use 3D". The G8 switch starts at the media-query value; turning it off is an explicit choice for this device and overrides the device setting |
| 3 | The guest picked a mode in G8, and 3D has not failed on this device since that pick | that mode if this release offers it; a stored World choice while World is not offered counts as Page | all enabled |
| 4 | `saveData` true | Static | all enabled |
| 5 | `deviceMemory` < 2 (proposal) | Static | all enabled |
| 6 | `deviceMemory` < 4 (proposal), or an in-app browser | Page | all enabled |
| 7 | Otherwise | World once built and kept by the owner (Phase 5 go/no-go); Page until then | all enabled |

- **Cap:** if 3D failed on this device (§3.3) after the guest's last G8 pick (or with no pick), the result of rules 3-7 is capped at the remembered lower mode. A newer G8 pick clears the cap.
- Rules 1-2 are hard: no manual choice overrides them. Rules 4-6 are hints: an explicit G8 choice (rule 3) wins over them.
- G8 lists World only once it is built and kept.
- Remembered per device in `localStorage` (keys hold the mode and a "downgraded" flag only; no token, page id or content). If storage is blocked (E30), the choice lasts for the visit.
- The decision runs before the 3D chunk is requested, so Static devices never download it.

### 3.3 Runtime downgrade (E17, E43)

- **Frame-time sampler.** A sample is the time between two consecutive animation frames of a visible scene; an idle gap is never a sample (on-demand rendering rests on purpose). Samples add up across animations, so repeated short camera flights count in full; the last 120 samples are kept (proposal). Only the first 1 s after a scene mounts is skipped (shader compile); the window is cleared when the DPR or mode changes.
- **Decline:** decided only on a full window (120 samples, about 2-4 s of animation), when its 75th-percentile frame time is above 33 ms (below 30 FPS; proposal). A few stalled frames cannot reach the 75th percentile. First lower DPR in steps down to 1; if still declining, step the mode down (World → Page → Static). DPR never rises again during the visit, so it cannot flip-flop.
- WebGL context lost: call `preventDefault()` so the browser may restore it (MDN), and show the Static presentation of the current section meanwhile (the DOM is already there). If the context is not restored within 3 s (proposal), the visit settles on Static and the cap is recorded. A second loss in the same visit steps the mode down.
- Each step down is remembered (the cap in §3.2) and announced once in a polite live region ("Switched to a lighter view"), with a link to G8. Never automatically up during a visit.
- Switching mode, by the guest or automatically, keeps the route, section, language, open sheet and any unsent input, such as a half-written wish in G6 (E26): that state lives above the mode layer, not in a mode's components. The old scene is disposed (§6.3).

## 4. Modes

### 4.1 Static
The base layout from design 2. The theme's centre object is a 2D SVG drawn from tokens (design 4 §7); under reduced motion it is the still frame. Zodiac uses the 2D Moon (§5.3). No WebGL code is downloaded.

### 4.2 Page (Phase 4)
Normal scrolling layout. One `<Canvas>` fixed behind the DOM (`pointer-events: none`, `aria-hidden="true"`, transparent; pointer events reach the scenes through R3F's `eventSource` on the page container, the pattern drei documents for `View`, so the canvas never blocks scrolling or taps on the DOM; so the CSS `--bg-image` stays the ground and design 4's contrast numbers still hold). Each section owns at most one `View` box:

| Section | View | Content |
|---|---|---|
| G1 Home | Hero box, about 45 % of the viewport height | The theme motif (§4.4), large, with its idle motion |
| G2 Memories, G4 Together, G5 Guestbook | Header band, about 160 px | The same motif family in a small arrangement (A: two drifting orbs; B: a planet arc; C: a block row; D: a wire ring) |
| Z2 Zodiac | Inside the night panel | The Zodiac scene (§5) |
| G3, G6-G11, errors | none | DOM only |

- Text never sits inside a View box (design 4 §3 decor rule: decor never directly behind text). Titles go above or below the box.
- **Layer rule.** The canvas is behind the DOM, so nothing opaque may sit between a View box and the canvas: every ancestor of a View box is transparent over the box's area. Where a section needs its own ground, the scene paints it: the Zodiac night panel's text areas carry the panel background, while its View box is transparent and the scene clears that box to the panel's `--bg`. The View box is kept away from the panel's rounded corners (text areas above and below it), since the scissor is rectangular.
- Views outside the viewport do not render. Touch scrolling is never captured by the canvas; pinch-zoom is never disabled.
- A tap on the motif (for example A's "tap a glowing orb") is optional delight: decorative only, and given a DOM button if it ever carries meaning.

### 4.3 World (Phase 5, after Page mode is evaluated)
The whole site is one scene of **stations**, one per enabled section; disabled sections have no station.

- **Navigation (Q58, owner 2026-10-23): a rail, not free roam.** No joystick, no free camera: one-hand use, no motion sickness, no getting lost. The DOM bottom nav stays.
- **The route is the only state.** Routes are the same as Page mode, and every guest route belongs to one section's station (G3 → Memories, G6 and G7 → Guestbook, G8 opens over any station), so deep links, refresh and Back work as in Page mode. A nav tap, a station tap or a horizontal swipe on the open scene is a normal navigation to a section route. The camera always flies (≤ 1.2 s, `--ease`) towards the current route's station; a newer navigation retargets it, so the latest one wins. On arrival the sheet opens on that exact route (for example the memory detail, not the Memories list) as a DOM sheet on `--surface` over the scene, with the same components as Page mode, and focus moves to its heading.
- **The sheet** has a visible close button (≥ 44 px) and a drag-down handle. Open or closed is screen state, not part of the URL: closing it shows the scene at the same station. While the sheet is open, all gestures belong to it (for example swiping between photos in G3).
- **Per theme layout (proposal):** A floating islands of light; B planets on one orbit, a section per planet; C a toy-block town on a play mat; D a quiet gallery of wireframe plinths. Zodiac's station is the night-sky dome (§5).
- **Photos in the world** (memory thumbnails on frames) need the signed media URLs to be usable as WebGL textures, which needs CORS headers on the storage responses (**unverified**, checked in Phase 2 with the other storage facts, design 3 §3.4). If they cannot be, stations show the motif only and photos appear in the DOM sheet.

### 4.4 Theme scene presets (`themes/<id>/scene.json`)

Design 4 §3 fixed that scenes take colours from tokens; this is the scene side.

```json
{
  "motif": "glass_heart | twin_planets | toy_blocks | wire_sphere",
  "palette": ["--accent", "--text-muted", "--surface-border"],
  "fog": { "token": "--bg", "density": 0.04 },
  "ambient": 0.6,
  "particles": { "kind": "orbs | stars | circles | none", "count": 60 },
  "idle": { "kind": "float | orbit | bob | rotate | none", "speed": 1.0 }
}
```

| Theme | Motif (mood board centre object) | Built from | Particles | Idle |
|---|---|---|---|---|
| A Dreamy | Glowing glass heart | Extruded heart shape with a fresnel shader and an additive glow sprite (no real transmission) | Soft pink and lilac orbs | Float |
| B Cosmic | Two planets on a dashed orbit | Two spheres, a dashed line loop | Star points | Orbit |
| C Cozy | Stacked toy blocks with a heart | Rounded boxes, flat toon shading, one extruded heart | Yellow and mint circles (billboards) | Bob |
| D Elegant | Wireframe sphere with one red dot | Line-segment sphere, one small `--accent` sphere | none | Rotate (slow) |

Token names are resolved with `getComputedStyle` on the theme root when the scene mounts and when the theme changes, so the O3 and "view as guest" previews (design 4 §9) colour their scenes from their own container. Every other value in `scene.json` is a number or a keyword, never a colour, so design 4 test 3 (no hard-coded colours) holds.

**Idle rule:** after 20 s (proposal) without scroll, tap or section change, idle motion eases to rest and rendering stops; any interaction resumes it. Hidden tabs render nothing.

### 4.5 Depth per theme and build order (Q57, owner 2026-10-23)

- **Basic set first, all four themes (Phase 4):** the Home motif, the section header bands, the Zodiac scene (shared, on the night panel) and the 2D Static versions. This is enough to evaluate Page mode in every theme.
- **Then improve during the work, all four themes equally:** the goal is the rich version in every theme (an interactive motif such as tap the orb, spin the planets, knock the blocks; one bespoke scene per section; the theme's World layout in Phase 5). No theme goes first: each improvement step is done for all four themes before the next step starts, and each theme's step is reviewed by the owner.

## 5. Zodiac scenes (S21, Z2; design 3 §3.10-3.11)

The scene sits on the night panel (design 4 §6) in every theme, takes its colours from the panel's tokens, and reads **only the published snapshot** (`published` in design 3 §3.10). The scene's input type has no date, time or place field (test 8).

### 5.1 Basic level (always, when Zodiac is enabled)
- A procedural star field from a fixed seed (not the real sky, so it implies nothing about a date), slow twinkle.
- A ring of 12 sectors: Western signs with each partner's sun sign lit, or the 12 earthly branches with each partner's year animal lit, following the Western / Vietnamese switch. The scene draws only values present in `published`: a partner whose year animal the owner hid (Tết warning, Q49) has no lit branch.
- The two sign artworks with a soft constellation line between them. **Page mode: the artworks are DOM `<img>` elements** (alt text, no texture, no CORS question) placed in the night panel next to the View box. World mode: textured planes; built-in art is same-origin, uploaded art needs the CORS check in §4.3, else the DOM sheet shows it.
- No text in WebGL: sign names, labels and the reading are DOM below the scene.

### 5.2 Sky at birth (only for a partner whose details the owner published; Q50)
A **geocentric ecliptic ring**, matching what `birth_sky` stores (ecliptic longitudes as seen from Earth).

- The ring is the 12-sign wheel; the Sun, Moon and the seven planets sit on it at their stored longitudes (test 9). Ecliptic latitude is not stored and not drawn.
- The Moon is a sphere lit from the Sun's direction. Because both sit on the ring, the lit fraction follows from their angle and matches the stored phase name and illumination to within a few percentage points (latitude ignored); the DOM line shows the stored values, so the text is exact.
- With a birth time and place: bodies flagged below the horizon in `birth_sky` are dimmed. No horizon line is drawn: locating it needs the place and time, which guests never receive. Without a time (`approximate: true`) nothing is dimmed and the DOM line says the values are for midday.
- The ring shows the moment of birth only. Nearby events (design 3 §3.11: an eclipse within 14 days, a conjunction within 3 days, and so on) did not happen at that moment, so they are named in the DOM line only, never drawn on the ring. The one exception is a meteor shower active on the birth date: faint streaks, at most one every 2 s. No effect flashes more than 3 times a second (WCAG 2.3.1).
- One partner at a time, with a switch "[PARTNER_A] / [PARTNER_B]"; a partner without published details has no entry in the switch.

### 5.3 2D and accessible version
Static mode, reduced motion and screen readers get the same facts: a 2D SVG Moon drawn from the stored illumination and waxing/waning (terminator as an ellipse), the composed or owner-written sky line, and a DOM list "Moon: [phase], [n] %, in [sign]; Venus in [sign]; …". This list is the DOM equivalent of the 3D ring and is present in every mode (the canvas stays `aria-hidden`).

### 5.4 Owner screens
Z1 (neutral `/app`) shows the 2D version. The real scene is seen through "view as guest" (design 4 §9).

## 6. Budgets and runtime rules

### 6.1 Budgets (proposals; the former plan §7 numbers kept, new ones added)

| Item | Page mode | World mode |
|---|---|---|
| First content (mid-range phone, 4G profile) | ≤ 3 s, before any 3D request | same |
| 3D code chunk (three + R3F + drei + scenes), gzip | ≤ 300 KB, requested after first content when the browser is idle | ≤ 450 KB incl. world |
| Model and texture bytes | 0 (procedural) | Photo textures reuse the thumbnails already in the 3 MB first-visit budget (plan §3); other textures and models ≤ 1.5 MB, from Vercel |
| Draw calls per frame | ≤ 50 | ≤ 150 |
| Triangles on screen | ≤ 100 k | ≤ 300 k |
| GPU texture memory | ≤ 16 MB | ≤ 64 MB; textures ≤ 1024 px |
| DPR | start 1.5, between 1 and 2 by the monitor | same |
| Frame rate | ≥ 30 FPS sustained on the test phones, else downgrade (§3.3) | same |

Code and site assets come from Vercel (100 GB transfer), not Supabase egress (5 GB), so they do not eat the media budget; only owner uploads come from Supabase.

### 6.2 Renderer settings
`powerPreference: 'default'` (not high-performance, to save battery); `alpha: true`; antialiasing off when DPR ≥ 2 (proposal); instancing for particles and repeated blocks; no shadow maps (fake contact shadows instead); no synchronous GL reads (MDN WebGL best practices, verified; plan §R).

### 6.3 Disposal (E26)
Leaving a mode or a section disposes its geometries, materials and textures; leaving 3D entirely disposes the renderer and releases the context. Ten mode switches end with the same GPU object counts as one (`renderer.info.memory`, test 6).

## 7. Accessibility
- Canvas `aria-hidden="true"`; every 3D thing that means something has a DOM equivalent (World stations = nav buttons; Zodiac ring = the §5.3 list).
- Reduced motion always gives Static (§3.2 rule 2), so no scripted or particle animation runs (design 4 test 7).
- World camera moves happen only when the guest asks, never on a timer.
- Touch targets ≥ 44 px are DOM; nothing interactive exists only in WebGL.
- No flashing above 3 per second; no parallax tied to scroll in Page mode.

## 8. Privacy and security
- No new endpoint: scenes read the page summary and section data already returned by `guest_*`, `public_*`, `account_*` (design 1 §5.1). Zodiac reads only `published`.
- No third-party host at runtime: three.js, decoders (when GLB arrives) and fonts are self-hosted; no CDN, no analytics in the 3D layer.
- `localStorage` holds only the mode and the downgrade flag (§3.2).
- Owner photos are never sent to a 3D or art generator without a specific owner-approved host (PRD §6.4, rules 1 and 3).

## 9. Later: chibi couple and places map (PRD §6.4, after core)
GLB only, geometry compressed (Draco or Meshopt) and textures KTX2, optimised with glTF-Transform, decoders self-hosted (from three.js forum threads, a secondary source in plan §R; still **unverified**). The art tool is undecided (Q20). Their budgets are added to §6.1 when they are designed.

## 10. Alternatives considered
- **A canvas per section.** Rejected: browsers limit live WebGL contexts per page (count **unverified**), each context costs memory, and context loss would hit sections one by one. Views share one context.
- **Free-roam World with a joystick.** Rejected (Q58, owner chose the rail): two-hand control, motion sickness, easy to get lost on a phone.
- **Text and photos rendered in WebGL.** Rejected: loses the self-hosted fonts' Vietnamese shaping, text selection, screen readers and the token contrast checks.
- **A heliocentric orrery for the sky at birth.** Rejected: needs data that is not stored, and shows the solar system rather than the sky the partner was born under.
- **Starting every visit in World.** Rejected: content first and the 3 s rule; World mounts after first content when rule 7 allows it.

## 11. Tests to write first (RED before GREEN; Phase 3 for 1-3, Phases 4-5 for the rest)

1. Mode rules (§3.2) as a table-driven unit test: every row, plus precedence (reduced motion beats a G8 choice; with the media query on and the G8 switch explicitly off, 3D is allowed; a stored World choice gives Page when World is not offered; a G8 choice beats `saveData`; a downgrade after the last pick caps every later result, including the hints; a newer pick clears the cap). Signals are injected, so the test runs without a browser.
2. Static devices never request the 3D chunk (Playwright network log, with WebGL disabled and with reduced motion).
3. First content within budget with the 3D chunk blocked, then allowed: content timing is unchanged (Playwright, CPU throttling, 4G profile).
4. Runtime downgrade: simulated low FPS during animation lowers DPR, then steps the mode down once, announces it once, remembers it, and never steps up during the visit. A healthy scene left idle for 60 s and then animated again is not downgraded. Ten slow 1.2 s camera flights with the scene resting between them do trigger the downgrade. Isolated stalls (5 frames of 200 ms among healthy frames) do not.
5. Context loss (`WEBGL_lose_context`): the current section stays readable; a loss that is never restored settles on Static after the timeout and records the cap (the next visit starts capped); a second loss steps the mode down; no blank screen (E17).
6. Mode switching (E26), by the guest and by an automatic downgrade: route, section, language, open sheet and a partly typed G6 name and message are kept; after 10 switches `renderer.info.memory` matches the count after 1, and the JS heap does not grow (Chromium heap snapshot).
7. Scene tokens: every theme's `scene.json` names only tokens from design 4 §3 and holds no colour literal; the O3 preview scene takes the preview container's colours, not the dashboard's.
8. Zodiac privacy: the scene's input type has no date, time or place field; for a partner without published details, the guest response and the scene receive no `birth_sky` and the scene draws no planets.
9. Sky placement: for a fixture `birth_sky`, each body's angle on the ring equals its stored longitude (±0.5°); the Moon's lit fraction is within 5 percentage points of the stored illumination; bodies flagged below the horizon are dimmed and no horizon line exists. A fixture with an eclipse 5 days from birth draws no Sun-Moon overlap and names the eclipse in the DOM line.
10. DOM equivalence: in Page and World mode, the accessibility tree holds every section's content and the Zodiac list, with the canvas hidden.
11. Budgets (§6.1), in every theme: draw calls and triangles from `renderer.info`; texture memory as the sum of width × height × bytes per pixel (× 4/3 with mipmaps) over the loaded textures, because `renderer.info` counts textures but not bytes. Measured on the heaviest Page view (Home, and Zodiac with details) and, from Phase 5, on every World station; frame rate on the test phones.
12. In Page mode no canvas captures touch scrolling, and the viewport allows pinch-zoom.
13. Layer rule: in every theme, for each View box (Home, header bands, Zodiac), `document.elementsFromPoint` at sample points inside the box finds no element with an opaque background above the canvas; a screenshot of the Zodiac panel shows the scene (it differs from the same panel with the scene not mounted).
14. World navigation: with the G3 sheet open, a photo swipe changes the photo and not the station. With the sheet closed, a swipe moves one station and the URL becomes that section's; refresh and Back behave as in Page mode. Two quick nav taps end with the camera, URL and open sheet all on the second section. A direct G3 link opens the Memories station with that memory's sheet; G2 → G3 → Back shows the Memories list.
