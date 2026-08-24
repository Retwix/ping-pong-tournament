# Handoff: Recovr racket-juggling loading animation

## Overview
A looping loading animation for Recovr (ping-pong tournament app): the brand racket juggles the cream ball, bouncing it endlessly. It replaces spinners everywhere data loads — page shells, tables, the live scoreboard, buttons.

Two variants:
- **v2 (standard)** — coral racket, two-beat juggle.
- **v3 (face flip)** — identical motion, but between each hit the racket flips to its other face, which is brand purple; the hit-B impact ring matches.

## About the design files
The files in this bundle are **design references created in HTML/SVG** — they show intended look and behavior, not production code to copy blindly. Recreate them in the target codebase's environment. That said, the two `*.svg.txt` files ARE production-grade self-contained SVGs (CSS keyframes, no JS): **rename them to `.svg`** and they can be dropped into a React + plain CSS stack as-is (inline them or `<img>` them). The `.dc.html` canvases are presentation boards (artboards, filmstrips, in-context mocks) for reference only.

## Fidelity
**High-fidelity.** Colors, geometry, timing and easing are final. Recreate pixel-perfectly (or use the SVGs directly).

## Files
- `recovr-loader.svg.txt` → rename `recovr-loader.svg` — v2 standalone animated SVG
- `recovr-loader-flip.svg.txt` → rename `recovr-loader-flip.svg` — v3 face-flip variant
- `canvas-v2-reference.dc.html`, `canvas-v3-flip-reference.dc.html` — design boards: light/dark artboards, key-pose filmstrips, in-context card/button/table-row mocks

## Geometry (SVG user units, viewBox="-5 -19 40 53", aspect 40:53)
Scaled straight from the app icon:
- Blade: ellipse cx15 cy16.8 rx7.6 ry4.8 (a circle foreshortened by slight top-down perspective), thickness edge ellipse 1.1 below in the deep color, 18%-white rim stroke (1px), faint white face highlight ellipse (rx6 ry3.5, 10%).
- Handle: rect x13.4 y20.4 w3.2 h7.4 rx1.6, wooden `#C98F5F`.
- Wrist pivot (all racket rotation): handle butt **(15, 27.8)**.
- Ball: r2.9 cream, contrast rim stroke 0.5 `rgba(183,51,63,.45)` + soft drop-shadow (both dropped ≤48px tall).
- Rest/idle pose (also reduced-motion still): racket at **−30°**, ball on the face.
- Contact law: ball centre sits on the racket's up-axis, 4.2 units above blade centre (visually on the face), never overlapping the rim, at both contacts. Racket tilt at contact = ball launch angle = **11°**.

## Motion (loop 1.36s, two beats; contact A at 0%, contact B at 50%)
- **Ball, horizontal**: perfectly linear, ±9.1 units (18.2 total ≈ 1.2× blade diameter). No easing.
- **Ball, vertical**: sampled parabola `y = apex·4s(1−s)`, apex 24.3 units; keyframes every 5% of flight at fractions 0/.19/.36/.51/.64/.75/.84/.91/.96/.99/1, **linear between samples**, exactly mirrored down. Fastest moment is contact.
- **Racket stroke** (translateY): parked at intercept by −180ms; rises from −120ms accelerating; contact at 0 while still rising (70% through a 2.13-unit stroke); top at +60ms; drops back with ~3% undershoot, settled +260ms.
- **Wrist rotation** (about the butt): wind-up 4° in (park at aim−4°), contact at aim (±11°), rotational follow-through to aim+7° at +90ms, unwind through aim at +190ms on `cubic-bezier(0.2,0.7,0.2,1)`, 1.5° counter-overshoot at +260ms, settled +320ms. Follow-through arc > wind-up arc (7° vs 4°) — keep this asymmetry. Small wrist-drift (~2% blade diameter) folded into the stroke top.
- **Carriage** (lateral): ±12 units, travels between +200ms and +440ms after each hit (ease-in-out), then parked and still ≥180ms before the next contact. Never moving sideways at contact.
- **Squash/stretch**: 1.18×/0.86 squash for ~2 frames at contact only; 0.94/1.10 stretch just after contact (peak speed); subtle 0.95/1.07 stretch just before landing. Never squash the racket.
- **Spin**: small white highlight orbits the ball (300°/beat), direction reverses at each hit.
- **Shadow**: coral blurred ellipse tracking the **ball's** x (linear), scale .72→1.18 and opacity .34→.14 with ball height.
- **Impact ring**: one-frame expanding ring at each contact point (scale .7→1.6, opacity .45→0 over 6% of the loop).
- **v3 flip**: during each carriage crossing the blade flips about the handle axis (`scaleX` 1→−1, ease-in-out over the travel window); faces swap at the scaleX=0 midpoint. Face A coral, face B purple.
- All first/last keyframes identical — the loop tiles seamlessly.

## Interactions & behavior
- Pure CSS, no JS. Loop duration exposed as `--rv-loader-dur` (default 1.36s).
- `prefers-reduced-motion: reduce`: all animations off → rest pose (−30°, ball on face) with a gentle opacity pulse (2.4s, 1→0.55).
- Small sizes: add `data-size="sm"` on the SVG root (≤48px tall) → drops ground shadow, impact rings and ball drop-shadow. Keep follow-through amplitude unchanged.
- Caption (optional, outside the SVG): « Chargement… », Outfit 700, `#8E889C`.

## Design tokens
CSS custom properties on the SVG root (all with fallbacks):
- `--rv-loader-paddle` `#F35E68` (face A) · `--rv-loader-edge` `#B7333F`
- `--rv-loader-paddle-b` `#8663E9` · `--rv-loader-edge-b` `#4A2AA4` (v3 only)
- `--rv-loader-handle` `#C98F5F` (wood)
- `--rv-loader-ball` `#FFF3D6` · `--rv-loader-outline` `rgba(183,51,63,.45)`
- `--rv-loader-shadow` `#F35E68` · `--rv-loader-dur` `1.36s`

On a coral button: paddle → `#FFFFFF`, outline → `transparent`.
Brand palette context: purple `#4A2AA4` (light primary), `#8663E9` (dark primary), coral deep `#B7333F`, ink `#17082B`, muted `#8E889C`. Easing token: `cubic-bezier(0.2, 0.7, 0.2, 1)` (racket settle only — never on the ball).

## Sizes
Design at 120px tall (90px wide) for full-page loading; verified at 40px for inline/button use with `data-size="sm"`. Backgrounds verified: `#FFFFFF`, `#F5F5F8`, `#14181F`.

## State management
None — the loader is stateless. Mount while loading, unmount when done. If shown &lt; 300ms, prefer keeping it mounted with a fade to avoid a flash.

## Assets
No external assets. Everything is inline SVG derived from the Recovr app icon (blade + handle + ball geometry reproduced verbatim, scaled). Fonts for captions: Outfit / DM Sans (Google Fonts).
