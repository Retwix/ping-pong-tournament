"""Finding the moments a tracked ball hit something."""

from __future__ import annotations

from pingpong_vision.bounce import Bounce, bounces
from pingpong_vision.track import Track


def test_a_bounce_is_where_the_ball_stopped_falling_and_went_back_up() -> None:
    """§7, and the one place image coordinates read backwards.

    Image y grows downward, so contact — the bottom of the arc — is a
    *maximum* in y. Read the intuitive way round it finds the apex of every
    arc instead: the moment the ball is furthest from any surface and nothing
    has happened.

    The path below starts partway up an arc, as a track does when the ball is
    picked up mid-flight, rises to an apex, falls and hits, runs flat for
    three frames, then falls and hits again on the second-to-last frame.

    Each of those is load-bearing. The apex is the shape a sign error finds.
    The flat run is a ball rolling or a blob sitting still, where the velocity
    is zero on both sides and treating equality as a contact invents one. The
    contact on the second-to-last frame is the last position that can be
    judged at all, since a bounce needs a frame either side of it. And the
    path ends lower on screen than it begins, so a window that wrapped round
    to the final position would read a fall into the first frame and report a
    contact before the track started.
    """
    heights = (240.0, 145.0, 100.0, 145.0, 180.0, 205.0, 220.0,
               205.0, 180.0, 180.0, 180.0, 205.0, 220.0, 205.0)
    path = tuple((100.0 + 40 * t, y) for t, y in enumerate(heights))

    assert bounces(Track(10, path)) == [Bounce(16, (340.0, 220.0)),
                                        Bounce(22, (580.0, 220.0))]
