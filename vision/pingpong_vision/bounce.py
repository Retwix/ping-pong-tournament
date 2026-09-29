"""The moments a tracked ball hit something.

§7. A bounce is the bottom of an arc: the ball was falling, and in the next
frame it is rising. Everything the scorer does is built on these — §8 awards
the point to the side opposite the last *table* bounce, so a bounce in the
wrong place or the wrong frame is a point to the wrong player.

Image coordinates read backwards here and it is worth saying once: y grows
downward, so the bottom of the arc is a **maximum** in y. Looking for the
minimum finds the apex of every arc instead, which is the moment the ball is
furthest from any surface and nothing at all has happened.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .ball import on_the_table
from .calibration import (
    Calibration,
    half_of_bounce,
    homography_of,
    net_cm_of,
    to_table_cm,
)
from .track import Point, Track


@dataclass(frozen=True)
class Bounce:
    """A contact: the frame it happened on, and where on screen."""

    frame: int
    at: Point


def bounces(track: Track) -> list[Bounce]:
    """Every frame in a track where the ball stopped falling and went back up.

    Whether a contact was the table or the floor is not decided here: that is
    a question about where the point projects, and §7 answers it with the
    table polygon. This only finds the contacts.
    """
    found = []
    for i in range(1, len(track.seen) - 1):
        falling = track.seen[i][1] - track.seen[i - 1][1]
        rising = track.seen[i + 1][1] - track.seen[i][1]
        if falling > 0 and rising < 0:
            found.append(Bounce(track.start + i, track.seen[i]))
    return found


def bounce_between(before: Track, after: Track, *, arc_frames: int = 6) -> Bounce | None:
    """The contact in the gap between two fragments, if there was one.

    §7's soft spot, measured rather than assumed: on rally.mp4 during play,
    115 tracks yield 15 sampled reversals and 57 pairs of fragments where the
    first ends going down and the next begins going up — with a median gap of
    a single frame. The ball is lost for one frame at exactly the moment it
    bounces, which is when it is fastest, lowest and against the table edge.
    Insisting the turn be sampled throws away four bounces in five.

    Each arm is fitted as a curve, not a line, because a falling ball
    accelerates. The last two positions give the average speed across that
    pair, slower than the ball is going by the time it lands, and
    extrapolating at that speed puts the contact short of the table — which
    §7 then projects into centimetres, where a bounce 16 cm off the near edge
    becomes a floor contact and ends the rally. Across 55 solved contacts the
    curve leaves the same 41 on the table and pulls the misses in: median
    miss 38.7 cm to 32.0, and 9 landing beyond 30 cm down to 7.

    `arc_frames` is where the fit stops. Six was measured: three through eight
    all beat straight arms, six and eight best, and ten and beyond fall back
    to straight-line results as the window grows past a single arc and starts
    averaging over the bounce before it.

    Horizontal speed is read as a straight line and averaged across the arms,
    since a bounce sheds some of it and neither arm is authoritative.

    None unless the first arm really is descending and the second ascending —
    the ball is lost and re-found constantly, so reading every gap as a
    contact would invent bounces several times a second — and None when the
    fitted curves do not meet inside the gap at all.
    """
    if len(before.seen) < 2 or len(after.seen) < 2:
        return None
    if before.seen[-1][1] - before.seen[-2][1] <= 0:
        return None
    if after.seen[1][1] - after.seen[0][1] >= 0:
        return None

    span = min(arc_frames, len(before.seen), len(after.seen))
    last, first = before.start + len(before.seen) - 1, after.start
    fa = np.arange(last - span + 1, last + 1, dtype=float)
    fb = np.arange(first, first + span, dtype=float)
    ya = np.array([p[1] for p in before.seen[-span:]])
    yb = np.array([p[1] for p in after.seen[:span]])

    degree = 2 if span >= 3 else 1
    meeting = _meeting_point(np.polyfit(fa, ya, degree), np.polyfit(fb, yb, degree),
                             last, first)
    if meeting is None:
        return None

    xa = np.array([p[0] for p in before.seen[-span:]])
    xb = np.array([p[0] for p in after.seen[:span]])
    across = (np.polyval(np.polyfit(fa, xa, 1), meeting)
              + np.polyval(np.polyfit(fb, xb, 1), meeting)) / 2
    return Bounce(round(meeting), (float(across),
                                   float(np.polyval(np.polyfit(fa, ya, degree), meeting))))


def _meeting_point(falling, rising, last: float, first: float) -> float | None:
    """Where the two fitted arms cross, inside the gap they bracket.

    Two curves can cross twice. The contact is the crossing where the ball is
    lowest on screen, and it has to lie in the gap: a crossing outside it is
    the arms agreeing somewhere the ball was actually seen, which says
    nothing about a bounce.
    """
    difference = np.polysub(falling, rising)
    if not difference.any():
        return None
    inside = [root.real for root in np.roots(difference)
              if abs(root.imag) < 1e-6 and last - 1 <= root.real <= first + 1]
    return max(inside, key=lambda at: np.polyval(falling, at)) if inside else None


def table_half(bounce: Bounce, calibration: Calibration, *,
               margin_cm: float = 8.0) -> str | None:
    """Which half a bounce landed on, or None if it missed the table.

    None is not "unknown". It means the ball hit the floor, which §7 calls
    the strongest rally-end signal there is, so the caller has a decision to
    make rather than a gap to fill.

    This is the one place §4's homography can be trusted without reservation.
    A ball in flight is above the plane and its table coordinates are fiction
    — §5's candidate margin had to reach 900 cm for exactly that reason. A
    bounce is the ball touching the surface, so here the projection means
    what it says and the polygon can be tight again.

    The margin is for the clicks and the blob centroid, neither of which is
    exact; a ball clipping the edge is a table bounce.
    """
    homography = homography_of(calibration)
    point = to_table_cm(homography, bounce.at)
    if not on_the_table(point, calibration, margin_cm=margin_cm):
        return None
    return half_of_bounce(point[1], net_cm=net_cm_of(calibration))
