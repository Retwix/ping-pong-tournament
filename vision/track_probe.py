#!/usr/bin/env python3
"""How much of a clip is covered by a path that behaved like a ball?

detect_probe.py asks what a single frame contains, and d7a2179 measured its
answer: a rally and a warm-up look the same to it, because one frame cannot
tell a ball from a forearm. This asks the question that needs several frames.
If classical detection works at all, a rally should score far above a warm-up
here, and an empty table should score zero.

    python3 track_probe.py rally.mp4 warmup.mp4 \
        --calibration fixtures/calibration-2026-09-16.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

from pingpong_vision.ball import ball_candidates
from pingpong_vision.calibration import load_calibration
from pingpong_vision.track import follow
from probe import DEFAULT_GATE


def candidates_per_frame(clip: str, calibration, gate: dict[str, int], every: int,
                         motion: bool, margin_cm: float):
    """Image-space candidate positions, one list per sampled frame.

    Sampling every Nth frame is safe for the motion model as long as N never
    changes — the arc is still an arc at any uniform spacing — but it does
    multiply how far the ball moves between samples, so --gate has to grow
    with it.

    The background model is fed every frame even when the frame is not
    sampled: it is learning what the room looks like, and skipping frames
    would have it learn a room that flickers.
    """
    capture = cv2.VideoCapture(clip)
    background = cv2.createBackgroundSubtractorMOG2(detectShadows=False) if motion else None
    index = 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        foreground = background.apply(frame) if background else None
        index += 1
        if index % every:
            continue
        yield [centre for centre, _, _
               in ball_candidates(frame, calibration, gate, foreground=foreground,
                                  margin_cm=margin_cm)]
    capture.release()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("clips", nargs="+")
    ap.add_argument("--calibration", type=Path, required=True)
    ap.add_argument("--every", type=int, default=1)
    ap.add_argument("--sat-min", type=int, default=None)
    ap.add_argument("--gate", type=float, default=200.0, help="px a candidate may sit from the prediction")
    ap.add_argument("--coast", type=int, default=4, help="frames a track survives unseen")
    ap.add_argument("--least", type=int, default=6, help="sightings before a track is believed")
    ap.add_argument("--tolerance", type=float, default=30.0, help="px a sighting may miss its arc by")
    ap.add_argument("--motion", action="store_true", help="§5 step 1: require MOG2 foreground")
    ap.add_argument("--margin", type=float, default=150.0,
                    help="cm past the table edge a candidate may project to")
    args = ap.parse_args()

    calibration = load_calibration(args.calibration)
    gate = dict(DEFAULT_GATE)
    if args.sat_min is not None:
        gate["sat_min"] = args.sat_min

    print(f"\n  sat_min {gate['sat_min']}, gate {args.gate:.0f} px, coast {args.coast}, "
          f"least {args.least}, tolerance {args.tolerance:.0f} px, every {args.every}, "
          f"motion {'on' if args.motion else 'off'}, margin {args.margin:.0f} cm\n")
    print(f"    {'clip':22} {'frames':>7} {'tracks':>7} {'tracked':>8} {'longest':>8}")

    for clip in args.clips:
        per_frame = list(candidates_per_frame(clip, calibration, gate, args.every, args.motion, args.margin))
        if not per_frame:
            print(f"    {clip:22}   no frames read", file=sys.stderr)
            continue
        tracks = follow(per_frame, gate_px=args.gate, coast=args.coast,
                        least=args.least, tolerance_px=args.tolerance)
        covered = sum(len(t) for t in tracks)
        longest = max((len(t) for t in tracks), default=0)
        print(f"    {clip:22} {len(per_frame):7d} {len(tracks):7d} "
              f"{covered / len(per_frame) * 100:7.1f}% {longest:8d}")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
