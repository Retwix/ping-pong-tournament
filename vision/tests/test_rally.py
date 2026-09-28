"""Turning a rally's bounces into a point."""

from __future__ import annotations

from pingpong_vision.calibration import Calibration
from pingpong_vision.rally import Event, awarded_to, events_from, points_from
from pingpong_vision.track import Track

COOLDOWN = 90          # ~3 s at 30 fps, §8
DWELL = 21             # ~0.7 s at 30 fps, §8


def test_the_point_goes_to_the_side_opposite_the_last_table_bounce() -> None:
    """§8's whole rule, and most of its table of cases collapses onto it.

    Every way a rally ends is a fault by exactly one player, and the last
    place the ball legally touched the table names them. "L returns into the
    net" and "L returns long" and "L's shot lands, R swings and misses" are
    three different-looking endings that are all just: read the last table
    bounce, award the other side.

    A floor bounce ends the rally but is not a table bounce, so it cannot be
    the thing read. The ball going off the near player's end is exactly how a
    rally ends with the near player at fault — take the floor bounce as the
    last touch and the point goes to the player who just won it.

    None when no table bounce was seen at all. §8 leaves that to the state
    machine, which refuses to score a rally under two table bounces; the rule
    itself has nothing to read and must not guess a side.
    """
    assert awarded_to(["far", "near"]) == "far"
    assert awarded_to(["near", "far"]) == "near"
    assert awarded_to(["far", "near", None]) == "far"
    assert awarded_to([None]) is None
    assert awarded_to([]) is None


def test_only_something_that_looked_like_a_rally_scores() -> None:
    """§8's phantom-point guard: two table bounces and a net crossing.

    This is what stands between the tracker and garbage points, and it is the
    reason a false track can be tolerated at all. §5 measured the tracker
    following the dog in the doorway and a player's forearm — neither ever
    bounces on the table, so neither reaches this gate. The detector does not
    have to be perfect; it has to be wrong in ways that cannot fake a rally.

    A ball rolled across the table crosses the net and bounces once, and must
    not score. Knocking about on one half bounces plenty and never crosses,
    and must not score either.

    Either a floor bounce or losing the ball ends the rally; §7 calls the
    floor bounce the strongest rally-end signal there is.
    """
    rally = [Event(10, "crossed"), Event(20, "bounce", "far"),
             Event(30, "bounce", "near"), Event(40, "lost")]
    ended_on_the_floor = [Event(10, "crossed"), Event(20, "bounce", "far"),
                          Event(30, "bounce", "near"), Event(40, "floor")]
    rolled_across = [Event(10, "crossed"), Event(20, "bounce", "near"),
                     Event(30, "lost")]
    knocked_about = [Event(10, "bounce", "near"), Event(20, "bounce", "far"),
                     Event(30, "lost")]

    assert points_from(rally, cooldown_frames=COOLDOWN) == ["far"]
    assert points_from(ended_on_the_floor, cooldown_frames=COOLDOWN) == ["far"]
    assert points_from(rolled_across, cooldown_frames=COOLDOWN) == []
    assert points_from(knocked_about, cooldown_frames=COOLDOWN) == []


def test_each_rally_is_judged_on_its_own() -> None:
    """A match is a stream, and the previous point must not fund the next one.

    Everything after the first rally here is meant to score nothing, and all
    of it happens long after the cooldown has lapsed so that the cooldown is
    not what is being tested. The stray has one bounce; the knockabout never
    crosses the net.

    Carry the state forward and both pass the gate on bounces the previous
    rally paid for, which turns the guard into a counter that only ever goes
    up. The failure is silent and it invents points during the quietest part
    of a match.
    """
    stream = [
        Event(10, "crossed"), Event(20, "bounce", "far"),
        Event(30, "bounce", "near"), Event(40, "lost"),
        Event(300, "crossed"), Event(310, "bounce", "near"), Event(320, "lost"),
        Event(600, "bounce", "near"), Event(610, "bounce", "far"),
        Event(620, "lost"),
    ]

    assert points_from(stream, cooldown_frames=COOLDOWN) == ["far"]


