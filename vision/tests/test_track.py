"""Following the ball between frames, rather than re-finding it in each one."""

from __future__ import annotations

import pytest

from pingpong_vision.track import predict_next


def test_a_falling_ball_is_predicted_onto_its_arc_not_its_last_heading() -> None:
    """§5 step 3: the model is constant *acceleration*, and that is the point.

    Gravity bends the path every frame, so a straight-line guess from the last
    two positions always falls short of where the ball really goes. Predicting
    onto the arc is what lets the tracker prefer the nearest candidate over the
    brightest one — and, in turn, what will let an arm be told from a ball.

    Over the last three frames the ball moves 60 px right while its drop grows
    20, 40, ... A straight-line guess would say (280, 600); the arc says
    (280, 620). The two frames before those are from the arc it was on before
    it was struck, and must not be allowed to drag the estimate backwards — a
    rally's history is long, and only its tail describes the shot in progress.
    """
    seen = [(0.0, 300.0), (40.0, 380.0),
            (100.0, 500.0), (160.0, 520.0), (220.0, 560.0)]

    assert predict_next(seen) == pytest.approx((280.0, 620.0))


def test_a_short_history_predicts_with_what_little_it_has() -> None:
    """A track has to survive its own first two frames to reach a third.

    Two sightings measure a speed but no bend, so the best available guess is
    a straight line; one measures nothing at all, and standing still is the
    only honest answer. Refusing to predict here would mean a track could
    never start, and the ball is only ever seen in bursts.
    """
    assert predict_next([(100.0, 500.0), (160.0, 520.0)]) == pytest.approx((220.0, 540.0))
    assert predict_next([(100.0, 500.0)]) == pytest.approx((100.0, 500.0))
