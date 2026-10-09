#!/usr/bin/env python3
"""Watch a clip and say who won each point, so §15 has a sample worth deciding on.

    ./.venv/bin/python label_points.py warmup.mp4
    ./.venv/bin/python label_points.py warmup.mp4 --out warmup.truth.csv

Every §15 number currently rests on twelve hand-typed points: 87.5% accuracy
is 7 of 8 awards, 70% is 7 of 10, and the gap between the settings §7 argues
over is two of them. §15 asks for ~100. `warmup.mp4` alone holds about forty
rallies — a warm-up rally still ends in a fault by exactly one player, which
is all §8's rule reads — and `rally.mp4` has more than the twelve marked.

Marked in real time on purpose. The truth file records *when a person saw the
point end*, which lands after the ball is down plus a reaction, and
`score_points` absorbs that with a window reaching 120 frames back and 15
forward. Marking frame-by-frame would produce a cleaner number that the
scorer is not built to be judged against.

    l / r   the player on the left / right won this point
    space   pause, and play again
    , / .   while paused, step one frame back / forward
    u       undo the last point, and rewind to just before it
    q/esc   stop; everything so far is already saved

Resumes where it stopped: reopening seeks to just after the last point marked.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

from pingpong_vision.labels import (
    Outcome,
    append_outcome,
    drop_last_outcome,
    read_outcomes,
)

WINDOW = "mark the points - l/r who won, space pauses, u undoes, q saves and quits"
MAX_WIDTH = 1500
LEAD_IN = 3.0             # seconds of run-up after a resume or an undo


def run_up_to(frame: int, fps: float, *, seconds: float) -> int:
    """The frame to start playing from so a mark has a rally in front of it.

    Both resuming and undoing land here, because what is being judged is a
    rally and not a frame: dropped exactly on the previous mark the ball is
    already dead, which says nothing about who put it there. Three seconds is
    about two shots at the rate §2 measured.

    Clamped at zero. A point marked in the opening seconds has no run-up to
    give, and seeking to a negative frame rewinds some backends to the end of
    the clip instead of to the start of it.
    """
    return max(0, int(frame - seconds * fps))


def caption_for(frame_no: int, fps: float, marked: list[Outcome], paused: bool) -> str:
    """One line of state, because everything here is a judgement in flight.

    The last mark is on it so a double-tap is visible immediately: the cost of
    one is a point in the wrong place in the file, and the cost of noticing
    late is not knowing which of the rows is the spurious one.
    """
    at = f"{frame_no / fps:6.1f}s  f{frame_no}"
    tally = f"{len(marked)} marked"
    if marked:
        last = marked[-1]
        tally += f", last f{last.frame} {last.side}"
    return f"{at}  |  {tally}  |  {'PAUSED' if paused else 'playing'}  |  l/r u q"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clip")
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--speed", type=float, default=1.0,
                    help="playback rate. Above 1 the reaction lag grows in frames "
                         "while score_probe's window does not, so the marks drift "
                         "out of it; 1.0 is what the window was measured against")
    args = ap.parse_args()

    out = args.out or Path(args.clip).with_suffix(".truth.csv")
    capture = cv2.VideoCapture(args.clip)
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        print(f"No frames in {args.clip!r}.", file=sys.stderr)
        capture.release()
        return 1

    marked = read_outcomes(out)
    if marked:
        resume = run_up_to(marked[-1].frame, fps, seconds=LEAD_IN)
        capture.set(cv2.CAP_PROP_POS_FRAMES, resume)
        print(f"\n  {len(marked)} already marked in {out}; resuming at f{resume}, "
              f"which replays the last one")

    delay = max(1, int(1000.0 / (fps * max(args.speed, 0.01))))
    paused = False
    frame = None
    frame_no = int(capture.get(cv2.CAP_PROP_POS_FRAMES))
    cv2.namedWindow(WINDOW)
    try:
        while True:
            if frame is None or not paused:
                ok, read = capture.read()
                if not ok:
                    print(f"\n  end of clip. {len(marked)} points marked -> {out}")
                    return 0
                frame, frame_no = read, int(capture.get(cv2.CAP_PROP_POS_FRAMES))

            scale = min(1.0, MAX_WIDTH / frame.shape[1])
            canvas = cv2.resize(frame, None, fx=scale, fy=scale)
            cv2.rectangle(canvas, (0, 0), (canvas.shape[1], 40), (0, 0, 0), -1)
            cv2.putText(canvas, caption_for(frame_no, fps, marked, paused), (14, 28),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            cv2.imshow(WINDOW, canvas)

            key = cv2.waitKey(1 if paused else delay)
            if key < 0:
                continue
            key &= 0xFF

            if key in (ord("q"), 27):
                print(f"\n  {len(marked)} points marked, saved to {out}")
                print("  run the same command again to carry on")
                return 0
            if key == ord(" "):
                paused = not paused
            elif key in (ord("l"), ord("r")):
                side = "left" if key == ord("l") else "right"
                append_outcome(out, Outcome(frame_no, side), seconds=frame_no / fps)
                marked = read_outcomes(out)
            elif key == ord("u") and marked:
                dropped = marked[-1]
                drop_last_outcome(out)
                marked = read_outcomes(out)
                capture.set(cv2.CAP_PROP_POS_FRAMES,
                            run_up_to(dropped.frame, fps, seconds=LEAD_IN))
                frame, paused = None, False
            elif paused and key in (ord(","), ord(".")):
                step = -1 if key == ord(",") else 1
                target = min(max(0, frame_no - 1 + step), total - 1)
                capture.set(cv2.CAP_PROP_POS_FRAMES, target)
                ok, read = capture.read()
                if ok:
                    frame, frame_no = read, int(capture.get(cv2.CAP_PROP_POS_FRAMES))
    finally:
        capture.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    sys.exit(main())
