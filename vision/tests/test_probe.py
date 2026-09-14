"""Tests for the M0 capture probe's pure logic — no camera, no OpenCV device."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

import probe
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


class FakeCapture:
    """A capture device that delivers frames, and lies about its rate.

    The lie is the point: the device reports the framerate that was *requested*,
    which is what the recorder used to believe.

    `stops_after` models a camera unplugged mid-session; `fails_every` models the
    intermittent empty reads a real device returns while it settles.
    """

    def __init__(
        self,
        *,
        reports_fps: float = 60.0,
        stops_after: int | None = None,
        fails_every: int | None = None,
    ) -> None:
        self._reports_fps = reports_fps
        self._stops_after = stops_after
        self._fails_every = fails_every
        self._attempts = 0
        self._delivered = 0

    def read(self) -> tuple[bool, object]:
        self._attempts += 1
        if self._fails_every and self._attempts % self._fails_every == 0:
            return False, None
        if self._stops_after is not None and self._delivered >= self._stops_after:
            return False, None
        self._delivered += 1
        return True, np.zeros((4, 4, 3), dtype=np.uint8)

    def get(self, _prop: int) -> float:
        return self._reports_fps

    def set(self, _prop: int, _value: float) -> bool:
        """Seeking back to the start, as a file source does."""
        self._delivered = 0
        return True


class SpyWriter:
    def __init__(self) -> None:
        self.frames_written = 0

    def write(self, _frame: object) -> None:
        self.frames_written += 1

    def release(self) -> None:
        pass


def ticking_clock(*, fps: float = 30.0, stall_before: int = 1) -> object:
    """A clock advancing one frame interval per call, with one cold-start stall."""
    stamps = iter(frame_timestamps(fps=fps, count=100_000, stall_before=stall_before))
    return lambda: next(stamps)


def spy_open_writer(opened: dict[str, float]):
    def open_writer(_path: object, fps: float, _size: tuple[int, int]) -> SpyWriter:
        opened["fps"] = fps
        return SpyWriter()

    return open_writer


def refusing_open_writer(*_args: object) -> SpyWriter:
    raise AssertionError("must not open a writer without a measured rate")


def test_records_at_the_rate_frames_arrive_not_the_rate_requested() -> None:
    opened: dict[str, float] = {}

    probe.record(
        FakeCapture(reports_fps=60.0),
        Path("unused.mp4"),
        seconds=1.0,
        now=ticking_clock(fps=48.0),
        open_writer=spy_open_writer(opened),
        show=False,
    )

    assert opened["fps"] == pytest.approx(48.0, abs=0.5)


def test_reports_when_the_capture_delivers_no_frames() -> None:
    probe.record(
        FakeCapture(stops_after=0),
        Path("unused.mp4"),
        seconds=1.0,
        now=ticking_clock(),
        open_writer=refusing_open_writer,
        show=False,
    )


def test_refuses_to_stamp_a_rate_when_the_camera_quits_mid_warmup() -> None:
    """A few frames then silence must not yield a fabricated framerate.

    This is the camera being unplugged, or the phone locking. Writing the clip
    anyway would stamp it with a rate measured from a handful of frames.
    """
    probe.record(
        FakeCapture(stops_after=5),
        Path("unused.mp4"),
        seconds=1.0,
        now=ticking_clock(),
        open_writer=refusing_open_writer,
        show=False,
    )


def test_settles_through_intermittent_empty_reads() -> None:
    """Every third read failing is a slow start, not a dead camera."""
    opened: dict[str, float] = {}

    probe.record(
        FakeCapture(fails_every=3),
        Path("unused.mp4"),
        seconds=1.0,
        now=ticking_clock(fps=48.0),
        open_writer=spy_open_writer(opened),
        show=False,
    )

    assert opened["fps"] == pytest.approx(48.0, abs=0.5)


def test_frame_stream_ends_when_the_source_is_exhausted() -> None:
    """A clip that ends must end the loop, not spin on empty reads for ever."""
    stream = probe.frames(FakeCapture(stops_after=7))

    assert len(list(stream)) == 7


def test_frame_stream_survives_intermittent_empty_reads() -> None:
    """A live camera returns the occasional empty read; that is not the end.

    Every other read fails here, so the empty reads far outnumber the threshold
    in total while never once being consecutive. Counting them cumulatively
    would cut the stream off mid-clip.
    """
    stream = probe.frames(FakeCapture(stops_after=100, fails_every=2))

    assert len(list(stream)) == 100


def test_frame_stream_replays_a_file_when_asked() -> None:
    """Tuning sliders against a short clip needs the clip to keep playing."""
    stream = probe.frames(FakeCapture(stops_after=4), replay=True)

    collected = [frame for _, frame in zip(range(10), stream)]

    assert len(collected) == 10
