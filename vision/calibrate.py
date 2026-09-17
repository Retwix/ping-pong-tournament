#!/usr/bin/env python3
"""Click the table and the net, once per session.

    python3 calibrate.py --source 1
    python3 calibrate.py --source empty-table.mp4 --out fixtures/calibration.json

Six clicks: four corners, then the two ends of the net. The net is clicked and
never assumed -- a clamp-on net sits where the legs allow, and section 8 awards
the point to the side opposite the last table bounce, so the net line is the
decision boundary itself. Guessing it hands points to the wrong player.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2

from pingpong_vision.calibration import (
    Calibration,
    net_cm_of,
    next_prompt,
    save_calibration,
)
from pingpong_vision.overlay import draw_calibration

WINDOW = "calibrate - click, u undoes, enter saves, esc quits"
MAX_WIDTH = 1280


def first_frame(source: str):
    """A settled frame to click on, from a camera or a recorded clip.

    Reads 60 frames and keeps the last: a camera needs that long to get past
    the cold-start stall, and on a file it simply lands a little way in.
    """
    cap = cv2.VideoCapture(int(source) if source.isdigit() else source)
    frame = None
    for _ in range(60):
        ok, candidate = cap.read()
        if ok and candidate is not None:
            frame = candidate
    cap.release()
    return frame


def collect_clicks(frame) -> list[tuple[float, float]] | None:
    """Six points, in CLICK_ORDER. None if the operator quits."""
    scale = min(1.0, MAX_WIDTH / frame.shape[1])
    shown = cv2.resize(frame, None, fx=scale, fy=scale)
    clicks: list[tuple[float, float]] = []

    def on_mouse(event, x, y, _flags, _param):
        if event == cv2.EVENT_LBUTTONDOWN and len(clicks) < 6:
            clicks.append((x / scale, y / scale))

    cv2.namedWindow(WINDOW)
    cv2.setMouseCallback(WINDOW, on_mouse)

    while True:
        canvas = shown.copy()
        for index, (x, y) in enumerate(clicks):
            colour = (0, 200, 255) if index < 4 else (0, 255, 120)
            cv2.circle(canvas, (int(x * scale), int(y * scale)), 6, colour, -1)
        prompt = next_prompt(len(clicks))
        instruction = f"click: {prompt}" if prompt else "enter to save, u to undo"
        cv2.putText(canvas, instruction, (14, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2)
        cv2.imshow(WINDOW, canvas)

        key = cv2.waitKey(20) & 0xFF
        if key == 27:
            cv2.destroyWindow(WINDOW)
            return None
        if key == ord("u") and clicks:
            clicks.pop()
        if key in (13, 10) and len(clicks) == 6:
            cv2.destroyWindow(WINDOW)
            return clicks


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", default="1", help="device index, file path, or URL")
    ap.add_argument("--out", type=Path, default=Path("calibration.json"))
    ap.add_argument("--length-cm", type=float, default=280.0, help="end to end")
    ap.add_argument("--width-cm", type=float, default=140.0)
    args = ap.parse_args()

    frame = first_frame(args.source)
    if frame is None:
        print(f"No frames from {args.source!r}.", file=sys.stderr)
        return 1

    clicks = collect_clicks(frame)
    if clicks is None:
        print("Cancelled; nothing written.")
        return 1

    calibration = Calibration(
        corners=tuple(clicks[:4]),
        net_ends=tuple(clicks[4:]),
        length_cm=args.length_cm,
        width_cm=args.width_cm,
    )
    net = net_cm_of(calibration)
    print(f"\n  net at {net:.1f} cm of {args.length_cm:.0f}"
          f"   halves {net:.0f} / {args.length_cm - net:.0f}")
    if abs(net - args.length_cm / 2) > 40:
        print("  That is a long way off centre. Check the net ends were clicked last.")

    save_calibration(args.out, calibration)
    print(f"  saved {args.out}")

    cv2.imshow("calibration - any key closes", draw_calibration(frame, calibration))
    cv2.waitKey(0)
    cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    sys.exit(main())
