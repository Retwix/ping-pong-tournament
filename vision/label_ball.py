#!/usr/bin/env python3
"""Click the ball, frame by frame, so the tracker can be marked against it.

    python3 label_ball.py rally.mp4
    python3 label_ball.py rally.mp4 --every 25

Every answer is written the moment it is given, and reopening offers only what
is still unanswered — so this is done in whatever time there is, five minutes
at a sitting, and closing the window costs nothing.

§5 can say the tracker's paths are the ball; it cannot say how many of the
ball's flights it missed, because nothing records where the ball was. That is
the one thing in this pipeline a machine cannot supply. ~200 frames is the
scale that worked for tennis-cv, which is roughly `--every 25` on a 3 minute
clip.

    click   the centre of the ball
    n       the ball cannot be seen in this frame
    u       undo the last answer, including one from an earlier sitting
    q/esc   stop; everything so far is already saved
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

from pingpong_vision.labels import (
    Label,
    append_label,
    drop_last_label,
    read_labels,
    unlabelled,
)

WINDOW = "label the ball - click it, n if hidden, u undoes, q saves and quits"
MAX_WIDTH = 1500
ZOOM = 4
LENS = 90                 # full-res px sampled into the magnifier


def frame_count(clip: str) -> int:
    capture = cv2.VideoCapture(clip)
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    capture.release()
    return total


def magnifier(frame, at: tuple[int, int]):
    """A zoomed patch under the cursor.

    The ball runs 11-34 px across (§5), and the frame is shown shrunk to fit a
    screen, so the target is a handful of pixels wide at the moment of
    clicking. Without this the labels would carry the labeller's aim as noise,
    and the miss rate being measured is a few pixels' worth of question.
    """
    x, y = at
    half = LENS // 2
    x0, y0 = max(0, x - half), max(0, y - half)
    patch = frame[y0:y0 + LENS, x0:x0 + LENS]
    if patch.size == 0:
        return None
    patch = cv2.resize(patch, None, fx=ZOOM, fy=ZOOM, interpolation=cv2.INTER_NEAREST)
    centre = ((x - x0) * ZOOM, (y - y0) * ZOOM)
    cv2.drawMarker(patch, centre, (0, 255, 255), cv2.MARKER_CROSS, 22, 1)
    cv2.rectangle(patch, (0, 0), (patch.shape[1] - 1, patch.shape[0] - 1), (255, 255, 255), 1)
    return patch


def ask(frame, caption: str) -> tuple[float, float] | str:
    """Show one frame and wait. A point, or one of 'hidden', 'undo', 'stop'."""
    scale = min(1.0, MAX_WIDTH / frame.shape[1])
    shown = cv2.resize(frame, None, fx=scale, fy=scale)
    state: dict[str, object] = {"click": None, "mouse": (0, 0)}

    def on_mouse(event, x, y, _flags, _param):
        state["mouse"] = (int(x / scale), int(y / scale))
        if event == cv2.EVENT_LBUTTONDOWN:
            state["click"] = (x / scale, y / scale)

    cv2.namedWindow(WINDOW)
    cv2.setMouseCallback(WINDOW, on_mouse)

    while True:
        canvas = shown.copy()
        cv2.rectangle(canvas, (0, 0), (canvas.shape[1], 40), (0, 0, 0), -1)
        cv2.putText(canvas, caption, (14, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                    (255, 255, 255), 2)

        # The magnifier sits in whichever top corner the cursor is furthest
        # from, and the click that matters is always the one on the frame
        # underneath. Parking it under the pointer would invite a click on the
        # zoomed copy, which lands wherever the inset happens to be pasted and
        # records a ball that was never there.
        lens = magnifier(frame, state["mouse"])
        if lens is not None:
            h, w = lens.shape[:2]
            on_the_left = state["mouse"][0] * scale < canvas.shape[1] / 2
            x0 = canvas.shape[1] - w - 10 if on_the_left else 10
            canvas[46:46 + h, x0:x0 + w] = lens
        cv2.imshow(WINDOW, canvas)

        key = cv2.waitKey(20) & 0xFF
        if state["click"] is not None:
            return state["click"]
        if key in (ord("q"), 27):
            return "stop"
        if key == ord("n"):
            return "hidden"
        if key == ord("u"):
            return "undo"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clip")
    ap.add_argument("--every", type=int, default=25, help="label every Nth frame")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    out = args.out or Path(args.clip).with_suffix(".labels.csv")
    total = frame_count(args.clip)
    if total <= 0:
        print(f"No frames in {args.clip!r}.", file=sys.stderr)
        return 1
    planned = list(range(args.every, total + 1, args.every))

    capture = cv2.VideoCapture(args.clip)
    try:
        while True:
            done = read_labels(out)
            todo = unlabelled(planned, done)
            if not todo:
                print(f"\n  all {len(planned)} frames answered -> {out}")
                return 0

            frame_no = todo[0]
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_no - 1)
            ok, frame = capture.read()
            if not ok:
                print(f"Could not read frame {frame_no}.", file=sys.stderr)
                return 1

            seen = sum(1 for label in done if label.at)
            caption = (f"frame {frame_no}  |  {len(done)} of {len(planned)} done"
                       f"  ({seen} with a ball)  |  click / n hidden / u undo / q quit")
            answer = ask(frame, caption)

            if answer == "stop":
                print(f"\n  {len(done)} of {len(planned)} answered, saved to {out}")
                print("  run the same command again to carry on")
                return 0
            if answer == "undo":
                drop_last_label(out)
            elif answer == "hidden":
                append_label(out, Label(frame_no, None))
            else:
                append_label(out, Label(frame_no, answer))
    finally:
        capture.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    sys.exit(main())
