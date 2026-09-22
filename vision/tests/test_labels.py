"""Recording where the ball actually is, so the tracker can be marked."""

from __future__ import annotations

from pingpong_vision.labels import Label, append_label, read_labels, unlabelled


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
