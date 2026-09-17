#!/usr/bin/env python3
"""How often does the colour+size+table gate find exactly one ball?

A ceiling, not a tracker. No motion model, no track continuity, no bounce
detection — just: per frame, how many plausible balls are on the table. If this
cannot find one ball most of the time, no amount of tracking on top will save it.

    python3 detect_probe.py rally.mp4 --calibration fixtures/calibration-2026-09-16.json
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

import cv2

from pingpong_vision.ball import ball_candidates
from pingpong_vision.calibration import load_calibration
from probe import DEFAULT_GATE


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("clip")
    ap.add_argument("--calibration", type=Path, required=True)
    ap.add_argument("--every", type=int, default=2, help="sample every Nth frame")
    ap.add_argument("--sat-min", type=int, default=None, help="override the gate")
    args = ap.parse_args()

    calibration = load_calibration(args.calibration)
    gate = dict(DEFAULT_GATE)
    if args.sat_min is not None:
        gate["sat_min"] = args.sat_min

    cap = cv2.VideoCapture(args.clip)
    counts: Counter[int] = Counter()
    frames = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames += 1
        if frames % args.every:
            continue
        counts[min(len(ball_candidates(frame, calibration, gate)), 3)] += 1
    cap.release()

    sampled = sum(counts.values())
    if not sampled:
        print("No frames read.", file=sys.stderr)
        return 1

    print(f"\n  {args.clip}  —  {sampled} frames sampled, sat_min {gate['sat_min']}\n")
    labels = {0: "nothing found", 1: "exactly one", 2: "two candidates", 3: "three or more"}
    for n in (0, 1, 2, 3):
        pct = counts[n] / sampled * 100
        print(f"    {labels[n]:16} {pct:5.1f}%  {'#' * int(pct / 2)}")
    print(f"\n    one-or-more: {(sampled - counts[0]) / sampled * 100:.1f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
