"""Marking who won each point, in real time, without losing one's place."""

from __future__ import annotations

from label_points import caption_for, run_up_to
from pingpong_vision.labels import Outcome


def test_a_mark_is_always_played_back_into() -> None:
    """Resuming and undoing both drop the operator in before the moment.

    Both exist because the thing being judged is a rally, not a frame: a mark
    dropped exactly on the previous one shows the ball already dead, which
    says nothing about who put it there. Three seconds is about two shots at
    the rate §2 measured.

    They were two different numbers when this was first written — one frame on
    a resume, three seconds on an undo — which made reopening the clip useless
    for checking the last call and is the reason this is one function.

    Clamped at zero: a point marked in the first seconds of a clip has no
    run-up to give, and seeking to a negative frame silently rewinds some
    backends to the end instead.
    """
    assert run_up_to(900, 30.0, seconds=3.0) == 810
    assert run_up_to(900, 60.0, seconds=3.0) == 720
    assert run_up_to(40, 30.0, seconds=3.0) == 0


def test_the_caption_says_what_was_last_marked() -> None:
    """A double-tap costs a spurious point, and noticing it late costs knowing which.

    So the last mark is on screen rather than only in the file: the operator
    sees the row appear as they make it. An empty store says so instead of
    showing a stale one.
    """
    nothing = caption_for(1753, 30.0, [], paused=False)
    after_two = caption_for(2100, 30.0, [Outcome(1753, "left"), Outcome(2075, "right")],
                            paused=True)
    at_sixty = caption_for(1800, 60.0, [], paused=False)

    assert "0 marked" in nothing and "last" not in nothing
    assert "playing" in nothing
    # the latest mark, not the first: the one being second-guessed is the last
    assert "2 marked, last f2075 right" in after_two
    assert "PAUSED" in after_two
    # the clock is the clip's, not 30 fps: §2 settled on 30 but a phone that
    # negotiates 60 would put every timestamp at half of what it should be
    assert "58.4s" in nothing and "f1753" in nothing
    assert "30.0s" in at_sixty
