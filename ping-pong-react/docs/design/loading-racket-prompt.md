# Claude Design prompt — « racket juggling » loading animation

Copy everything below into Claude Design.

---

Design a **looping loading animation** for Recovr, a ping-pong tournament app: our racket
juggling a ball, bouncing it endlessly off the paddle face. It replaces spinners everywhere
data is loading (page shells, tables, the live scoreboard).

## Use the existing racket — exact geometry and colors

The racket already exists as our app icon. Reuse its silhouette and palette verbatim, just
scaled up and without the rounded-square tile:

```svg
<g transform="rotate(-30 15 15)">
  <circle cx="15" cy="14" r="7.6" fill="#F35E68"/>
  <circle cx="15" cy="14" r="7.6" fill="none" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="1"/>
  <rect x="13.4" y="20.4" width="3.2" height="7.4" rx="1.6" fill="#F35E68"/>
</g>
<circle cx="24" cy="8.4" r="2.9" fill="#FFF3D6"/>
```

- Blade: solid coral `#F35E68`, perfect circle, with the subtle 18%-white inner rim stroke.
- Handle: same coral, rounded rectangle, radius ≈ half its width, roughly 0.42× blade
  diameter wide and 0.97× blade diameter long, joined flush to the blade.
- Ball: cream `#FFF3D6`, radius ≈ 0.38× the blade radius.
- Brand palette for anything else: purple `#4A2AA4` (light theme primary),
  `#8663E9` (dark theme primary), coral deep `#B7333F`, ink `#17082B`, muted `#8E889C`.
- Fonts, if you add a label: Outfit (display, 700–800) / DM Sans (body).

The racket sits at a natural **-30° tilt** at rest, exactly as in the icon. Keep it.

## The motion

One seamless loop, **~1.1–1.4s**, that must tile perfectly (first and last frame identical):

1. **Toss.** The ball leaves the paddle face and arcs upward — real parabolic easing:
   fast off the face, decelerating to a float at the apex, then accelerating down.
   Apex ≈ 1.6× the blade diameter above the paddle. Never use linear or plain `ease-in-out`
   for the vertical travel; the hang time at the top is what sells it.
2. **Recoil.** On contact, the racket dips ~8–10% of the blade diameter and rotates a few
   degrees against the hit, then springs back and slightly overshoots before settling —
   a small follow-through, not a rigid bounce.
3. **Contact squash.** The ball squashes on impact (≈ 1.18× wide / 0.86× tall) for 2–3 frames
   only, and stretches subtly along its travel direction at peak speed. Never squash the racket.
4. **Drift.** The ball should not land on the same spot every time in a way that reads as
   mechanical — a gentle side-to-side sway across the loop, with the racket sliding a few
   pixels laterally to meet it, makes it feel juggled rather than pumped.

Optional refinements if they don't add noise:
- A soft blurred coral shadow ellipse under the racket that widens and lightens as the ball rises.
- A one-frame contact spark or faint ring at the moment of impact.
- A faint motion trail on the ball at maximum velocity.

## Constraints

- **Contrast:** the cream ball is nearly invisible on white surfaces. Solve it — a thin coral
  or purple-tinted outline, a soft drop shadow, whatever reads cleanly. Show me the ball on
  `#FFFFFF` and on `#F5F5F8` (light surfaces) and on `#14181F` (dark surface) so I can judge it.
- **Themes:** works in light and dark. Coral and cream stay the same in both; anything you add
  (shadows, labels, container) must adapt.
- **Sizes:** design at ~120px tall for full-page loading, and verify it still reads at 40px
  for inline/button loading. Drop the shadow and the trail at the small size if they muddy it.
- **`prefers-reduced-motion`:** provide a still fallback — racket at rest, ball resting on the
  paddle face, with a gentle opacity pulse only.
- No text baked into the animation; I'll place an optional « Chargement… » caption in Outfit
  700 / `#8E889C` beneath it.

## Deliverable

Three artboards on one canvas:

1. **The loop, light theme** — full-size (120px) on `#F5F5F8`, plus a filmstrip of the key
   poses (rest → contact → mid-flight → apex) laid out left to right so I can read the timing.
2. **The loop, dark theme** — same, on `#14181F`.
3. **In context** — the animation centred in an empty card (white surface, `#ECEAF1` border,
   16px radius, soft shadow) with the « Chargement… » caption, and the 40px inline variant
   sitting inside a coral button and next to a table row.

Then give me the implementable version: a **single self-contained SVG with CSS keyframes**
(no JS, no external assets), sized via `width`/`height` on the root, colors driven by
`currentColor` or CSS custom properties where it makes sense, and the reduced-motion media
query included. Our stack is React + plain CSS, and our easing token is
`cubic-bezier(0.2, 0.7, 0.2, 1)` — use it for the racket's settle, but a custom parabolic
curve for the ball.
