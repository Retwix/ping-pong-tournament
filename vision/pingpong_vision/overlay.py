"""Drawing the calibration back onto the frame it came from.

The only honest check that six clicks landed where the operator meant: draw the
table and the net over the image and look. A homography built from slightly
wrong corners is still a perfectly valid homography — it just maps to the wrong
table, silently, which is exactly the failure this is here to make visible.
"""

from __future__ import annotations

import cv2
import numpy as np

from .calibration import Calibration, net_cm_of, to_table_cm, homography_of

TABLE = (0, 200, 255)     # BGR, the ball's orange
NET = (0, 255, 120)
TEXT = (255, 255, 255)


def draw_calibration(frame, calibration: Calibration):
    """Table outline, net line and the halves, over a copy of the frame."""
    canvas = frame.copy()
    corners = np.array(calibration.corners, dtype=np.int32)
    cv2.polylines(canvas, [corners], isClosed=True, color=TABLE, thickness=3)

    for point, label in zip(calibration.corners, ("NL", "NR", "FR", "FL")):
        cv2.circle(canvas, (int(point[0]), int(point[1])), 7, TABLE, -1)
        cv2.putText(canvas, label, (int(point[0]) + 12, int(point[1]) - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, TABLE, 2)

    ends = calibration.net_ends
    cv2.line(canvas, (int(ends[0][0]), int(ends[0][1])),
             (int(ends[1][0]), int(ends[1][1])), NET, 3)

    net_cm = net_cm_of(calibration)
    near, far = net_cm, calibration.length_cm - net_cm
    cv2.putText(canvas, f"net at {net_cm:.0f} cm   near half {near:.0f}   far half {far:.0f}",
                (20, 44), cv2.FONT_HERSHEY_SIMPLEX, 1.0, NET, 2)
    cv2.putText(canvas, f"table {calibration.length_cm:.0f} x {calibration.width_cm:.0f} cm",
                (20, 84), cv2.FONT_HERSHEY_SIMPLEX, 0.9, TABLE, 2)
    return canvas


def corner_residuals_cm(calibration: Calibration) -> list[float]:
    """How far each clicked corner lands from where the table says it should be.

    Zero by construction — the homography is fitted to exactly these four points.
    Useful only as a guard that the maths has not been rewired, not as a measure
    of whether the clicks were in the right place. Nothing can check that but eyes.
    """
    h = homography_of(calibration)
    expected = [
        (0.0, 0.0),
        (calibration.width_cm, 0.0),
        (calibration.width_cm, calibration.length_cm),
        (0.0, calibration.length_cm),
    ]
    out = []
    for clicked, want in zip(calibration.corners, expected):
        got = to_table_cm(h, clicked)
        out.append(float(np.hypot(got[0] - want[0], got[1] - want[1])))
    return out
