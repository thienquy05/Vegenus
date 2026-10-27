# Guest motion: connected sections and living backgrounds

**Status:** DRAFT v0.2 on `docs/guest-screens-v3` (§10 signature entrances added 2026-10-26). Documentation only. Owner direction and open questions: PRD §12, Q69-Q70. Numerical values below are prototype defaults, not measured reference values or owner-approved final timings. Existing approvals for designs 2 and 5 do not approve this supplement.
**Inputs:** [screens](vegenus_screens.md), [theme system](vegenus_theme_system.md), [3D approach](vegenus_3d_approach.md). This document supplies the missing choreography between their screens, menu states and scene motifs. It does not change access rules, content, routes or the Static → Page → optional World delivery order.
**Privacy:** placeholders only; reference sites receive no guest content or uploads.

## 1. Reference study and evidence

**Owner observation:** the connection between sections, scrolling and menu navigation on [GetLayers](https://www.getlayers.ai/) makes the movement feel continuous. This is the requested quality to translate to Vegenus.

**Verified from public page text:** the homepage groups templates, scenes, gradients, interactive sections and backgrounds into a common library, followed by a staged product explanation. The following public descriptions provide useful motion references; they do not establish how the homepage itself is animated.

| Reference | What the publisher describes | Vegenus interpretation (proposal) |
|---|---|---|
| [Roadmap Ascent](https://www.getlayers.ai/layer/roadmap-ascent) | A pinned timeline with a moving illuminated marker and changing milestones | Together keeps a visible line connecting milestones; reveal a nearby marker with its content |
| [Cards Cascade](https://www.getlayers.ai/layer/cards-cascade) | Cards change orientation and move through a continuous sequence beside an editorial area | Preserve a memory thumbnail's visual identity when opening its detail |
| [Strigil](https://www.getlayers.ai/layer/strigil) | Warm and cool colour fields smear along an axis | Let a soft theme wash carry across section changes |
| [Komorebi](https://www.getlayers.ai/layer/komorebi) | Soft leaf shadows and light respond to interaction | Give Cozy a restrained light/shadow layer in decorative margins |
| [Image Motion](https://www.getlayers.ai/tools/image-motion) | Configurable image arrangements such as rings, tunnels and decks | Coordinate media as a group; keep guest photos upright and readable |

**Evidence limit:** live scroll, menu gestures, mobile rendering, easing and frame rate were **not verified**. The available web reader exposed text, not animation playback; an executable browser was not available through the session's browser tools. No claim here that GetLayers uses a particular router, transition engine or homepage animation technique. No premium prompts, source assets or packages were downloaded. Q70 tracks a future visual comparison; all choreography below is an original proposal informed by the owner's observation and the public descriptions.

## 2. Continuity contract

The guest should feel that sections occupy the same setting. Three elements carry that feeling: a persistent theme ground, a repeated motif, and overlapping movement of the outgoing and incoming content.

- **Persistent ground:** keep the base colour and decorative composition mounted across authorized guest routes for the same page and theme. Preserve motif phase through navigation; do not restart stars, orbs or gradients from frame zero on every click. G0 and access errors still use the neutral ground until access succeeds.
- **One shared transition:** menu close, outgoing content, background adjustment and destination entrance use one progress interval. Never wait for a complete exit, then a complete menu close, then a separate entrance.
- **Stable reading area:** text and controls sit on their tested surfaces. Content may enter with a small translation and opacity change, then stays still. Background motion never moves a reading column or a focus target.
- **Route authority:** the route decides destination and active menu item. Motion follows it; completion callbacks never navigate. Keep existing section routes, Home shortcuts and optional World stations. Ordinary scrolling does not change routes or history; no mandatory snap points, pinned reading sections or artificial scroll distance.
- **Same family, different density:** Home has the fullest composition; content sections retain a quieter version of it; forms and Settings keep the background still. The approved Vegenus emblem remains static in every state.

### 2.1 Scrolling within a section

Use normal native scrolling. Related content enters as a group: heading and divider, then at most the first three nearby cards, with a short stagger. Default content is visible; only an already initialized motion layer may briefly decorate its entrance. Never leave content hidden while waiting for an observer, image or animation chunk.

Use one entrance per group per route visit. Reverse scrolling, restoring Back/Forward and loading another page of memories do not replay the whole screen. A newly loaded group can appear once without moving existing content. Jumping far down or focusing a control immediately shows that content at its settled position.

Together's line is present before animation; a marker may brighten as its milestone enters. Headers use the same motif shape as Home, with a quieter arrangement. No scroll-driven parallax, camera zoom, page pinning, horizontal scroll interception or letter-by-letter text reveals. This preserves design 5 §7 while connecting nearby content visually.

## 3. Menu choreography

Keep design 4 §2's reserved top bar, corner choice, 60 % page card, labelled fan and list fallback. The background belongs to the viewport; only the content card steps back.

| Action | Shared movement | End state |
|---|---|---|
| Open menu | Begin the page step-back and reveal the ground together. Fan items appear during the middle of that movement; the faint ring is already present underneath. Do not restart the background | Page inert, menu focus trapped, current item highlighted |
| Close with ×, Escape or card tap | Reverse from the current visual position; fan folds as the card returns. A close during opening reverses immediately | Same route and scroll position; focus returns to menu button |
| Select another section | Acknowledge the item immediately. Fade outgoing card content during the first 35 % of the route interval; settle the background toward the destination throughout; reveal destination content from 20 % onward while the card expands. Finish together | One active route and heading, menu closed; focus on destination heading |
| Select current section | Perform ordinary menu close; preserve scroll and content state | No reload, history entry or entrance replay |
| Select Settings | Close menu and open G8 over the current section in the same interval; keep that section's scene phase and scroll | Background at rest; focus on first G8 control |

The interval does not delay fetching or routing. Once the destination shell is ready, remove menu inertness, make that shell interactive and move focus without a scroll jump; a focused element skips its remaining entrance movement. While the shell loads, retain a stable surface with a readable loading state and immediately usable controls. Never hold a blank page awaiting media or a complete animation.

The fixed WebGL canvas cannot be assumed to shrink with the DOM card. In Page mode, while the menu transforms the card, pause and hide its section Views and show the token-based still motifs in those boxes. The persistent CSS ground stays visible. Restore the current View at its preserved phase when the card settles. Do not capture guest photos into screenshots or create a second canvas to fake this effect. The still/live handoff is a required visual check.

The list fallback follows the same timing and destination rules but omits page scale, tilt and arc travel. Reduce motion omits all movement in both menu layouts.

## 4. Section handoffs

These handoffs apply from any permitted link or menu item, including non-adjacent sections. They do not prescribe a new reading order or add automatic next-section navigation.

| Journey | Connection to preserve | Arrival / return |
|---|---|---|
| G1 Home → G2 Memories | Retain the theme ground and motif phase; reduce the large Home composition to the header's quieter density | Grid surface enters as one group; first cards overlap its arrival |
| G2 → G3 memory detail | If the visible thumbnail is already decoded and the same authorized image is used, carry its crop and frame into the detail image box | Title appears alongside the image transition. Back restores the actual list position and invoking card; fall back to a short surface fade if the card/image is absent |
| Any section → G4 Together | Carry the motif's line/ring language into the timeline's decorative line | Heading and first milestone settle together; dates and counter values render immediately without count-up |
| Any section → G5 Wishes | Soften the background to the content density; reuse the same surface entrance as Memories | Approved messages remain stable; no floating message text or automatic carousel |
| G5 → G6 → G7 | Keep the Wishes setting and use the same sheet edge for entry and exit | Still while typing. Confirmation follows server success only; no animation delays errors or rate-limit messages |
| Any section → Z2 Zodiac | Transition to the full-page night sky required by design 4 §6; keep the theme identity through fonts, controls and accent glow | Reading text stays on its contrast-tested glass surface over the sky (Q61). Never recolour or dissolve sign artwork through intermediate colours |
| Z2 Western ↔ Vietnamese | Preserve the full-page sky and its phase; change the sign group and reading together | Short opacity change only; no wheel spin. Show only fields present in the published snapshot |
| G8 Settings / G9 tour | Preserve the underlying section and its position | Pause ambient motion while overlay is open; closing restores focus to the invoker |
| Direct link, refresh, Back/Forward | Render the actual destination without inventing an origin | No Home fly-through; restore scroll and focus where applicable, skip entrance replay |

Shared-image motion is an enhancement with a plain fade fallback. It never triggers a full-resolution photo fetch just for a transition, bypasses expired media authorization, auto-plays video or forces the user to wait for image decode. G3 photo swipe remains distinct from route navigation and World station gestures.

## 5. Dynamic backgrounds by theme

Use three layers: the existing tested base ground; a small decorative atmospheric layer confined to safe empty areas; and existing section motif Views. Keep the base stable across navigation. Atmospheric shapes can shift on a section change and drift briefly after interaction, then settle. More depth comes from composition and continuity, not extra simultaneous effects.

| Theme | Background treatment | Connection through navigation | Still version |
|---|---|---|---|
| A Dreamy | Two broad plum/rose light fields and a few soft orbs near the outside edges; use existing theme colours | Light fields change balance as the card expands; one orb cluster remains a visual anchor between Home and headers | Same fields and orb arrangement, no drift or pulsing |
| B Cosmic | Navy ground, one restrained haze band and a sparse fixed-seed star arrangement; keep bright stars away from reading areas | The same orbit/constellation line recurs in menu and headers; section change gently adjusts haze opacity. Zodiac uses a full-page night sky with theme B colour tokens in every theme | Same stars and line at fixed phase; no twinkle |
| C Cozy | Cream ground, overlapping yellow/mint shapes in margins, a soft paper-shadow shape suggesting light through leaves | Shapes regroup with the destination header; a small toy-like settle is confined to decorative objects | Same layered shapes and shadows; no wobble or moving grain |
| D Elegant | Ivory ground, a faint broad tonal plane made from existing tokens, one hairline arc and the motif's red dot in empty space | Arc alignment changes subtly on navigation; generous empty space connects sections | Same plane and line; no ambient rotation |

Keep colour sources in the theme tokens; no new palette is approved here. Each theme has the same complete handoff before adding richer scenes to any one theme (Q57). No autoplay background video, full-screen fluid simulation, pointer trail, device tilt or sound. Background changes require neither hover nor pointer precision.

**Contrast across time:** decor must never cross unprotected text, functional icons or focus rings, including during a menu transform. Existing design 4 colour checks are not proof that a new composited frame passes. Test every extreme composition and intermediate blend against the existing thresholds; keep an opaque reading surface where necessary. With 200 % text or narrower reflow, remove decorative shapes before shrinking content. Keep the reserved top bar opaque after scrolling. Zodiac uses the full-page night sky from design 4 §6, with theme B colour scope and the page theme's fonts, controls and accent glow; do not restore the superseded inset margin.

## 6. Motion tokens and timing defaults

Extend design 4's token contract with the following proposed values. Store them with theme tokens at implementation; do not hard-code durations in components. Existing `--dur-fast` / `--dur-slow` remain for local effects and scene pacing; they must not make route navigation wait for a 1.2 s ambient cycle.

| Token / use | A Dreamy | B Cosmic | C Cozy | D Elegant |
|---|---|---|---|---|
| `--dur-route`: complete menu-to-section or section-to-section interval | 480 ms | 560 ms | 360 ms | 300 ms |
| `--dur-menu`: opening or closing without navigation | 320 ms | 360 ms | 280 ms | 220 ms |
| `--dur-reveal`: nearby content group | 280 ms | 320 ms | 240 ms | 200 ms |
| `--delay-stagger`: first three items only | 40 ms | 45 ms | 35 ms | 30 ms |
| `--motion-enter-distance`: content entrance maximum | 12 px | 12 px | 8 px | 6 px |
| `--ease-route`: route and menu continuity | cubic-bezier(.22,1,.36,1) | same | same | same |

No bounce on reading surfaces, focused controls or whole-page navigation; C may use its existing bounce only for small decorative objects. Ambient drift uses design 5's scene pacing and stops under its idle rule (20 s proposed maximum without interaction); D has no autonomous atmospheric drift. Pause ambient motion whenever the menu, a sheet, a form or the tour has focus. Hidden/off-screen work stops immediately; returning to the tab shows the last settled state without catch-up animation.

Static mode and effective Reduce motion use **0 ms** for every duration and delay, zero entrance distance, no smooth scrolling, no phase drift and no scripted animation frames. G8's explicit motion choice continues to override the system preference as specified in design 5 §3.2. Until that choice is known, use the system preference. Changing Reduce motion during a transition immediately settles the current destination without losing focus, scroll or input.

## 7. Interruptions, loading and access

- **Latest destination wins:** a second navigation retargets from the current visual state; cancel obsolete callbacks and loading results. Do not queue journeys. Opening/closing repeatedly must never strand the page inert or leave two accessible headings. Back/Forward cancels a pending visual handoff and restores the browser's destination.
- **One accessible screen:** an outgoing visual layer is inert and hidden from assistive technology; it cannot submit, play media or receive focus. Remove it at the end of the interval. It is optional: skip duplication for forms, private detail, loading, failures or memory pressure. Never snapshot a form containing unsent input.
- **Slow network:** show the destination's stable shell and loading text; stop after the normal interval. A late response fills the content once without repeating the route transition. Images reserve their layout space. Errors are immediately usable.
- **Disabled/removed section:** omit it from menu and Home shortcuts. If a stale link reaches it, use the existing unavailable state; do not render hidden content for an animation.
- **Access failure or revocation:** immediately remove protected DOM, outgoing visual layers, scene resources and pending media work, and show the neutral access state. No decorative fade retains protected content. Issued media URLs still have the existing expiry limitation; this does not change Q29.
- **Sign-in, code and updates sheets (guest UI §11, G20–G27):** use the standard sheet entrance; nothing plays on arrival and nothing blocks reading. Field errors change border colour and reveal text in 160 ms without shake; success is a check that fades and scales in 200 ms. Reduced motion: no movement, static check, spinner replaced by “Sending…”. An interrupted sheet (route change, access failure) is removed immediately with its typed values discarded, never persisted.
- **Runtime downgrade:** keep current route, focus, scroll, sheet, language and unsent wish; settle the background, dispose 3D as in design 5 and continue with the still composition. A mode change must not resubmit a form.

## 8. Phone budgets and implementation boundaries

Preserve design 5 §6: first content ≤ 3 s on the target phone/4G profile, ≤ 3 MB first-visit media, Page 3D gzip ≤ 300 KB, ≤ 50 draw calls, ≤ 100 k triangles, ≤ 16 MB texture memory and ≥ 30 FPS sustained. These remain budgets to measure, not achieved results. Atmospheric work shares those totals; there is no separate motion allowance. Prefer a few bounded layers using transform/opacity over repainting full-screen blur or filters every frame.

One shared canvas only. Keep guest-shell ground state through same-page routes; dispose outgoing section geometry/materials/textures normally. Dispose persistent scene resources on page/theme replacement, access loss or leaving 3D. No retained media cache for the sake of continuity. Prove that ten journeys return resource counts to baseline.

Phase 3: usable still screens, focus/history/loading behavior. Phase 4: menu and route coordination, grouped reveals, dynamic grounds and corresponding still versions in all four themes, then evaluate on phones. Phase 5: optional World retains design 5's rail and ≤ 1.2 s camera flight; do not add the Page route interval on top of that flight. World sheets must remain usable while the camera settles. No new animation dependency is selected by this document; any later library/API work follows context7 and the network gate.

## 9. Tests to write first

These are future behavioral tests, each demonstrated RED before implementation. The documentation check only verifies handoff coverage and references; it cannot prove animation quality.

1. **Continuity:** record G1 → G2 → G4 → Z2 and a non-adjacent menu choice in every theme. Assert persistent ground identity and retained motif phase; inspect start/middle/end frames for a blank flash, duplicate content or abrupt background reset. A remounting background must fail.
2. **Menu handoff:** open, interrupt with close, reopen, choose a section, then choose another rapidly. Assert latest destination wins, one active route, usable controls, correct focus and no lingering inert state. Check still/live View alignment as the page scales. Repeat mirrored and list fallback layouts.
3. **Scroll:** fast forward/reverse scroll, focus a below-fold control, load more and restore Back/Forward. Content is visible and stable; no route/history change from scroll, scroll interception, repeated entrances or unreachable control.
4. **Memory detail:** already-loaded thumbnail handoff and missing/expired image fallback; Back restores the invoking card and scroll. Network logs must show no extra high-resolution request solely for animation and no video fetch before play.
5. **Motion off:** test system preference, G8 override, Static, data-saver-selected Static, and a live toggle halfway through a transition. Assert 0 ms durations/delays, no animation frames or 3D chunk in Static, correct final state and preserved unsent input.
6. **Loading/access:** delay and fail the destination request, remove a section, revoke access mid-transition. Old results cannot replace a newer route; protected outgoing layers disappear immediately on denial; loading/errors remain readable without an endless transition.
7. **Accessibility/reflow:** keyboard and screen reader traversal, EN/VI maximum-length labels, 390 × 844 and 320 px width with 200 % text. Check focus, Vietnamese diacritics, target sizes, safe areas, menu overlap and contrast at extreme/intermediate background states. Movement must not leave two accessible copies of the content.
8. **Resource lifetime:** hidden tab, idle timeout, focused form, forced low FPS and context loss. Verify stop/pause/downgrade rules, preserved state, no second canvas and baseline resources after ten route/menu/mode cycles.
9. **Visual evaluation:** on the target iPhone and Android phone, compare menu selection with shortcut navigation and ordinary scrolling. Record footage and frame timings. Owner judges whether the setting feels continuous and content stays comfortable to read; passing token checks alone is insufficient. Complete Q70's reference comparison before claiming fidelity to Layers.

## 10. Signature entrances (lead design by Codex, 2026-10-26)

**Status:** proposal; owner answers 2026-10-26: Q71 option 1 (soft fall and slam) with a different fall style per theme (A feather drift, B comet, C toy drop, D printing plate; §10.1.3; replay default "First time only" confirmed), Q72 gold hairline accepted, Q74 parallax and photo pan removed (PRD §12). Written by Codex as lead designer from the owner's seed (Together: the map falls from the top, larger to smaller, slams into the ground with effects after) and edited by Claude only for numbering and links. Every value is a prototype target; rendering, comfort and frame cost are **unverified**. Canvas preview of these entrances is pending (progress 2026-10-26). Layers §1-§9 above are unchanged; where §10 differs (first direct arrival, Memories parallax) the difference is listed as an open decision, not silently applied.

### 10.1 Together signature entrance — “A little world lands”

**Design status:** proposed choreography and remaining-screen specifications, ready for canvas exploration. Existing owner decisions remain binding. All new timings, dimensions and physical values below are prototype targets; their rendered appearance, comfort and performance are **unverified**.

#### 10.1.1 Direction

Together arrives as a miniature world falling into the guest’s hands: the map enters from above, oversized and slightly flatter than its resting angle, contracts toward its established perspective, makes one convincing contact, then releases a theme-specific impact. The pins unfold after contact as though the landing woke the places.

Use **a fall followed by a soft slam**, with weight expressed through acceleration, contact shadow and spreading effects. Keep the viewport, heading, place list and reading card stationary. This makes the entrance spectacular without shaking the whole interface.

Retain the approved v5.2 map, signature pins, fixed seeded slots, gestures and responsive compositions. The entrance adds a temporary outer transform; it never rewrites map coordinates, camera preferences, zoom state or slot assignments.

#### 10.1.2 Storyboard and composition

Timing begins when an authorized Together shell and its map representation are available. Navigation, heading focus and list interaction begin immediately. Slow-loading art does not trigger a delayed performance: show the still fallback and keep it.

| Beat | Time | Phone 390 × 844 |
|---|---:|---|
| Establish | 0 ms | Reserved menu bar, Together heading, place-list control and map stage are usable. A faint contact ellipse marks the destination. |
| Arrival | 0–140 ms | The enlarged map edge enters from the top of the decorative stage. Its underside and thickness establish depth; no title flies with it. |
| Accelerate | 140–420 ms | Map drops faster, contracts toward its fitted size and approaches the resting tilt. Contact shadow expands and darkens. |
| Contact | 420–480 ms | One shallow compression of the decorative map slab; impact originates at its footprint. A local rim pulse replaces a white screen flash. |
| Rebound | 480–700 ms | One small lift, then contact. A and C feel soft; B feels suspended; D settles almost immediately. |
| Places awaken | 600–1,060 ms | Up to four visible pin ornaments rise and unfold in a short stagger. All place controls already work. |
| Connection | 720–1,200 ms | A highlight travels along the already-visible route. Particles disperse and disappear. |
| Rest | 1,200 ms | Every entrance layer is finished and released. The approved map interactions remain. |

**Composition targets:** retain safe-area additions and existing theme-specific fit calculations.

| Size | Regions | Entrance adaptation |
|---|---|---|
| Phone 390 × 844 | 88 px reserved top bar; approximately 72 px heading region; 358 × 424 px map stage with 16 px side gutters; controls and “Dấu chân đôi mình” content below in normal flow | Strongest vertical descent. Effects clipped to the stage, never across the menu, heading or lower panel. Content may scroll; no forced one-screen fit. |
| Tablet 820 × 1180 | 88 px bar; 24 px gutters; approximately 772 × 590 px map stage; dock below, list and card sharing its width with a 24 px gap | Fall remains centered over the map. Impact spreads laterally toward the dock edge, stops before text. Dock is present from the start. |
| Laptop 1440 × 900 | Centered 1312 px composition: 256 px list, 24 px gap, 648 px map, 24 px gap, 360 px card; stage up to 620 px tall | The world lands between two stationary reading columns. No cinematic zoom across the entire screen. |
| 320 px / 200% text | Single-column flow; decorative stage may shorten; list and controls stack; text determines height | Remove peripheral effects first. Do not shrink labels or clip text to preserve the spectacle. |

For the settled pose, retain perspective **1100 px**, initial tilt **56°**, and v5.2 fitting: phone A/B **0.70**, C **0.54**, D **0.52**; tablet A/B **1.08**, C **0.79**, D **0.76**; laptop A/B **1.10**, C **0.90**, D **0.87**. These are existing board values, not proof that every future composition fits. Maintain at least 12 px clearance at all approved rotations.

#### 10.1.3 Physical model

Each theme has its own descent, not a shared fall with different particles. Time zero is semantic arrival with usable placeholder map data. Heading focus happens immediately; one polite, atomic “Map ready. [N] places. / Bản đồ đã sẵn sàng. [N] địa điểm.” announcement follows data readiness, independent of animation. Replay and Skip do not announce readiness again.

Separate the map artwork into a temporary outer fall wrapper; retain the original fitted map transform and fixed seeded `TG_SLOTS`. Keep the pin button plane at its settled coordinates throughout. Only ornamental pin children unfold. Squash affects SVG slab artwork, never text, buttons or the selection `.pin-in` transform. Perspective stays 1100 px and resting tilt 56°. World transform origin is 50% 70%; Z tilt has no extra offset (the four paths establish weight without another camera movement). The heading, list, reading card and menu never fall.

| Composition | Initial Y / multiplicative scale | Initial X A / B / C / D | Control placement outside stage |
|---|---|---|---|
| Phone 390×844 | −300 px / 1.24 | −18 / +120 / 0 / 0 px | x16, y88, ≥44 px high; map section moves from y96/h620 to y140/h576, retaining bottom edge |
| Tablet 820×1180 | −360 px / 1.18 | −18 / +170 / 0 / 0 px | right24, y32; map y104/h640 above stationary list/card dock y778 |
| Laptop 1440×900 | −280 px / 1.16 | −18 / +150 / 0 / 0 px | right24, y28; map x320/y96/w720/h780 between the original list and reading card |

These retain the actual latest `pub/project/` compositions, rather than replacing them with §10.1.2's approximate layout targets. No canvas frames change. All effects are clipped inside the map viewport. Text retains its original composition; Replay and Skip have their own strip on phone and use the empty right part of the top bar on larger boards.

Timing shorthand below: **I** = `cubic-bezier(.42,0,1,1)`, **O** = `cubic-bezier(.22,1,.36,1)`, **S** = `cubic-bezier(.45,0,.55,1)`. Each easing applies from its keyframe to the next. Values between keyframes interpolate; the complete animation is not given an additional easing. All rotations below are Z roll. `H` is the positive starting descent distance (300 / 360 / 280 px); `K` is initial scale (1.24 / 1.18 / 1.16); `X` is Cosmic's initial X (120 / 170 / 150 px).

| Theme | Exact descent: ms → (X px, Y px, scale, roll); outgoing easing | One contact / squash | Restoring motion |
|---|---|---|---|
| A Dreamy — feather-light drift | 0→(−18,−H,K,−2°) S; 240→(+18,−.86H,1+.85(K−1),+1.5°) I; 470→(−10,−.35H,1.06,−.8°) I; 620→(0,0,1,0°) O | 620 ms; 100 ms 1→(1.018X,.978Y)→1, S | 740 ms lift −4 px; I to rest at 900 ms. No horizontal recoil after contact. |
| B Cosmic — comet arrival | 0→(+X,−H,K,−12°) I; 180→(+.6X,−.72H,1.12,−7°) I; 340→(+.14X,−.18H,1.035,−2°) I; 440→(0,0,1,0°) O | 440 ms; 100 ms 1→(1.02X,.975Y)→1, S | 570 ms lift −3 px; I to rest at 760 ms. Spin resolves before impact. |
| C Cozy — toy drop | 0→(0,−H,K,0°) I; 220→(0,−.55H,1.08,0°) I; 360→(0,0,1,0°) O | 360 ms; slab stretches 1→(.98X,1.04Y) over 0–360 ms I, then 100 ms (.98X,1.04Y)→(1.045X,.945Y)→1, S | −6 px at 430; I to 0 at 500; O to −3 px at 560; I to 0 at 620; S wobble +.4° at 680, −.25° at 760, 0 at 900. |
| D Elegant — printing plate | 0→(0,−H,K,0°) O continuously to 640→(0,0,1,0°); no intermediate easing restarts | 640 ms; 100 ms 1→(1.006X,.994Y)→1, S | Hold world at rest through 720 ms; no bounce, spin or recoil. |

The squash uses three equally spaced frames (C starts from its stretched slab pose; the others start at identity) at contact, contact+50 and contact+100 ms. C's two small rebounds are quiet elastic follow-through after **one** slam: no second impact pulse, particles or sound. This explicitly supersedes the earlier “exactly one rebound” constraint in §10.1.3 and RED test 2. There is no viewport shake. Local lift never exceeds 6 px; the wobble lasts 220 ms. Reduced motion removes all of it.

Common shadow is one prepainted radial ellipse, no animated filter: 0 ms scale .45 / opacity .06; contact scale 1.04 / opacity .24; 1200 ms scale 1 / opacity .18, using O. Shadow is separate from the particle cap. No runtime shadow/blur, layout, `left`, stroke-dashoffset or mask animation is introduced. Animation uses transform and opacity only; any path clipping or dash pattern is static artwork.

At contact+100 ms the first four ornaments unfold deterministically, 60 ms stagger, 280 ms each, O: `translateY(12px) rotateX(-24deg) scale(.96)`, opacity 0 → identity, opacity 1. Other ornaments are already settled. Last unfold ends A1180 / B1000 / C920 / D1200 ms. The existing selected-place route remains unchanged; no new route or geography is invented. All entrance animations, fill effects and callbacks are canceled and released at 1200 ms or interruption.

##### Theme impacts

| Theme | Exact themed effect | Hard cap (entrance effects, excluding map/shadow/pin ornaments) |
|---|---|---:|
| A | Cloud cushion: two 48×22 px cream lobes and six 6 px pink heart wisps; 520 ms from 620, finish1140. Gentle world bounce is −4 px. | 8: 2 lobes + 6 hearts |
| B | One 130×3 px faint diagonal tail, 0–440 ms: (120,−180) rotate−42° scaleX.3 / opacity0 → (50,−85) rotate−42° scaleX1 / .24 at40% → (0,0) rotate−42° scaleX.15 /0; I. One dashed star-ring ellipse scales .45/opacity0 → .7/.6 at15% →1.28/0 over520 ms from440. Ten dust points spread. | 12: tail + ring + 10 dust (refines 11 dust to count the tail) |
| C | Four 18×12 px felt puffs plus six 6 px paper flecks, 520 ms from360, finish880. Flecks rotate35° maximum. No effects at either rebound. | 10: 4 puffs + 6 flecks |
| D | Ink ellipse scales .5/0 →.9/.16 at25% →1.05/0, 640–1140 ms O. Gold perimeter traces720–960 ms; red 5 px dot lifts6 px at1060 and returns by1170 (970–1170 ms S, opacity0→1→0). | 3: ink ellipse + one perimeter sprite + one dot |

For A/B/C deterministic particle i uses angle `i×2.399963`, distance `24+(i mod5)×12` px. At 0%, translate(0,0)/scale.6/opacity0; at8%, translate(0,0)/scale1/.65; at60%, translate(cos(angle)×distance, −8−(i mod4)×6)/scale1.3/.65; at100%, translate(cos(angle)×distance,−28)/scale1.5/0. Duration520 ms, O. Only C rotates35° at60%. Each point has no repeated flash. The B tail finishes at contact.

D uses **`--line-gold: #927132`**, approved Q72, contrast about4.03:1 on `#f4f1ec`. Use only for the entrance perimeter hairline; ordinary rules, text and focus retain their existing tokens. The trace is a prepainted 16-pose SVG strip over the existing outline: static pathLength100/dash lengths6.25…100, strip translateX0→−7200 px in240 ms with `steps(15,end)`. One moving sprite produces the trace while staying transform/opacity-only. No gold in the settled view.

#### 10.1.4 Replay policy

**Recommended default: “First time only.”** A signature should feel like a welcome, not a toll charged on every visit.

| G8 choice | Behavior |
|---|---|
| **First time only / Chỉ lần đầu** | Full entrance on the first eligible visit to each section family on this device and page. Subsequent visits are settled. |
| **Always / Luôn bật** | Full entrance on the first eligible section visit in a document session; later deliberate returns use a short settle at 40% of the full duration. |
| **Off / Tắt** | No signature entrances. Ordinary permitted navigation and control feedback retain their own motion rules. |

An eligible visit is a deliberate navigation to a different section, or a genuinely first direct arrival. Refresh, Back/Forward, selecting the current section, loading more, changing language, filtering, opening another album page and closing an overlay never replay the section introduction.

For Together, the short settle lasts **480 ms**: map translation `-8px → 0`, scale `1.015 → 1`, one fading contact shadow; no fall, rebound, particles, pin stagger or route highlight. No automatic “after 24 hours” replay is recommended.

Store only section-seen flags and the intro preference under a page-scoped key such as `vegenus:intro:[PAGE_ID]:v1`. No names, content, credentials or visit timestamps. Memory detail uses one family flag, not one flag per memory. Mark an entrance seen when it starts; skipping also counts. Design revisions do not reset flags automatically.

Blocked storage falls back to in-memory flags. Clearing storage can replay the welcome harmlessly. These preferences are per device, never proof of identity or account-wide history. This namespace is separate from existing mode storage.

#### 10.1.5 Pins, routes and interruptions

**Q63 invariant:** a placed pin’s stored slot index and x/y never change because an entrance runs, another pin is added, the viewport changes or the layout becomes denser.

Entrance transforms affect only each pin’s ornamental child. Its ground anchor remains fixed. Hit targets and accessible names come from the settled layout. If a guest touches, focuses or selects a place during the entrance, settle first and honor that same action.

Use fixed slot order for the four entrance ornaments, making replay deterministic. A late-loading pin appears in its final state. The intro never invokes the selection animation or opens a place card.

Keep the approved selection rise-and-flip and closing lower-and-flip behavior. Selection locking must not lock navigation, Close, Escape, errors or access removal. Only one place card may be active.

The route is visible before motion. Animate a decorative highlight over existing connections; do not invent new geography or change the approved previous/next connection rule.

| Interruption | Required result |
|---|---|
| Tap anywhere / pointer down | Cancel all entrance effects and apply the settled state in the same update, target 0 ms and never over 150 ms. Preserve the original control action. |
| Keyboard focus or activation | Settle before revealing the focus ring or activating a map control. |
| Explicit skip | During the full intro, show a stable ≥44 px “Skip intro / Bỏ qua mở đầu” control outside the falling stage. |
| Menu, sheet or tour opens | Settle entrance immediately; pause ambient effects. Q68 hides the menu beneath overlays. |
| Tab becomes hidden | Cancel work, settle and release particles. Returning shows the settled state without catch-up. |
| Reduced motion / Static | Every duration and delay is 0 ms; no particle frames, rebound, smooth scrolling or residual transitions. |
| Access revoked | Remove protected content and effects immediately; use the neutral access state. |
| Navigation changes | Latest destination wins; obsolete callbacks cannot restore the map or its focus. |

Reuse the existing active-frame performance monitor: 120 samples, decline when the 75th percentile exceeds 33 ms; exclude hidden/idle gaps and respect its mount warm-up. A 1.2-second entrance cannot establish this window alone. Do not claim that it proves ≥30 FPS.

A prior downgrade suppresses full entrances. A downgrade during an entrance settles it immediately; preserve route, focus, sheet, zoom and input. Measure the entrance separately on target phones.

No battery polling. Release temporary layers after completion, skip or cancellation. Keep only flags and the existing scene state. Budgets remain shared: ≥30 FPS, ≤50 draw calls, ≤300 KB gzipped Page 3D, ≤3 MB first-visit media; no extra high-resolution fetch for an effect.

#### 10.1.6 Accessibility and RED tests

Focus lands on the Together heading when navigation completes semantically, not when the visual landing ends. The map and particle artwork are decorative; the place list is the complete DOM equivalent.

Announce **“Map ready. [N] places.” / “Bản đồ đã sẵn sàng. [N] địa điểm.”** once when usable place data becomes available. Do not wait for the slam, repeat the announcement after skipping, or announce individual particles. Empty maps use the empty-state message instead.

Write and observe these tests failing before implementation, extending motion §9:

1. **Fixed anchors:** add places, replay, resize and rotate. Existing slot index/x/y remain identical; changing a slot to accommodate animation must fail.
2. **Timeline:** inspect arrival/contact/rest frames in A–D at all three sizes; enforce caps, one slam (C: two quiet rebounds after it, A/B one small lift, D none) and no moving reading surface; a shared descent across themes must fail.
3. **Immediate input:** activate a pin, place-list item, menu and Skip at several beats. Settle within 150 ms and execute the intended action once.
4. **Motion off:** system preference, G8 override, Static and mid-flight toggle produce 0 ms durations/delays and zero continuing animation work.
5. **Replay:** first visit, repeated navigation, refresh, history, blocked storage, cleared storage and another page obey the single policy.
6. **Race handling:** late art/data, rapid navigation, hidden tab and access revocation cannot restart or resurrect the intro.
7. **Accessible state:** one heading, one place list, one readiness announcement; focus never follows an ornamental pin.
8. **Fit and contrast:** all approved rotations, 320 px width, 200% text and maximum Vietnamese labels; no effect crosses protected text.
9. **Resources:** ten entrance/skip/menu/mode cycles return to baseline; forced decline settles without losing state.
10. **Phone evaluation:** record real frame timings and footage; owner assesses weight, delight and comfort. Token assertions alone do not pass this test.

### 10.2 One signature entrance per other section

#### 10.2.1 Shared motion language

1. **One world, one accent.** Preserve the theme ground; each section gets one leading gesture, with secondary decoration subordinate to it.
2. **Weight belongs to objects.** Maps, frames, seals and ornaments can fall or unfold. Reading surfaces and focused controls stay steady.
3. **Reveal relationships, not individual letters.** Reveal a photo group, paired signs or an album binding; text remains immediately readable.
4. **Interaction wins.** Navigation, typing, errors and focus settle decoration immediately. Nothing waits for a completion callback.
5. **Rest is designed.** Every effect ends in a deliberate still composition. Forms and Settings have no ambient animation.

Extend motion §6; retain its existing route/menu/reveal values.

| Token | Proposed value / scope |
|---|---|
| `--dur-intro-world` | 1200 ms; Together |
| `--dur-intro-home` | A 900 / B 960 / C 760 / D 600 ms |
| `--dur-intro-zodiac` | A 800 / B 900 / C 720 / D 640 ms |
| `--dur-intro-memories` | A 560 / B 600 / C 520 / D 420 ms |
| `--dur-intro-album` | A 640 / B 680 / C 560 / D 480 ms |
| `--dur-intro-wishes` | A 520 / B 560 / C 460 / D 380 ms |
| `--dur-intro-form-edge` | A 240 / B 260 / C 220 / D 180 ms |
| `--dur-intro-settings` | A 200 / B 220 / C 180 / D 160 ms |
| `--intro-return-ratio` | `.40`; Always-mode return, decoration simplified |
| `--ease-fall` | `cubic-bezier(.42,0,1,1)` |
| `--ease-settle` | `cubic-bezier(.22,1,.36,1)` |
| `--ease-impact-overshoot` | `cubic-bezier(.34,1.56,.64,1)`; small decorative objects only, scale clamped to 1.04 |
| `--intro-particle-cap` | A 8 / B 12 / C 10 / D 3; total active entrance elements, not per component |
| `--intro-pin-stagger` | 60 ms, first four ornaments only |
| `--dur-owner-feedback` | 120 ms opacity; 80 ms button press; no spring |
| Effective motion off | All durations/delays 0 ms, distances zero; no animated scroll |

The route interval and section entrance overlap from destination readiness. Never add their durations together as a navigation delay. If several effects would overlap, the leading section gesture owns the particle budget.

**Global replay rule:** use §10.1.4 for all section-family signatures. Functional sheet opening, album page turning and successful-submit feedback remain direct responses to actions, subject to motion-off rules. G7 confirmation occurs once per confirmed submission and never masquerades as a section intro.

#### 10.2.2 Section signatures

| Section | Entrance idea and A–D variations | Token; still state; replay |
|---|---|---|
| **Home G1 — the keepsake opens** | **A:** a glass-heart rim brightens as photo frames fan from a compact stack.<br>**B:** two orbital arcs align around the hero while the photo group takes its places.<br>**C:** toy blocks settle once; photo frames tuck into their tabletop arrangement.<br>**D:** one hairline extends beneath the names and the photo stack aligns like a gallery edition. | `--dur-intro-home`. Names, counter and note readable immediately; no count-up. Still: final photo arrangement and motif. Global policy; never reshuffle the selected photo on return. |
| **Zodiac Z2 — two guardians revealed** | **A:** soft light crescents open around each sign.<br>**B:** two thin seals illuminate from opposite ends, meeting beneath the pair.<br>**C:** rounded pedestal dots appear as a welcoming stage.<br>**D:** two fine framing arcs resolve into a paired composition. | `--dur-intro-zodiac`. Art remains upright and unrecoloured; full-page night sky and six tiles retained. Still: final halos, signs and tiles. Global policy; Western/Vietnamese switch uses the existing short opacity handoff, no intro replay. |
| **Memories G2 — an archive arranged** | **A:** glass edges catch a passing rose reflection.<br>**B:** a constellation stroke links the first row’s decorative corners.<br>**C:** empty paper mounts settle, then reveal their already-stationary photographs.<br>**D:** an editorial rule extends across the year heading. | `--dur-intro-memories`. At most three initial cards participate; no moving text or photo pan. Still: complete grid. Global policy; filter/load-more/history preserve existing cards and position. |
| **Memory detail G3 — the binding wakes** | **A:** a luminous seam opens along the album spine.<br>**B:** a gold orbit becomes the binding line.<br>**C:** a paper corner lifts and rests beside the opening page.<br>**D:** an embossed rule and red registration dot align. | `--dur-intro-album`. Contents and page controls usable immediately; no automatic page turn. Still: open album, one page on phone, spread on larger screens. One family flag across all memories. |
| **Wishes G5 — voices gathered** | **A:** a translucent ribbon settles behind the empty header margin.<br>**B:** small star brackets connect the first three card edges.<br>**C:** three paper tabs fold onto stationary notes.<br>**D:** a fine editorial line ends in a red dot beside the heading. | `--dur-intro-wishes`. Message text never floats. Still: approved list with final ornaments. Global policy; new approvals do not restart the page. |
| **Leave a wish G6 / Sent G7 — a note received** | **A:** a glass envelope edge opens; success closes its decorative flap.<br>**B:** an orbit opens around an empty seal; success completes the seal.<br>**C:** a paper flap unfolds; success adds one stamped check.<br>**D:** a hairline opens into a writing margin; success places a red seal. | `--dur-intro-form-edge`. Form fields remain stationary; decoration stops on focus. Still: open writing surface; after server success, static check and receipt text. Intro follows global policy; confirmation follows actual submission only. |
| **Settings G8 — a quiet control folio** | **A:** a glass edge resolves.<br>**B:** a fine orbit becomes the panel divider.<br>**C:** one paper index tab unfolds.<br>**D:** a hairline extends beside the title. | `--dur-intro-settings`. No particles. Still: fully open sheet. Global policy affects only edge decoration; ordinary open/close remains functional motion. |

**Owner area:** one neutral look, system fonts, no themed backgrounds, particles, ornamental stamps, hero animation or ambient motion. Allowed micro-motions: 120 ms opacity for feedback and disclosure, 80 ms button press, bounded progress updates, and the shared functional menu/sheet choreography. No animated chart count-up, shaking errors or automatically moving focus. Theme motion appears only inside an explicitly opened guest preview.
