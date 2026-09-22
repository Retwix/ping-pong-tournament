"""Recording where the ball actually is, so the tracker can be marked."""

from __future__ import annotations

from pingpong_vision.labels import (
    Label,
    Score,
    score_tracks,
    append_label,
    drop_last_label,
    read_labels,
    unlabelled,
)
from pingpong_vision.track import Track


def test_labelling_survives_being_interrupted(tmp_path) -> None:
    """Whoever labels will not do it in one sitting, and must never redo work.

    Each answer is written the moment it is given, so closing the window is a
    pause rather than a loss. Reopening offers only what is still unanswered,
    in order, and a frame answered "not visible" counts as answered — that is
    a real observation about the ball, not a skipped question. Losing it would
    bias the measurement towards the frames where the ball is easy to see.
    """
    store = tmp_path / "rally.labels.csv"
    append_label(store, Label(frame=30, at=(940.0, 512.5)))
    append_label(store, Label(frame=60, at=None))

    assert read_labels(store) == [Label(30, (940.0, 512.5)), Label(60, None)]
    assert unlabelled([30, 60, 90, 120], read_labels(store)) == [90, 120]


def test_an_unstarted_store_offers_everything(tmp_path) -> None:
    """A missing file is an unlabelled clip, not an error to recover from."""
    assert read_labels(tmp_path / "nothing.csv") == []
    assert unlabelled([30, 60], []) == [30, 60]


def test_a_misclick_can_be_taken_back(tmp_path) -> None:
    """Undo has to remove the answer, not just move on from it.

    A ball 15 px across, clicked at speed, will be missed sometimes. If undo
    only stepped backwards, the bad answer would stay in the file and the
    frame would count as done — so the one frame the labeller knows is wrong
    is the one they cannot fix. Taking the row out puts the frame back in the
    queue.

    Undo rewrites the whole file, so the rows it keeps have to come back
    unchanged — a "not visible" answer in particular, which has no position
    to write and is easily turned into one at the origin. Undoing past the
    start does nothing, so it is safe to lean on.
    """
    store = tmp_path / "rally.labels.csv"
    append_label(store, Label(frame=30, at=(940.0, 512.5)))
    append_label(store, Label(frame=45, at=None))
    append_label(store, Label(frame=60, at=(12.0, 12.0)))

    drop_last_label(store)

    assert read_labels(store) == [Label(30, (940.0, 512.5)), Label(45, None)]
    assert unlabelled([30, 45, 60], read_labels(store)) == [60]

    for _ in range(4):
        drop_last_label(store)

    assert read_labels(store) == []


def test_a_ball_counts_as_found_only_if_a_track_was_on_it() -> None:
    """Being busy in the right frame is not the same as following the ball.

    The measurement §5 has lacked all along. A track covering a frame proves
    nothing by itself — 7aecc88 showed a coverage-shaped metric scoring worse
    than chance — so a sighting counts only when a track's position for that
    frame lands within `within_px` of where the ball was actually clicked.

    The first track spans two frames and is in the wrong place for the first
    of them, so reading a track's position one frame out of step shows up
    here rather than passing silently. The second is almost exactly above the
    ball it misses and the last is level with it and far across, so measuring
    either axis alone would score one of them a hit.

    A track sitting somewhere else in the frame is counted separately and
    against us: it is a claim of a ball that was not there, and §15's
    phantom-point target is the strict one. A frame the labeller marked
    hidden is held to the same standard.
    """
    labels = [
        Label(10, (100.0, 100.0)),   # a track is on it
        Label(20, (100.0, 100.0)),   # a track is in frame, but 400 px below
        Label(30, None),             # no ball visible, yet a track claims one
        Label(40, (100.0, 100.0)),   # nothing covers this frame at all
        Label(50, (100.0, 100.0)),   # a track is level with it, 400 px across
    ]
    tracks = [
        Track(9, ((999.0, 999.0), (105.0, 102.0))),   # frame 9 elsewhere, frame 10 on it
        Track(20, ((104.0, 500.0), (104.0, 500.0))),  # spans 20-21, right across, far down
        Track(30, ((100.0, 100.0),)),
        Track(50, ((500.0, 102.0),)),
    ]

    assert score_tracks(labels, tracks, within_px=20.0) == Score(
        judged=5, found=1, missed=3, invented=3)