def test_the_ball_being_tossed_back_is_not_the_next_point() -> None:
    """§8 calls this the single most likely source of garbage points.

    The guard cannot catch it, and that is the whole difficulty: fetching the
    ball and lobbing it back over the table genuinely crosses the net and
    genuinely bounces on both halves. It is a rally by every measure the
    previous test applies. Only the clock tells it apart.

    So the seconds after a point are deaf. The toss-back below would
    otherwise score a second point immediately, off the same rally the
    players are still reacting to, and the real rally that follows would be
    the third.

    The real rally opens on frame 130, exactly `cooldown_frames` after the
    point at 40 — the first frame that is no longer deaf. A cooldown one
    frame too generous swallows that crossing, and the rally then scores
    nothing at all rather than scoring late.
    """
    stream = [
        Event(10, "crossed"), Event(20, "bounce", "far"),
        Event(30, "bounce", "near"), Event(40, "lost"),
        # fetched and lobbed back over the table, well inside the cooldown
        Event(50, "crossed"), Event(60, "bounce", "far"),
        Event(70, "bounce", "near"), Event(80, "lost"),
        # the next real rally, opening on the first frame the cooldown allows
        Event(130, "crossed"), Event(140, "bounce", "near"),
        Event(150, "bounce", "far"), Event(160, "lost"),
    ]

    assert points_from(stream, cooldown_frames=COOLDOWN) == ["far", "near"]


TABLE = Calibration(
    corners=((200.0, 1000.0), (1700.0, 1000.0), (1200.0, 400.0), (700.0, 400.0)),
    net_ends=((430.0, 620.0), (1130.0, 620.0)),
    length_cm=280.0,
    width_cm=140.0,
)


def test_a_track_becomes_the_events_a_rally_is_judged_from() -> None:
    """The join between §7 and §8, and the only place they meet.

    Everything upstream works in pixels; everything downstream works in sides
    and frames. This is the translation, and it is where a bounce stops being
    a local maximum and becomes something that decides a point.

    The ball bounces once on the near half, once on the far half, then a
    third time past the far edge onto the floor. The floor bounce keeps its
    frame and loses its side: §8 reads sides to award the point and must not
    be handed one for a ball that missed the table.

    It crosses the net line on the way, between the two bounces, which is
    what §8 needs to accept the rally at all.

    The track ends in a `lost` on its own last frame. Without it nothing ever
    closes a rally and no point is awarded — events would accumulate to the
    end of the match.
    """
    heights = (750.0, 800.0, 600.0, 450.0, 500.0, 450.0, 300.0, 350.0, 300.0)
    track = Track(100, tuple((950.0, y) for y in heights))

    assert events_from([track], TABLE, dwell_frames=DWELL) == [
        Event(101, "bounce", "near"),
        Event(102, "crossed"),
        Event(104, "bounce", "far"),
        Event(107, "floor"),
        Event(108, "lost"),
    ]


def test_events_come_out_in_frame_order_however_the_tracks_arrive() -> None:
    """§8 replays the stream in order, and `follow` does not produce one.

    A path is reported when it closes, so a long rally that started early
    and ended late is appended after a short one that began after it. Feed
    that order straight through and the cooldown compares frames that run
    backwards, the guard counts bounces from two rallies at once, and the
    point goes to whichever side the arithmetic happened to land on.

    The earlier track is passed second here, which is exactly the shape
    `follow` produces.
    """
    late = Track(100, tuple((950.0, y) for y in
                            (750.0, 800.0, 600.0, 450.0, 500.0, 450.0, 300.0, 350.0, 300.0)))
    early = Track(50, ((950.0, 800.0), (950.0, 850.0), (950.0, 800.0)))

    assert events_from([late, early], TABLE, dwell_frames=DWELL) == [
        Event(51, "bounce", "near"),
        Event(52, "lost"),
        Event(101, "bounce", "near"),
        Event(102, "crossed"),
        Event(104, "bounce", "far"),
        Event(107, "floor"),
        Event(108, "lost"),
    ]


