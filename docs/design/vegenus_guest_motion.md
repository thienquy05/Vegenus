# Guest motion: connected sections and living backgrounds

**Status:** DRAFT v0.1 on `docs/guest-screens-v3`. Documentation only. Owner direction and open questions: PRD §12, Q69-Q70. Numerical values below are prototype defaults, not measured reference values or owner-approved final timings. Existing approvals for designs 2 and 5 do not approve this supplement.
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
