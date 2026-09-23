"""Turning a rally's bounces into a point."""

from __future__ import annotations

from pingpong_vision.rally import awarded_to


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
