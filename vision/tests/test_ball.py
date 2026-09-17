"""Deciding whether a blob could be the ball, at the place it appears."""

from __future__ import annotations

import pytest

from pingpong_vision.ball import expected_ball_px, on_the_table
from pingpong_vision.calibration import Calibration, homography_of

TABLE = Calibration(
    corners=((200.0, 1000.0), (1700.0, 1000.0), (1200.0, 400.0), (700.0, 400.0)),
    net_ends=((430.0, 620.0), (1130.0, 620.0)),
    length_cm=280.0,
    width_cm=140.0,
)


def test_the_ball_is_larger_near_the_camera_than_at_the_far_end() -> None:
    """The size gate has to move with depth, or it is useless at one end.

    A 40 mm ball does not change size; its image does. One fixed pixel threshold
    either rejects the far ball or accepts every speck near the camera.
    """
    h = homography_of(TABLE)

    near = expected_ball_px(h, (70.0, 20.0))
    far = expected_ball_px(h, (70.0, 260.0))

    assert near > far * 2


def test_the_expected_size_is_the_real_ball_projected_not_a_guess() -> None:
    """40 mm through the homography, so another table or lens needs no retuning."""
    h = homography_of(TABLE)

    doubled = expected_ball_px(h, (70.0, 140.0), ball_mm=80.0)
    normal = expected_ball_px(h, (70.0, 140.0), ball_mm=40.0)

    assert doubled == pytest.approx(normal * 2, rel=0.05)


def test_a_bounce_beyond_the_edge_is_not_on_the_table() -> None:
    """Floor bounces are told from table bounces by exactly this."""
    assert on_the_table((70.0, 140.0), TABLE) is True
    assert on_the_table((70.0, 305.0), TABLE) is False
    assert on_the_table((-20.0, 140.0), TABLE) is False


def test_a_margin_keeps_an_edge_ball_on_the_table() -> None:
    """A ball clipping the edge is still a table bounce; clicks are not exact."""
    assert on_the_table((70.0, 284.0), TABLE, margin_cm=8.0) is True
    assert on_the_table((70.0, 284.0), TABLE, margin_cm=0.0) is False
