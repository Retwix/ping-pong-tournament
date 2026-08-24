# Claude Design — revision prompt (ball curve + racket position)

Paste as a follow-up to the loading-animation canvas.

---

The motion doesn't read as real yet. Three things are wrong, and they're all physics, not styling.

## 1. The racket is doing the opposite of what a real one does

Right now it dips *down* on contact and springs back. Real keepie-uppie is the reverse: the
paddle **rises to meet the ball and drives up through it**. Contact happens on the way *up*,
never at the bottom of a dip. Rebuild the racket beat around this timeline (t = 0 is contact):

| t | racket |
|---|---|
| -180ms | already parked at the intercept point, tilt already aimed, holding still |
| -120ms | begins rising, accelerating |
| **0** | contact — still rising, ~70% through its upward stroke |
| +60ms | top of the stroke, follow-through, ball long gone |
| +60 to +260ms | drops back to rest, overshoots ~3% below it, settles |

Stroke length is about 0.14x blade diameter. The "arrive early and wait" beat is what sells it —
a racket still moving sideways at the moment of contact looks like it's swatting.

## 2. Rotate the racket around the wrist, not the blade

Put the rotation pivot at the **butt end of the handle**, not the blade centre. A rigid racket
turns about the wrist, so the blade swings along an arc and part of the lateral travel comes
free from the tilt change itself. Rotating about the blade centre is why the handle currently
looks like it's wagging independently.

## 3. The ball's curve is not ballistic

Vertical and horizontal must be driven separately, on two nested groups:

- **Horizontal: perfectly `linear`.** No easing at all. Constant velocity is what ballistic
  motion looks like, and easing it is the most common tell of a fake arc.
- **Vertical: a sampled parabola,** `y = apex * 4s(1-s)`. Use these keyframes as a fraction of
  apex height, `linear` between samples (do not put an ease on each segment):

  | % of flight | 0 | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 |
  |---|---|---|---|---|---|---|---|---|---|---|---|
  | height | 0 | .19 | .36 | .51 | .64 | .75 | .84 | .91 | .96 | .99 | 1 |

  then mirror it back down to 0. Up and down must be exactly symmetric — same apex, same
  duration, identical gravity in both halves.

The single fastest visual moment of the whole loop is contact. If the ball appears to slow as
it comes down, the easing is still wrong.

## 4. Make it a two-beat loop

One hit sending the ball straight up will always look mechanical. Alternate:

- Hit **A** launches the ball up and to the right; it lands about 1.2x blade diameter right.
- The racket tracks across, arrives early, and hit **B** sends it back to the left.
- Loop = A + B, so it still tiles seamlessly. Flight ~620ms, contact ~60ms, loop ~1.36s.

Between beats the racket rocks between about -14 and +14 degrees. The icon's -30 degree pose
stays as the **rest/idle pose only** — first frame and the `prefers-reduced-motion` still.

## 5. The law that ties it together

**The racket's tilt at the moment of contact must equal the ball's launch angle from vertical**
(~10-12 degrees for the travel above). If the paddle is aimed 11 degrees right, the ball leaves
11 degrees right. Getting these two to agree is the difference between "animated" and "real".

And the contact geometry: at t = 0 the ball's centre sits exactly `blade radius + ball radius`
from the blade centre, along the racket's own up-axis (butt to blade). Never overlapping the
blade, never floating a gap above it.

## Also

- The ground shadow tracks the **ball's** horizontal position, not the racket's.
- Give the ball a faint off-centre highlight or seam so its spin reads; spin direction matches
  the horizontal travel and flips at each hit.
- Keep the squash to 2-3 frames at contact only, and stretch it along the travel direction near
  peak speed, which is now just after contact rather than at the apex.

## Don't

- No dip before contact. No `ease-in-out` anywhere on the ball. No evenly-spaced height
  keyframes. No rotation about the blade centre. No ball overlapping the blade edge.

Show me the light-theme filmstrip again with the poses at -180ms / contact / +60ms /
25% of flight / apex, so I can check the drive-through and the hang time.

## 6. Wrist follow-through after the ball leaves

The upward stroke is only half of it — add a **rotational** follow-through around the same
wrist pivot. Once the ball is gone the racket carries on turning for a moment, because a real
wrist decelerates over a longer arc than it accelerates. It's dead motion with no effect on
the ball, and that's exactly why it reads as human.

Relative to contact at t = 0, with the aim angle at contact being `A` (about 11 degrees toward
the hit):

| t | tilt |
|---|---|
| 0 | `A` — the aim angle, ball departs |
| +90ms | `A + 7` degrees — peak of the follow-through, well past the aim |
| +190ms | back through `A`, unwinding |
| +260ms | soft overshoot ~1.5 degrees the other side |
| +320ms | settled, then begins aiming for the next beat |

Rules for it:

- **Wind-up is smaller than follow-through.** The turn into contact covers less arc than the
  turn out of it — roughly 4 degrees in, 7 degrees out. Symmetry here kills it.
- Ease it as a **decaying settle**, not a bounce: fast out of contact, then slowing, with a
  single small overshoot. `cubic-bezier(0.2, 0.7, 0.2, 1)` on the unwind.
- Let the wrist pivot itself drift up to 2% of blade diameter during the follow-through and
  return — a wrist is not a nailed-down hinge.
- The blade traces a small arc up and across as a consequence of the rotation. Don't animate
  that arc separately; it should fall out of the pivot being at the handle butt.
- **Budget:** the follow-through must be fully settled by +320ms. The racket still has to be
  parked at the next intercept point, aimed and still, by +440ms. If the follow-through eats
  into that "arrive early and wait" beat, shorten the follow-through, never the wait.
- Keep it at the same amplitude in the 40px inline variant — it survives the size, and the
  small version needs the life more than the large one does.
