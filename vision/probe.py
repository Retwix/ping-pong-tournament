#!/usr/bin/env python3
"""M0 — prove the capture path before anything else gets built.

Answers the three questions the rest of the pipeline is tuned against:

  1. Does the iPhone show up, and at what resolution and *actual* framerate?
  2. What is the glass-to-screen latency?
  3. Does an orange ball separate cleanly from a white table, and at what
     saturation threshold?

Nothing here is part of the pipeline. It is a measuring instrument: run it,
report the numbers, and they become the constants everything downstream uses.

Usage
-----
    python3 probe.py --list                  # which capture devices exist
    python3 probe.py --source 1              # measure fps / resolution
    python3 probe.py --source 1 --latency    # measure end-to-end lag
    python3 probe.py --source 1 --mask       # tune the orange gate, with sliders
    python3 probe.py --source 1 --record clip.mp4   # capture footage for dev
"""

from __future__ import annotations

import argparse
import platform
import statistics
import sys
import time
from pathlib import Path

import cv2
import numpy as np

IS_MAC = platform.system() == "Darwin"

# Starting point for the orange gate. Saturation is the load-bearing one: a
# white table and grey shadows are unsaturated, an orange ball is not.
DEFAULT_GATE = {"hue_lo": 3, "hue_hi": 28, "sat_min": 110, "val_min": 90}

# Auto-exposure, the encoder and the transport all need a moment. M0 measured a
# 0.25-0.5 s stall on the first capture after the device has been idle, so this
# has to outlast that: 60 frames is ~2 s at 30 fps, ~1 s at 60.
WARMUP_FRAMES = 60


def measured_fps(timestamps: list[float]) -> float:
    """The rate frames actually arrived at, from their arrival times.

    The median gap, not the mean: a capture device stalls for a quarter to half
    a second on its first frames, and a mean would carry that into the number
    every later stage is tuned against.
    """
    gaps = [later - earlier for earlier, later in zip(timestamps, timestamps[1:])]
    return 1.0 / statistics.median(gaps)


def open_capture(source: int | str, width: int, height: int, fps: int) -> cv2.VideoCapture:
    """Open a device index, file path, or stream URL."""
    if isinstance(source, int):
        cap = cv2.VideoCapture(source, cv2.CAP_AVFOUNDATION if IS_MAC else cv2.CAP_ANY)
    else:
        cap = cv2.VideoCapture(source)

    # These are requests, not commands — the device is free to ignore them,
    # which is exactly why this script measures what actually arrives.
    if width:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    if height:
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    if fps:
        cap.set(cv2.CAP_PROP_FPS, fps)
    return cap


def list_devices(max_index: int = 6) -> None:
    """Probe device indices and report which ones deliver frames."""
    print("Scanning capture devices...\n")
    found = 0
    for idx in range(max_index):
        cap = cv2.VideoCapture(idx, cv2.CAP_AVFOUNDATION if IS_MAC else cv2.CAP_ANY)
        if not cap.isOpened():
            cap.release()
            continue
        ok, frame = cap.read()
        if ok and frame is not None:
            h, w = frame.shape[:2]
            print(f"  [{idx}]  {w}x{h}  (reported {cap.get(cv2.CAP_PROP_FPS):.0f} fps)")
            found += 1
        else:
            print(f"  [{idx}]  opens but delivers no frames")
        cap.release()

    if not found:
        print("  no usable devices found.")
    if IS_MAC:
        print(
            "\nOn macOS, a device that opens but delivers no frames is almost always\n"
            "a missing camera permission, not a broken camera: grant it under\n"
            "System Settings -> Privacy & Security -> Camera, for the terminal app\n"
            "running Python. OpenCV reports no error in that case.\n"
            "\nThe iPhone is usually the higher index; [0] is the built-in FaceTime\n"
            "camera. Plug the iPhone in and re-run to see which index appears."
        )


