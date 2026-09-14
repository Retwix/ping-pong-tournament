"""Tests for the M0 capture probe's pure logic — no camera, no OpenCV device."""

from __future__ import annotations

import pytest

from probe import measured_fps


def frame_timestamps(
    *,
    fps: float = 30.0,
    count: int = 60,
    stall_before: int | None = None,
    stall_seconds: float = 0.5,
) -> list[float]:
    """Arrival times for `count` frames delivered at `fps`.

    `stall_before` inserts one late frame at that position, modelling the
    cold-start freeze a Continuity Camera link shows on first capture.
    """
    interval = 1.0 / fps
    stamps: list[float] = []
    clock = 0.0
    for index in range(count):
        if index == stall_before:
            clock += stall_seconds
        else:
            clock += interval
        stamps.append(clock)
    return stamps


def test_reports_the_delivered_rate_despite_a_cold_start_stall() -> None:
    stamps = frame_timestamps(fps=30.0, count=60, stall_before=1, stall_seconds=0.5)

    assert measured_fps(stamps) == pytest.approx(30.0, abs=0.5)
