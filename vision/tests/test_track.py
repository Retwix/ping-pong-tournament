"""Following the ball between frames, rather than re-finding it in each one."""

from __future__ import annotations

import pytest

from pingpong_vision.track import advance, follow, is_ballistic, predict_next


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


def arc(frames: int) -> tuple[tuple[float, float], ...]:
    """A ball in free fall: 60 px across per frame, the drop growing by 20."""
    return tuple((100.0 + 60 * t, 500.0 + 20 * t + 10 * t * t) for t in range(frames))


FLIGHT = arc(8)
FOREARM = ((700.0, 400.0), (730.0, 380.0), (710.0, 420.0), (745.0, 395.0),
           (705.0, 415.0), (740.0, 400.0), (715.0, 410.0), (735.0, 390.0))
# gate_px has to exceed how far the ball travels in one frame, not how
# accurately the arc is known: with a single sighting the prediction is
# "stays put", so a gate under the ball's own speed can never reach frame
# two and no track ever starts. The arc is policed afterwards, by
# tolerance_px, which is why the gate can afford to be this loose.
POLICY = dict(gate_px=120.0, coast=3, least=6, tolerance_px=6.0)


def test_the_ball_is_picked_out_of_the_clutter_and_the_clutter_is_not() -> None:
    """The measurement d7a2179 could not make: which blobs were the point.

    Every frame here offers two blobs, and nothing in any single frame says
    which is which — that is exactly the situation the colour and size gates
    leave behind. Held up against their own past, only one of them is falling.
    """
    together = [[ball, arm] for ball, arm in zip(FLIGHT, FOREARM)]

    assert follow(together, **POLICY) == [FLIGHT]
    assert follow([[arm] for arm in FOREARM], **POLICY) == []


def test_a_ball_hidden_for_exactly_the_coast_is_still_the_same_ball() -> None:
    """§5: "occlusion is normal" — behind a player, a bat, the net.

    Ending a track at the first empty frame would end almost every track at
    once, since d7a2179 measured 73.5% of rally frames yielding no candidate.
    Coasting fills the gap with the prediction, which keeps the positions one
    frame apart so `predict_next` keeps meaning what it says.

    The gap here is exactly `coast` long, so a limit one frame tighter drops
    the ball and the track never reaches `least` sightings.
    """
    hidden = [[] if t in (4, 5, 6) else [arc(10)[t]] for t in range(10)]

    assert follow(hidden, **POLICY) == [arc(10)]


def test_a_ball_gone_too_long_is_not_the_ball_that_comes_back() -> None:
    """Coasting has to expire, or one track swallows a whole rally.

    Without a limit the tracker bridges any gap, and two different balls — or
    a ball and the next serve — become one path that still fits an arc, since
    the invented positions in between are placed on that arc by construction.
    The gap here is one frame longer than `coast`, so the first track is
    abandoned at four sightings and the second never gathers six. One frame
    shorter and it would survive, which is what pins the limit to a number.

    The two short gaps in the second clip are each within `coast` and add up
    to more than it. They must not accumulate: a sighting clears the debt, or
    a rally with a hidden ball every few frames dies of attrition.
    """
    long_gap = [[] if 4 <= t <= 7 else [arc(14)[t]] for t in range(14)]
    twice_hidden = [[] if t in (3, 4, 7, 8) else [arc(12)[t]] for t in range(12)]

    assert follow(long_gap, **POLICY) == []
    assert follow(twice_hidden, **POLICY) == [arc(12)]


def test_a_blob_that_moves_smoothly_and_then_turns_round_is_not_a_ball() -> None:
    """The case the gate cannot catch, and the reason the arc is rechecked.

    A forearm jerks enough that association loses it on its own. A bat swept
    steadily across and back does not: every position lands inside `gate_px`
    of the prediction, so it collects a full track of eight sightings and
    reaches acceptance with nothing but the arc left to stop it. A thrown
    object does not reverse.
    """
    swept = [[(x, 0.0)] for x in (0.0, 50.0, 100.0, 150.0, 200.0, 150.0, 100.0, 50.0)]

    assert follow(swept, **POLICY) == []


def test_a_track_that_ends_before_the_clip_does_is_still_reported() -> None:
    """A rally is many tracks, and only the last of them ends with the clip.

    The ball is seen for eight frames and then never again. The track closes
    partway through, and closing is the only moment it can be judged — a
    tracker that only reported whatever it happened to be holding at the end
    would report at most one path per clip.

    It is reported as the eight frames that were seen, not the eleven it
    occupied. The three coasted positions at the end were guesses about a
    ball nobody could see, and §7 reads bounces off these coordinates.
    """
    then_gone = [[arc(8)[t]] if t < 8 else [] for t in range(14)]

    assert follow(then_gone, **POLICY) == [arc(8)]


def test_a_path_that_was_mostly_guessed_is_not_evidence_of_a_ball() -> None:
    """Coasting keeps a track alive; it must not be what makes it believable.

    Eight frames long, five of them actually seen and three invented. The
    invented ones sit on the arc by construction, so the arc check passes on
    a path that is three-eighths fiction — counting entries would call this a
    ball. Only real sightings count, so a glimpse either side of a long guess
    is not a rally. The same clip two frames longer is accepted, above.
    """
    glimpsed = [[] if t in (4, 5, 6) else [arc(8)[t]] for t in range(8)]

    assert follow(glimpsed, **POLICY) == []
