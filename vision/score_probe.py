#!/usr/bin/env python3
"""What the pipeline scores, against the points a person marked.

track_probe.py asks how much of a clip a believable path covers, and §7
settled that the answer means nothing on its own: loosening `--travel` took
coverage from 51% to 65% and accuracy from 87.5% to 60%, because the paths it
admitted were arms. **Judge everything by points.** This is the thing that
judges them.

Every figure in §7 — the points table, the bounce-margin sweep, the travel
trade — was measured by a throwaway script that replayed §8's scoring rule
itself, so the published numbers came from a copy of `points_from` rather than
from `points_from`. This runs the shipped chain end to end and has no rule of
its own.

    python3 score_probe.py rally.mp4 \\
        --calibration fixtures/calibration-2026-09-16.json \\
        --truth rally.truth.csv

The defaults are §5 and §7's measured values, not guesses; the README records
where each came from.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pingpong_vision.calibration import load_calibration
from pingpong_vision.labels import read_outcomes, score_points
from pingpong_vision.rally import events_from, points_from
from pingpong_vision.track import Track, follow
from probe import DEFAULT_GATE
from track_probe import candidates_per_frame


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("clip")
    ap.add_argument("--calibration", type=Path, required=True)
    ap.add_argument("--truth", type=Path, required=True,
                    help="points a person marked: frame,seconds,side")
    ap.add_argument("--gate", type=float, default=25.0,
                    help="px a candidate may sit from the prediction")
    ap.add_argument("--reach", type=float, default=100.0,
                    help="px a path may reach while it has no arc to predict from")
    ap.add_argument("--coast", type=int, default=4, help="frames a track survives unseen")
    ap.add_argument("--least", type=int, default=6, help="sightings before a track is believed")
    ap.add_argument("--tolerance", type=float, default=30.0,
                    help="px a sighting may miss its arc by")
    ap.add_argument("--travel", type=float, default=150.0,
                    help="px a path must span before it counts as a ball in play")
    ap.add_argument("--margin", type=float, default=900.0,
                    help="cm past the table edge a candidate may project to")
    ap.add_argument("--dwell", type=int, default=21,
                    help="frames a ball may be lost for and still be the same rally")
    ap.add_argument("--cooldown", type=int, default=90,
                    help="frames after a point in which nothing scores")
    ap.add_argument("--near", default="left", choices=("left", "right"),
                    help="which side of the frame the near half is; measured as left "
                         "on the 2026-09-16 footage, 6 correct against 0 for the other")
    ap.add_argument("--before", type=int, default=120,
                    help="frames before a mark an award may fall and still be that point")
    ap.add_argument("--after", type=int, default=15,
                    help="frames after a mark an award may fall and still be that point")
    args = ap.parse_args()

    calibration = load_calibration(args.calibration)
    marked = read_outcomes(args.truth)
    per_frame = list(candidates_per_frame(args.clip, calibration, dict(DEFAULT_GATE),
                                          1, False, args.margin))
    if not per_frame:
        print(f"    {args.clip}: no frames read", file=sys.stderr)
        return 1

    # sample k is video frame k + 1; the marks are video frames
    tracks = [Track(track.start + 1, track.seen) for track in
              follow(per_frame, gate_px=args.gate, reach_px=args.reach, coast=args.coast,
                     least=args.least, tolerance_px=args.tolerance,
                     least_travel_px=args.travel)]
    awarded = points_from(events_from(tracks, calibration, dwell_frames=args.dwell),
                          cooldown_frames=args.cooldown)
    sides = {"near": args.near, "far": "right" if args.near == "left" else "left"}
    score = score_points(marked, awarded, sides=sides,
                         before_frames=args.before, after_frames=args.after)

    print(f"\n  {args.clip}: {len(per_frame)} frames, {len(tracks)} tracks, "
          f"travel {args.travel:.0f} px, dwell {args.dwell}, cooldown {args.cooldown}\n")
    print(f"    {'found':>12} {score.found:3d} of {score.marked}")
    print(f"    {'correct':>12} {score.correct:3d}")
    print(f"    {'spurious':>12} {score.spurious:3d}")
    print(f"    {'awarded':>12} {len(awarded):3d}")
    accuracy = score.correct / len(awarded) * 100 if awarded else 0.0
    print(f"    {'accuracy':>12} {accuracy:6.1f}%   (§15 wants 90%)")
    print(f"    {'rally ends':>12} {score.found / score.marked * 100:6.1f}%   (§15 wants 95%)\n")
    # each point judged alone, which is the same rule applied to a list of one
    for outcome in marked:
        alone = score_points([outcome], awarded, sides=sides,
                             before_frames=args.before, after_frames=args.after)
        verdict = ("missed" if not alone.found
                   else "correct" if alone.correct else "wrong player")
        print(f"    f{outcome.frame:5d} {outcome.side:5}  {verdict}")
    print(f"\n    awarded at: {', '.join(f'f{p.frame} {p.side}' for p in awarded)}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
