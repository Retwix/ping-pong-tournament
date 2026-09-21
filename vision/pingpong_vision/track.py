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

from math import hypot

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


def advance(seen: tuple[Point, ...], candidates: list[Point], *, gate_px: float) -> tuple[Point, ...]:
    """Extend the track with whichever candidate best matches the prediction.

    A frame arrives as an unordered pile of orange blobs with nothing to rank
    them by. The prediction is the ranking, and `gate_px` is the limit on it:
    a blob further than that from where the ball was due is not the ball,
    however alone it is in the frame. Without the limit a track snaps onto a
    player's shirt the instant the ball is missed, and then stays there.

    Returns the track unchanged when nothing qualifies, so a lean frame costs
    the track nothing but a position.
    """
    if not candidates:
        return seen
    prediction = predict_next(seen)
    nearest = min(candidates, key=lambda c: _apart(prediction, c))
    if _apart(prediction, nearest) > gate_px:
        return seen
    return (*seen, nearest)


def is_ballistic(seen: tuple[Point, ...], *, tolerance_px: float, least: int) -> bool:
    """Has this path been falling freely, or is something carrying it?

    §5 step 4, and the only question in the pipeline a single frame cannot
    answer: a hand and a ball look alike for one instant and nothing alike
    over six. Between contacts a ball is in free fall, so every position is
    where its three predecessors said it would be; a forearm goes where its
    owner decides, and misses its own prediction immediately.

    `least` exists because consistency over too few frames proves nothing --
    three points fit a curve through themselves whatever they are. Neither
    bound is defaulted: §5 wants both tuned against footage, and a guessed
    constant in a signature is how a guess becomes a fact nobody rechecks.
    """
    if len(seen) < least:
        return False
    return all(_apart(predict_next(seen[i - 3:i]), seen[i]) <= tolerance_px
               for i in range(3, len(seen)))


def _apart(a: Point, b: Point) -> float:
    """One definition of distance, used both to rank and to reject.

    Two copies of it could drift into meaning different things — squared
    against unsquared, say — and the gate would quietly stop being the
    distance it was tuned as.
    """
    return hypot(a[0] - b[0], a[1] - b[1])