def test_the_ball_passing_the_net_line_is_an_event() -> None:
    """§8 starts a rally on a crossing and refuses to score without one.

    The test is in image space, against the line through the two clicked net
    ends, rather than in table centimetres. §5 spent a week establishing that
    a ball in flight is above the plane and its table coordinates are fiction
    — asking "which half is it over" of a ball in mid-air gets a made-up
    answer, and the crossing is by definition asked while the ball is in the
    air.

    `returned` starts below the net line and ends above it; the crossing is
    reported on the first frame on the new side. `patted` never leaves the
    near side, which is what knocking about on one half looks like and is
    exactly what the guard exists to refuse.

    Known and accepted: a ball lobbed high over the near half rises above the
    net line without going anywhere near the net, and reads as a crossing.
    That makes the guard more permissive, never less, and a lob that then
    bounces twice on its own half is §8's "double bounce" row, which is
    supposed to score.
    """
    returned = Track(200, ((950.0, 800.0), (950.0, 700.0), (950.0, 550.0),
                           (950.0, 500.0), (950.0, 560.0), (950.0, 500.0)))
    patted = Track(300, ((950.0, 800.0), (950.0, 850.0), (950.0, 800.0),
                         (950.0, 860.0), (950.0, 800.0)))

    assert Event(202, "crossed") in events_from([returned], TABLE, dwell_frames=DWELL)
    assert [e for e in events_from([patted], TABLE, dwell_frames=DWELL) if e.kind == "crossed"] == []


TILTED = Calibration(
    corners=((425.0, 618.0), (1200.0, 1040.0), (1715.0, 398.0), (1150.0, 352.0)),
    net_ends=((935.0, 420.0), (1600.0, 540.0)),
    length_cm=280.0,
    width_cm=140.0,
)


def test_the_net_line_is_the_one_that_was_clicked_not_a_level_one() -> None:
    """A clicked net is never level, and the session's real one is not close.

    `TILTED` carries the net ends from `fixtures/calibration-2026-09-16.json`:
    (935, 420) to (1600, 540), dropping 120 px across 665. Treat that as a
    horizontal line and every crossing is judged against a boundary up to
    120 px from the real one — the same class of error §4 warns about for the
    net's position along the table, where bounces in the band are not blurred
    but awarded to the wrong player.

    The ball here travels flat across the frame at a constant height and
    still crosses, because the line slopes underneath it. Against a level
    line it never changes side at all and the rally is never allowed to
    start.
    """
    across = Track(400, ((1200.0, 480.0), (1280.0, 480.0), (1350.0, 480.0)))

    crossings = [e for e in events_from([across], TILTED, dwell_frames=DWELL) if e.kind == "crossed"]

    assert crossings == [Event(401, "crossed")]


def test_a_briefly_lost_ball_does_not_end_the_rally() -> None:
    """§8's T_dwell, and on real footage it is not a refinement.

    Measured on rally.mp4: 126 tracks with a median length of 11 frames, and
    92 of the 125 gaps between them shorter than 0.7 s. The tracker does not
    follow a rally, it follows a dozen fragments of one. End the rally at
    every fragment and §8's two-bounce guard never sees two bounces, because
    the bounces are spread across fragments that were all closed early.

    So a `lost` is only emitted where the ball really went away. `skipped`
    picks up 8 frames after `opening` ends and `resumed` picks up exactly
    `DWELL` frames after `skipped` ends — the last gap that is still the same
    rally. All three are one rally with one ending. `much_later` starts well
    outside and is its own.

    The gap is measured to where the next fragment *starts*, not where it
    finishes. `skipped` runs 25 frames, so measuring to its end would put it
    32 frames from `opening` and split a rally on the length of the fragment
    that continued it — the longer the ball is successfully followed, the
    more certainly the rally is declared over.
    """
    opening = Track(100, ((950.0, 800.0), (950.0, 850.0), (950.0, 800.0)))
    skipped = Track(110, tuple((950.0, 700.0 + (i % 2) * 60) for i in range(25)))
    resumed = Track(155, ((950.0, 800.0), (950.0, 850.0), (950.0, 800.0)))
    much_later = Track(400, ((950.0, 800.0), (950.0, 850.0), (950.0, 800.0)))

    lost = [e for e in events_from([opening, skipped, resumed, much_later], TABLE,
                                   dwell_frames=DWELL) if e.kind == "lost"]

    assert lost == [Event(157, "lost"), Event(402, "lost")]


