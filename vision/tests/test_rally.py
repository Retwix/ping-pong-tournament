"""Turning a rally's bounces into a point."""

from __future__ import annotations

from pingpong_vision.rally import Event, awarded_to, points_from

COOLDOWN = 90          # ~3 s at 30 fps, §8


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
