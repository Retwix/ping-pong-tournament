"""Recording where the ball actually is, so the tracker can be marked."""

from __future__ import annotations

from pingpong_vision.labels import (
    Label,
    append_label,
    drop_last_label,
    read_labels,
    unlabelled,
)


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
