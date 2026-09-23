"""Turning a rally's bounces into a point."""

from __future__ import annotations

from pingpong_vision.rally import Event, awarded_to, points_from


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
    rally = [Event("crossed"), Event("bounce", "far"), Event("bounce", "near"),
             Event("lost")]
    ended_on_the_floor = [Event("crossed"), Event("bounce", "far"),
                          Event("bounce", "near"), Event("floor")]
    rolled_across = [Event("crossed"), Event("bounce", "near"), Event("lost")]
    knocked_about = [Event("bounce", "near"), Event("bounce", "far"), Event("lost")]

    assert points_from(rally) == ["far"]
    assert points_from(ended_on_the_floor) == ["far"]
    assert points_from(rolled_across) == []
    assert points_from(knocked_about) == []


def test_each_rally_is_judged_on_its_own() -> None:
    """A match is a stream, and the previous point must not fund the next one.

    Everything after the first rally here is meant to score nothing. The
    stray has one bounce and the knockabout never crosses the net, and both
    are exactly the between-points noise §8's guard exists to swallow — a
    ball being fetched, tossed back over, patted about while somebody finds
    the score.

    Carry the state forward and both of them pass the gate on bounces the
    previous rally paid for, which turns the guard into a counter that only
    ever goes up. The failure is silent and it invents points during the
    quietest part of a match.
    """
    stream = [
        Event("crossed"), Event("bounce", "far"), Event("bounce", "near"),
        Event("lost"),
        Event("crossed"), Event("bounce", "near"), Event("lost"),
        Event("bounce", "near"), Event("bounce", "far"), Event("lost"),
    ]

    assert points_from(stream) == ["far"]
