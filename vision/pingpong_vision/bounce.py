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
