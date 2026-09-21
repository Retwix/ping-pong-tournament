"""Where the ball should turn up next, given where it has just been.

A frame on its own cannot tell a ball from a forearm: at one instant both are
an orange-ish blob of roughly the right size, which is why §5's colour and size
gates plateau at a rally rate indistinguishable from a warm-up's. Across frames
there is something to tell them apart with, because a struck ball is in free
flight and a forearm is not. This module is only the memory that makes the
comparison possible; whether it separates them in practice is unmeasured, and
§5 step 4 is where that gets decided.

Prediction is in **image pixels, not table centimetres**. A ball in flight is
above the table plane, so the homography — which assumes points lie *on* the
plane — throws it far from where it really is. Centimetres are for bounces.
"""

from __future__ import annotations

Point = tuple[float, float]


def predict_next(seen: list[Point]) -> Point:
    """Extrapolate one frame on from the last three positions.

    Constant acceleration, not constant velocity: gravity bends the path every
    frame, so a straight line drawn through the last two always undershoots.
    Three points is the fewest that can measure a bend at all, and few enough
    that the estimate stays fresh when the ball is struck and the arc restarts.

    A shorter history predicts with what it has rather than refusing, because
    a track has to survive its own first two frames to ever reach a third.
    """
    if len(seen) == 1:
        return seen[-1]
    if len(seen) == 2:
        (bx, by), (cx, cy) = seen
        return (2.0 * cx - bx, 2.0 * cy - by)
    (ax, ay), (bx, by), (cx, cy) = seen[-3:]
    return (3.0 * cx - 3.0 * bx + ax, 3.0 * cy - 3.0 * by + ay)