def measure(cap: cv2.VideoCapture, seconds: float, show: bool) -> None:
    """Measure delivered framerate and frame-interval jitter."""
    for _ in range(WARMUP_FRAMES):
        cap.read()

    gaps: list[float] = []
    drops = 0
    first = shape = None
    last = time.perf_counter()
    start = last

    while time.perf_counter() - start < seconds:
        ok, frame = cap.read()
        now = time.perf_counter()
        if not ok or frame is None:
            drops += 1
            continue
        if first is None:
            first, shape = now, frame.shape[:2]
        else:
            gaps.append((now - last) * 1000.0)
        last = now

        if show:
            cv2.imshow("probe", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    if not gaps:
        print("No frames captured. Check the device index and camera permission.")
        return

    gaps.sort()
    elapsed = last - first
    h, w = shape
    print(f"\n  resolution      {w}x{h}")
    print(f"  reported fps    {cap.get(cv2.CAP_PROP_FPS):.1f}   (often a lie)")
    print(f"  measured fps    {len(gaps) / elapsed:.1f}   <- the real number")
    print(f"  frame interval  p50 {statistics.median(gaps):.1f} ms   "
          f"p95 {gaps[int(len(gaps) * 0.95)]:.1f} ms   max {gaps[-1]:.1f} ms")
    print(f"  failed reads    {drops}")

    measured = len(gaps) / elapsed
    print()
    if measured >= 50:
        print("  Verdict: good. 60 fps class — bounce detection has plenty of samples.")
    elif measured >= 25:
        print("  Verdict: workable, but this is the 30 fps case the spec warns about\n"
              "  (~7 ball samples per length of table). Worth trying Camo/Iriun to\n"
              "  see if the same phone will give 60.")
    else:
        print("  Verdict: too slow. Try USB instead of wireless, drop the resolution\n"
              "  to 720p, or switch capture app.")
    if gaps[-1] > 4 * statistics.median(gaps):
        print("  Note: a large max interval means dropped frames — the tracker has to\n"
              "  coast through those, so mention it when reporting.")


def latency(cap: cv2.VideoCapture) -> None:
    """Glass-to-screen latency, by the photograph-the-clock trick.

    A millisecond counter is drawn on screen. Point the iPhone at that window:
    the video then shows the counter as it was when the light left the screen,
    so the gap between the number *in* the video and the number next to it is
    the round-trip latency.
    """
    print("\nPoint the iPhone at this window so the counter is visible in the video.")
    print("Read the number inside the video feed, subtract it from the big number")
    print("beside it — that difference, in ms, is the end-to-end latency.")
    print("Press q to stop.\n")

    start = time.perf_counter()
    while True:
        ok, frame = cap.read()
        if not ok or frame is None:
            continue
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        h, w = frame.shape[:2]
        panel = np.zeros((h, 420, 3), dtype=np.uint8)
        cv2.putText(panel, f"{elapsed_ms % 100000:05d}", (10, h // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 2.6, (255, 255, 255), 6)
        cv2.putText(panel, "now", (10, h // 2 + 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 200, 255), 2)
        cv2.imshow("latency", np.hstack([frame, panel]))
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break


def mask(cap: cv2.VideoCapture, gate: dict[str, int], *, replay: bool = False) -> None:
    """Tune the orange gate live, and report the largest surviving blob.

    The blob area matters as much as the threshold: it tells us how many pixels
    the ball actually occupies at each end of the table, which is what the
    depth-aware size gate in the spec is built from.
    """
    win = "orange gate"
    cv2.namedWindow(win)
    for name, hi in (("hue_lo", 179), ("hue_hi", 179), ("sat_min", 255), ("val_min", 255)):
        cv2.createTrackbar(name, win, gate[name], hi, lambda _v: None)

    print("\nHold the ball at the FAR end of the table, then the NEAR end.")
    print("Slide sat_min up until the table and the shadows go black and only the")
    print("ball stays white. Note the largest-blob area at each end.")
    print("Press q when the ball is clean at both ends.\n")

    for frame in frames(cap, replay=replay):
        for name in gate:
            gate[name] = cv2.getTrackbarPos(name, win)

        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        m = cv2.inRange(
            hsv,
            np.array([gate["hue_lo"], gate["sat_min"], gate["val_min"]], dtype=np.uint8),
            np.array([gate["hue_hi"], 255, 255], dtype=np.uint8),
        )
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

        contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        label = "no blob"
        if contours:
            biggest = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(biggest)
            x, y, w, h = cv2.boundingRect(biggest)
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            label = f"largest blob: {area:.0f} px2  ({w}x{h})"
        cv2.putText(frame, label, (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        side_by_side = np.hstack([frame, cv2.cvtColor(m, cv2.COLOR_GRAY2BGR)])
        cv2.imshow(win, cv2.resize(side_by_side, None, fx=0.5, fy=0.5))
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    print(f"\n  Tuned gate: {gate}")
    print("  Report these — they become the defaults for ball detection.")


# A live camera returns the odd empty read while it settles; an exhausted file
# returns nothing else, for ever. Only the consecutive count separates them.
EMPTY_READS_BEFORE_EOF = 30


def frames(cap: cv2.VideoCapture, *, replay: bool = False):
    """Yield frames until the source is exhausted.

    `replay` rewinds a file instead of stopping, so a short clip can be looped
    while sliders are being tuned against it.
    """
    empty = 0
    while True:
        ok, frame = cap.read()
        if ok and frame is not None:
            empty = 0
            yield frame
            continue
        empty += 1
        if empty < EMPTY_READS_BEFORE_EOF:
            continue
        if not replay:
            return
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        empty = 0


def settle(cap: cv2.VideoCapture, *, frames: int = WARMUP_FRAMES, now=time.perf_counter):
    """Discard the warm-up frames, and report the rate the rest arrived at.

    Returns (last frame, measured fps), or (None, None) if the device never
    delivers. Both are needed before a writer can be opened: the frame gives the
    real resolution, and the rate is the one fact a clip's header must carry.
    """
    stamps: list[float] = []
    frame = None
    for _ in range(frames * 4):  # attempts, not frames: a dead device returns fast
        ok, candidate = cap.read()
        if not ok or candidate is None:
            continue
        frame = candidate
        stamps.append(now())
        if len(stamps) == frames:
            return frame, measured_fps(stamps)
    return None, None


def open_video_writer(path: Path, fps: float, size: tuple[int, int]):
    return cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, size)


def record(
    cap: cv2.VideoCapture,
    path: Path,
    seconds: float,
    *,
    now=time.perf_counter,
    open_writer=open_video_writer,
    show: bool = True,
) -> None:
    """Record a clip, so the tracker can be developed against real footage.

    The clip is stamped with the rate frames *actually arrived* at, never the
    rate that was requested. A device is free to refuse `--fps`, and a clip whose
    header disagrees with its contents silently rescales time for every stage
    that later treats it as ground truth.
    """
    frame, fps = settle(cap, now=now)
    if frame is None or fps is None:
        print("No frames to record.")
        return
    h, w = frame.shape[:2]
    writer = open_writer(path, fps, (w, h))

    print(f"\nRecording {seconds:.0f}s to {path} at {fps:.1f} fps. Press q to stop early.")
    start = now()
    n = 0
    while now() - start < seconds:
        ok, frame = cap.read()
        if not ok or frame is None:
            continue
        writer.write(frame)
        n += 1
        if show:
            cv2.imshow("recording", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    writer.release()
    print(f"  wrote {n} frames to {path}")
    print("  Reminder: this is video of people. Keep it local, delete it when done,\n"
          "  and make sure whoever is playing knows it was recorded.")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true", help="scan for capture devices and exit")
    ap.add_argument("--source", default="0", help="device index, file path, or stream URL")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    ap.add_argument("--fps", type=int, default=60, help="requested fps (the device may refuse)")
    ap.add_argument("--seconds", type=float, default=10.0)
    ap.add_argument("--show", action="store_true", help="display frames while measuring")
    ap.add_argument("--latency", action="store_true", help="measure glass-to-screen lag")
    ap.add_argument("--mask", action="store_true", help="tune the orange gate")
    ap.add_argument("--record", type=Path, help="record a clip to this path")
    args = ap.parse_args()

    if args.list:
        list_devices()
        return 0

    source: int | str = int(args.source) if args.source.isdigit() else args.source
    is_file = isinstance(source, str) and Path(source).exists()
    cap = open_capture(source, args.width, args.height, args.fps)
    if not cap.isOpened():
        print(f"Could not open source {source!r}. Try --list.", file=sys.stderr)
        return 1

    try:
        if args.latency:
            latency(cap)
        elif args.mask:
            mask(cap, dict(DEFAULT_GATE), replay=is_file)
        elif args.record:
            record(cap, args.record, args.seconds)
        else:
            measure(cap, args.seconds, args.show)
    finally:
        cap.release()
        cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    sys.exit(main())
