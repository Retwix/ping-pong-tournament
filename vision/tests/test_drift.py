"""Noticing that the camera has moved, before it quietly ruins a session."""

from __future__ import annotations

import cv2
import numpy as np
import pytest

from pingpong_vision.drift import view_shift_px

rng = np.random.default_rng(7)


def textured_room(width: int = 640, height: int = 480):
    """A frame with enough corners to track — a room, not a blank wall."""
    frame = np.full((height, width, 3), 30, dtype=np.uint8)
    for _ in range(90):
        x, y = int(rng.integers(20, width - 60)), int(rng.integers(20, height - 60))
        w, h = int(rng.integers(12, 50)), int(rng.integers(12, 50))
        colour = tuple(int(c) for c in rng.integers(60, 255, 3))
        cv2.rectangle(frame, (x, y), (x + w, y + h), colour, -1)
    return frame


def shifted(frame, dx: int, dy: int):
    matrix = np.array([[1.0, 0.0, dx], [0.0, 1.0, dy]], dtype=np.float32)
    return cv2.warpAffine(frame, matrix, (frame.shape[1], frame.shape[0]))


def test_an_unmoved_camera_reports_no_shift() -> None:
    room = textured_room()

    assert view_shift_px(room, room.copy()) == pytest.approx(0.0, abs=1.0)


def test_a_nudged_camera_reports_how_far_it_moved() -> None:
    """A bump mid-session invalidates the homography; the size of it is the signal."""
    room = textured_room()

    assert view_shift_px(room, shifted(room, 20, -12)) == pytest.approx(23.3, abs=2.0)


def test_a_featureless_view_reports_nothing_rather_than_zero() -> None:
    """A lens cap or a blank wall must not read as "the camera has not moved"."""
    blank = np.full((480, 640, 3), 128, dtype=np.uint8)

    assert view_shift_px(blank, blank.copy()) is None


def test_matches_strung_along_one_line_report_nothing() -> None:
    """Plenty of matches, spread on one axis only, is not evidence about the camera.

    A row of objects along the table edge gives 121 matches spanning 79% of the
    width and 6% of the height. Points that agree about horizontal movement say
    nothing about vertical, and a camera rotating about that line would be
    reported as perfectly still.
    """
    row = np.full((480, 640, 3), 40, dtype=np.uint8)
    for i in range(6):
        cv2.rectangle(row, (40 + i * 95, 230), (70 + i * 95, 260), (210, 210, 210), -1)

    assert view_shift_px(row, row.copy()) is None


def test_a_view_with_too_few_features_reports_nothing() -> None:
    """Two dots in opposite corners span the frame and still prove nothing.

    They give 14 matches — enough to compute a confident-looking median from
    almost no evidence. The spread guard passes them, so the count floor is what
    catches this, and it has to be set where real rooms are: a room gives
    hundreds, two dots give fourteen.
    """
    sparse = np.full((480, 640, 3), 40, dtype=np.uint8)
    cv2.rectangle(sparse, (60, 60), (66, 66), (200, 200, 200), -1)
    cv2.rectangle(sparse, (560, 400), (566, 406), (200, 200, 200), -1)

    assert view_shift_px(sparse, sparse.copy()) is None


def test_matches_stacked_in_one_column_report_nothing() -> None:
    """The same failure turned ninety degrees: a doorframe, a shelf edge.

    The test above is caught by the vertical span alone, so on its own it never
    checks that the horizontal span is measured as a span rather than as a
    distance from the left edge.
    """
    column = np.full((480, 640, 3), 40, dtype=np.uint8)
    for i in range(6):
        cv2.rectangle(column, (300, 30 + i * 72), (330, 60 + i * 72), (210, 210, 210), -1)

    assert view_shift_px(column, column.copy()) is None
