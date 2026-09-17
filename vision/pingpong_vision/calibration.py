"""Mapping what the camera sees onto the table surface.

Pure geometry: no camera, no capture, no OpenCV window. The four clicked corners
become a homography, and any image point can then be expressed in centimetres on
the table plane — which is what lets a bounce be placed on a half.

Table dimensions are parameters, never constants. The surface this was built for
is two 140 cm office desks, 280 x 140 cm, which is neither regulation nor the
same proportions as regulation; the next room will differ again.
"""

from __future__ import annotations

import cv2
import numpy as np

Point = tuple[float, float]

# Clicked near-left, near-right, far-right, far-left — the order a person
# naturally goes round a table, starting at the corner nearest them.
CORNER_ORDER = ("near-left", "near-right", "far-right", "far-left")


def table_homography(corners: list[Point], *, length_cm: float, width_cm: float) -> np.ndarray:
    """Map image pixels onto the table plane, in centimetres.

    `corners` are clicked in CORNER_ORDER. The table plane puts x across the
    width and y along the length, with y = 0 at the near end, so a bounce's half
    is read straight off y.
    """
    if len(corners) != 4:
        raise ValueError(f"need 4 corners in {CORNER_ORDER} order, got {len(corners)}")

    source = np.array(corners, dtype=np.float32)
    destination = np.array(
        [(0.0, 0.0), (width_cm, 0.0), (width_cm, length_cm), (0.0, length_cm)],
        dtype=np.float32,
    )
    return cv2.getPerspectiveTransform(source, destination)


def to_table_cm(homography: np.ndarray, point: Point) -> Point:
    """Where on the table, in centimetres, an image point lies.

    Points off the table map to coordinates outside 0..width / 0..length, which
    is how a floor bounce is told from a table bounce.
    """
    x, y = cv2.perspectiveTransform(
        np.array([[point]], dtype=np.float32), homography
    )[0][0]
    return float(x), float(y)
