# Guest screens v3 (preview canvas round 3)

**Status:** v0.1, 2026-10-23, waiting for owner review. Branch `docs/guest-screens-v3` (stacked on `docs/theme-nav-icons`, owner's choice). No application code.
**Canvas:** "anni Theme Preview" (Claude design canvas, version 40). Rebuilt with `docs/design/preview/build_v3.py` from the round-2 boards; placeholders only (rule 3).
**Codex review:** not run this round (Codex lives on the owner's Mac and is not reachable from this session). Due next session, before the image run (see `vegenus_codex_image_brief.md`).

## 1. Owner feedback (2026-10-23) and what changed

| Area | Owner said | Done (all four themes) |
|---|---|---|
| G1 Home | "4 containers same as the menu is useless"; greet guests with photos; no "start the tour" button, let them explore | Section tiles removed. Under the names: a stack of 5 photos (tap the photo or the arrows; counter "n / 5", polite live region). Below: a welcome note signed by the couple (sample text). The page scrolls inside the phone (content 1180 px) |
| Menu open | Keep the idea, make the motion smoother when the page steps back | Page eases over 0.72 s (`cubic-bezier(.22,1,.36,1)`), slight extra tilt, dims a little, returns on the same curve. Items now fly back to the button on close (reverse stagger) instead of vanishing; nav is `visibility: hidden` and `aria-hidden` when closed. Reduced motion: unchanged rule, no tilt or fly-out |
| Menu button | "Looks like a ball, be creative" | A crescent glass moon with three stars; B ringed planet with an orbiting moon; C isometric toy block with a heart; D a bookmark ribbon hanging from the top edge with "&". Each morphs into a theme × when open. Owner area: plain round button, new motion |
| Zodiac | Galaxy/universe as the background, picture on top, more room for long text | Night sky is the whole page in every theme; galaxy and 12-sign ring scaled up behind; the two sign images float on top; the reading is a scrolling glass card (3 sample paragraphs) |
| G4 Together | A simple 3D map with photo pins that open a modal (place, date, time, note) | Illustrated made-up map (owner: not a real map) tilted in 3D; 4 photo pins stand on it; tap a pin or a chip under the map to open a sheet: photo, place, date · time, note, "see memories here", previous / next, close. Two buttons turn the map in 45° steps |
| Memories, G5, G6, G8 | "Seems okay" / "looks okay" | Only the new button and motion |

## 2. Decisions that touch approved designs (need owner OK)
- **Text over the 3D box (Q60).** Design 4 §3 decor rule and design 5 §4.2 say text never sits inside a View box. The new Zodiac puts the sign art and the reading card on top of the galaxy. Proposal: allowed only for Zodiac, text always inside a card at 72 % night glass with blur, contrast checked against the brightest frame of the scene.
- **Generated art (Q61).** Design 5 principle 4 is "procedural before assets" with 0 texture bytes in Page mode. Owner wants Codex images instead of code-drawn shapes. Proposal: images become the Page-mode art within the byte targets in the brief; procedural/SVG stays as Static fallback.
- **Map positions (Q62).** The map is a drawing, not geography, so a pin stores x/y on the drawing, never coordinates. Guests never receive a real location from the map.
- **Home photos and note (Q63).** Which photos feed the stack and who writes the note.
- **"Circular menu" (Q64).** Only the button was redesigned; the round item bubbles are unchanged. Owner to say if the items should change too.

## 3. References looked at (21st.dev, owner suggestion)
- Draggable Photo Stack by @laziekiki (MIT): swipe physics, fan view, shuffle. Reference for the real G1 stack (drag to throw, not only tap). https://21st.dev/@laziekiki/components/draggable-photo-stack
- mapcn MarkerTooltip and Expand Map: real-map components (MapLibre based), useful only for the pin and expand pattern since the owner chose an illustrated map. https://21st.dev/@mapcn/components/mapcn-marker-tooltip , https://21st.dev/@jatin-yadav05/components/expand-map
- Nothing was installed or copied (rule 1). Any template that ships needs its licence checked and an install approval.

## 4. Tests to add when code starts (RED first)
1. G1: tapping the photo or "next" advances the counter and wraps 5 → 1; "previous" wraps 1 → 5; the counter is announced; reduced motion shows no fly-out.
2. Menu: after close, no menu item is focusable (Tab skips them) and the nav is `aria-hidden`; open → close → open leaves no item stuck mid-animation.
3. Together: every pin has a DOM chip equivalent; opening a pin moves focus to the sheet heading; Esc and × close it and return focus to the pin; previous / next wrap.
4. Zodiac (v4, 2026-10-24): the reading is six message tiles (real `<button>`s, ≥ 44 px) that each open one message; tile and dialog text keep ≥ 4.5:1 contrast over the sky; the sign images keep alt text; on a 390 × 844 phone all six tiles are visible without scrolling, laid out in flow (no absolute positions), with equal gaps.
5. Zodiac message dialog (Codex review 2026-10-24): opening moves focus into the dialog (its heading or close button), the page behind is `inert`, Tab stays inside, Escape and × close it, focus returns to the tile that opened it; previous / next keep focus in the dialog; the page-turn or unroll effect (v4.3, owner's pick) never moves focus or hides the buttons; swipe left / right turns the page and the buttons do the same for keyboard and switch users; reduced motion shows the page without the flip, roll or slide. The circular menu keeps design 4 test 12 (inert page, focus, Escape, close on selection, no tilt under reduced motion).
