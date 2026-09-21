"""Following the ball between frames, rather than re-finding it in each one."""

from __future__ import annotations

import pytest

from pingpong_vision.track import advance, is_ballistic, predict_next


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


def test_the_track_takes_the_candidate_nearest_where_it_expected_the_ball() -> None:
    """This is the whole point of predicting: it makes a choice possible.

    A frame hands over several orange blobs and nothing to rank them by. The
    prediction supplies the ranking — and a limit, because a blob across the
    room is not the same ball however lonely the frame is. Without the limit
    the track would snap onto a player's shirt the moment the ball vanished.

    `below` and `aside` each beat `nearby` on one axis alone and lose badly on
    both together — 80 px out either way. Comparing a single axis would take
    one of them, and a ball dropping onto the table moves almost entirely in
    y, so a one-axis comparison fails at the bounce that decides the point.

    The empty frame is the common case, not the edge case: d7a2179 measured
    73.5% of rally frames yielding no candidate at all.
    """
    seen = ((100.0, 500.0), (160.0, 520.0), (220.0, 560.0))   # predicts (280, 620)
    nearby, elsewhere = (286.0, 614.0), (900.0, 200.0)
    below, aside = (282.0, 700.0), (360.0, 618.0)

    assert advance(seen, [below, nearby, aside, elsewhere], gate_px=40.0)[-1] == nearby
    assert advance(seen, [elsewhere], gate_px=40.0) == seen
    assert advance(seen, [], gate_px=40.0) == seen


def test_only_a_path_that_keeps_curving_the_same_way_is_a_ball() -> None:
    """§5 step 4: "a hand or a racket produces blobs; it does not produce a parabola".

    This is the test the single-frame gates cannot do at any threshold, and the
    reason d7a2179 found a rally and a warm-up indistinguishable. A struck ball
    is in free fall between contacts, so each position is where the previous
    three said it would be. A forearm goes where its owner decides.

    Being consistent over too few frames proves nothing — three points define a
    curve through themselves no matter what they are — so a track under `least`
    is refused however neatly it fits.

    One wrong blob anywhere disqualifies the whole path, which is why the
    broken pair is here. A track that holds up for five frames and jumps on
    the sixth is a track that grabbed something else on the sixth, and a check
    that only sampled the good end would certify it. `early` and `late` differ
    from `flight` in one position each, at opposite ends.
    """
    flight = tuple((100.0 + 60 * t, 500.0 + 20 * t + 10 * t * t) for t in range(6))
    forearm = ((100.0, 500.0), (150.0, 480.0), (120.0, 520.0),
               (170.0, 495.0), (130.0, 515.0), (165.0, 500.0))
    early = ((0.0, 0.0), *flight[1:])
    late = (*flight[:5], (400.0, 900.0))

    assert is_ballistic(flight, tolerance_px=6.0, least=6) is True
    assert is_ballistic(forearm, tolerance_px=6.0, least=6) is False
    assert is_ballistic(early, tolerance_px=6.0, least=6) is False
    assert is_ballistic(late, tolerance_px=6.0, least=6) is False
    assert is_ballistic(flight[:4], tolerance_px=6.0, least=6) is False
