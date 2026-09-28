"""Finding the moments a tracked ball hit something."""

from __future__ import annotations

from pingpong_vision.bounce import Bounce, bounce_between, bounces, table_half
from pingpong_vision.calibration import Calibration
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


TABLE = Calibration(
    corners=((200.0, 1000.0), (1700.0, 1000.0), (1200.0, 400.0), (700.0, 400.0)),
    net_ends=((430.0, 620.0), (1130.0, 620.0)),
    length_cm=280.0,
    width_cm=140.0,
)


def test_a_bounce_is_placed_on_a_half_or_off_the_table_entirely() -> None:
    """§7: inside the polygon is a table bounce, outside is the floor.

    This is the one place the homography can be trusted without reservation.
    Everywhere else in §5 a ball is above the plane and its table coordinates
    are fiction — which is why the candidate margin had to go out to 900 cm.
    A bounce is the ball *touching* the surface, so here the projection means
    exactly what it says, and the polygon is tight again.

    The net on this table sits at 102 cm of 280, not at 140. `just_over`
    lands at 122 cm — past the real net, short of the table's midpoint — so
    it is "far" by the clicked line and would be "near" by an assumed one.
    §4 warns that bounces in exactly that band are not blurred but awarded to
    the wrong player, and this is the assertion that holds the warning.

    `clipping` lands 4 cm off the near edge, inside the margin, and counts as
    a table bounce: neither the corner clicks nor a blob's centroid is exact,
    and a ball catching the edge really did hit the table. Without a margin
    that bounce becomes a floor bounce and ends the rally.

    The last bounce lands 364 cm down a 280 cm table — long, past the far
    edge, onto the floor. §7 calls that the strongest rally-end signal there
    is, so it has to be told apart from a bounce, not quietly rounded onto
    the nearest half.
    """
    near = Bounce(12, (950.0, 800.0))      # table (70, 40) cm
    far = Bounce(20, (950.0, 500.0))       # table (70, 175) cm
    just_over = Bounce(24, (950.0, 580.0))  # table (70, 122.5) cm
    clipping = Bounce(28, (950.0, 1030.0))  # table (70, -4.5) cm
    long = Bounce(30, (950.0, 350.0))      # table (70, 364) cm

    assert table_half(near, TABLE) == "near"
    assert table_half(far, TABLE) == "far"
    assert table_half(just_over, TABLE) == "far"
    assert table_half(clipping, TABLE) == "near"
    assert table_half(long, TABLE) is None


def test_a_bounce_that_falls_between_two_fragments_is_still_found() -> None:
    """§7's soft spot, measured: the turn is usually in the gap.

    On rally.mp4 during play, 115 tracks yield 15 sampled reversals — and 57
    pairs of consecutive fragments where the first ends going down and the
    next begins going up, with a median gap of a single frame. The ball is
    lost for one frame at precisely the moment it bounces, which is when it
    is fastest, lowest and against the table edge. Requiring the turn to be
    sampled throws away four bounces in five.

    It does not have to be sampled. Either side of a bounce is a straight
    enough run over a few frames, and the two runs meet in a V whose vertex
    is the contact. Here the ball falls 40 px a frame to (580, 180) and rises
    40 px a frame from (660, 180): the arms cross at frame 103 at (620, 220),
    a frame nobody saw and a position nothing reported.

    The contact also lands lower than either fragment reaches, which is the
    other half of the point — a sampled reversal reports the lowest frame
    that happened to be caught, always short of the surface the ball touched,
    and §7 then projects that gap into table centimetres.
    """
    falling = Track(100, ((500.0, 100.0), (540.0, 140.0), (580.0, 180.0)))
    rising = Track(104, ((660.0, 180.0), (700.0, 140.0), (740.0, 100.0)))

    assert bounce_between(falling, rising) == Bounce(103, (620.0, 220.0))

    # The two arms rarely agree on horizontal speed — a bounce sheds some of
    # it, and three points is a short baseline to measure any of it from. Here
    # they read 40 px and 60 px a frame and place the contact at x = 620 and
    # x = 630, so the answer is the average rather than whichever arm was
    # asked first.
    slowing = Track(200, ((500.0, 100.0), (540.0, 140.0), (580.0, 180.0)))
    quickened = Track(204, ((690.0, 180.0), (750.0, 140.0), (810.0, 100.0)))

    assert bounce_between(slowing, quickened) == Bounce(203, (625.0, 220.0))


def test_two_fragments_that_are_not_a_turn_are_not_a_bounce() -> None:
    """A gap is not evidence. Only a fall followed by a rise is.

    The ball is lost and re-found constantly — 91 of the in-play fragment
    pairs sit within the dwell — so reading every gap as a contact would
    invent a bounce several times a second and hand §8 a rally built out of
    noise. `falling`/`still_falling` are both descending: the ball was missed
    on its way down and nothing happened in between. `climbing` and
    `still_climbing` are both rising, which is the same non-event on the way
    up — and it has to be refused on the strength of the *first* arm, since
    the second is ascending exactly as it would be after a real bounce.
    """
    falling = Track(100, ((500.0, 100.0), (540.0, 140.0), (580.0, 180.0)))
    still_falling = Track(104, ((660.0, 260.0), (700.0, 300.0), (740.0, 340.0)))
    climbing = Track(200, ((500.0, 180.0), (540.0, 140.0), (580.0, 100.0)))
    still_climbing = Track(204, ((660.0, 60.0), (700.0, 20.0), (740.0, 4.0)))

    assert bounce_between(falling, still_falling) is None
    assert bounce_between(climbing, still_climbing) is None
