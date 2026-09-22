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
import random
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


def read_truth(path: Path) -> list[int]:
    """The frames where a human marked a point as won — see the README.

    These are *point endings*, not bounces, and not ball positions. By the
    time one is marked the rally is over: the ball is in the net, on the
    floor, or being picked up, and a few hundred ms of reaction time has
    passed on top. Asking whether a track was alive on that exact frame
    asks whether the tracker was following a dead ball.

    What the file can honestly answer is whether the rally *leading up to*
    each point was being followed at all. That is what `--lookback` is for —
    and the answer, measured, is that it answers nothing: at 48% coverage a
    window that size lands on some track almost wherever it is put. The
    printed score is therefore shown against the same score for random
    frames, and has meant nothing so far.
    """
    rows = path.read_text().strip().splitlines()[1:]
    return [int(row.split(",")[0]) for row in rows]


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
    ap.add_argument("--truth", type=Path, default=None,
                    help="frames where a point was marked won; reports rallies followed")
    ap.add_argument("--travel", type=float, default=100.0,
                    help="px a path must span before it counts as a ball in play")
    ap.add_argument("--lookback", type=int, default=60,
                    help="frames before a point mark to count as that rally")
    args = ap.parse_args()

    calibration = load_calibration(args.calibration)
    gate = dict(DEFAULT_GATE)
    if args.sat_min is not None:
        gate["sat_min"] = args.sat_min

    print(f"\n  sat_min {gate['sat_min']}, gate {args.gate:.0f} px, coast {args.coast}, "
          f"least {args.least}, tolerance {args.tolerance:.0f} px, every {args.every}, "
          f"motion {'on' if args.motion else 'off'}, margin {args.margin:.0f} cm, "
          f"travel {args.travel:.0f} px\n")
    if args.truth and len(args.clips) != 1:
        print("--truth describes one clip; pass exactly one", file=sys.stderr)
        return 2
    truth = read_truth(args.truth) if args.truth else []
    print(f"    {'clip':22} {'frames':>7} {'tracks':>7} {'tracked':>8} {'longest':>8}"
          + (f" {'rallies followed':>17} {'(chance)':>9}" if truth else ""))

    for clip in args.clips:
        per_frame = list(candidates_per_frame(clip, calibration, gate, args.every, args.motion, args.margin))
        if not per_frame:
            print(f"    {clip:22}   no frames read", file=sys.stderr)
            continue
        tracks = follow(per_frame, gate_px=args.gate, coast=args.coast,
                        least=args.least, tolerance_px=args.tolerance,
                        least_travel_px=args.travel)
        covered = {sample for track in tracks
                   for sample in range(track.start, track.start + len(track.seen))}
        longest = max((len(t.seen) for t in tracks), default=0)
        line = (f"    {clip:22} {len(per_frame):7d} {len(tracks):7d} "
                f"{len(covered) / len(per_frame) * 100:7.1f}% {longest:8d}")
        if truth:
            def followed(marks: list[int]) -> int:
                return sum(any(sample in covered
                               for sample in range((mark - args.lookback - 1) // args.every,
                                                   (mark - 1) // args.every + 1))
                           for mark in marks)

            rng = random.Random(0)
            population = range(args.lookback + 1, len(per_frame) * args.every)
            chance = [followed(rng.sample(population, len(truth))) for _ in range(200)]
            line += (f" {followed(truth):9d} of {len(truth):<4d}"
                     f" {sum(chance) / len(chance):8.1f}")
        print(line)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