def test_a_bounce_in_the_gap_reaches_the_rally_as_an_event() -> None:
    """The recovered bounces have to arrive where §8 can count them.

    Measured on rally.mp4 during play: 15 bounces are sampled inside
    fragments, and 57 more sit in the gaps between fragments that the dwell
    already joins. Finding them in `bounce.py` and not forwarding them here
    would leave §8's two-bounce guard starved exactly as before.

    Neither fragment below contains a reversal of its own — each is a
    straight run — so this bounce exists only because the gap was examined.
    It lands at (950, 800), which is 40 cm down the near half, and it has to
    arrive tagged that way rather than as a bare contact.
    """
    falling = Track(100, ((830.0, 680.0), (870.0, 720.0), (910.0, 760.0)))
    rising = Track(104, ((990.0, 760.0), (1030.0, 720.0), (1070.0, 680.0)))

    assert events_from([falling, rising], TABLE, dwell_frames=DWELL) == [
        Event(103, "bounce", "near"),
        Event(106, "lost"),
    ]

    # The same V, with the halves a hundred frames apart. Solving across that
    # gap would invent a contact in a stretch where the rally had already
    # ended and the ball may not even be the same one — a serve later is a
    # descent followed by a rise too. A turn is only recoverable inside a
    # dwell the tracker already considers one rally.
    much_later = Track(200, ((990.0, 760.0), (1030.0, 720.0), (1070.0, 680.0)))

    assert events_from([falling, much_later], TABLE, dwell_frames=DWELL) == [
        Event(102, "lost"),
        Event(202, "lost"),
    ]


def test_a_net_crossing_in_the_gap_still_counts() -> None:
    """The same one-frame hole that hid the bounces hides the crossings.

    Measured in play on rally.mp4: 43 crossings fall inside a fragment and 12
    fall in the gap between two the dwell already joins. §8 refuses to score
    a rally that never crossed, so each of those is a point that cannot be
    awarded however cleanly its bounces were found — and two of the six
    points missed at the last measurement failed for exactly this.

    Neither fragment here crosses anything on its own: the first stays below
    the net line the whole way, the second stays above it. The crossing
    exists only in the two frames between them, and is reported on the first
    frame on the new side, as a crossing inside a fragment would be.
    """
    below = Track(100, ((900.0, 740.0), (920.0, 700.0), (940.0, 660.0)))
    above = Track(104, ((980.0, 580.0), (1000.0, 540.0), (1020.0, 500.0)))
    stays_below = Track(204, ((980.0, 700.0), (1000.0, 680.0), (1020.0, 660.0)))

    assert events_from([below, above], TABLE, dwell_frames=DWELL) == [
        Event(104, "crossed"),
        Event(106, "lost"),
    ]
    assert [e for e in events_from([below, stays_below], TABLE, dwell_frames=DWELL)
            if e.kind == "crossed"] == []

    # A fragment that crosses on its own ends on the far side, and the next
    # one begins there too, so nothing happened in the gap. Comparing where
    # the first fragment *started* instead reports the same crossing twice —
    # once where it happened and once a few frames later, out of nothing.
    crosses_midway = Track(300, ((900.0, 700.0), (920.0, 640.0), (940.0, 580.0)))
    then_above = Track(304, ((980.0, 540.0), (1000.0, 520.0), (1020.0, 500.0)))

    assert [e for e in events_from([crosses_midway, then_above], TABLE,
                                   dwell_frames=DWELL)
            if e.kind == "crossed"] == [Event(302, "crossed")]

    # The mirror of it: the gap is clean and the *second* fragment crosses
    # partway through. Comparing where that one ends rather than where it
    # begins again doubles the crossing, and dates the copy to before the
    # ball had gone anywhere.
    resumes_then_crosses = Track(104, ((980.0, 680.0), (1000.0, 640.0),
                                       (1020.0, 580.0)))

    assert [e for e in events_from([below, resumes_then_crosses], TABLE,
                                   dwell_frames=DWELL)
            if e.kind == "crossed"] == [Event(106, "crossed")]
