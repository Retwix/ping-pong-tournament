"""Is this blob the ball, given where on the table it appears?

The colour gate finds candidates; this decides whether a candidate is plausible
at the place it was found. Both questions are needed — a blob the right colour
and the right size for the far end is noise if it turns up near the camera.
"""

from __future__ import annotations

import cv2
import numpy as np

from .calibration import Calibration, Point, homography_of, to_table_cm

BALL_MM = 40.0


def expected_ball_px(homography: np.ndarray, table_point: Point, *, ball_mm: float = BALL_MM) -> float:
    """How wide the ball should look, in pixels, at that spot on the table.

    The real ball is a fixed 40 mm; its image is not. Projecting that width back
    through the homography gives the expected size at any point for free, which
    is what makes one size gate work at both ends of the table — §4's whole
    argument for calibrating before detecting.
    """
    inverse = np.linalg.inv(homography)
    x, y = table_point
    span = np.array([[(x, y), (x + ball_mm / 10.0, y)]], dtype=np.float32)
    (ax, ay), (bx, by) = cv2.perspectiveTransform(span, inverse)[0]
    return float(np.hypot(bx - ax, by - ay))


def on_the_table(table_point: Point, calibration: Calibration, *, margin_cm: float = 0.0) -> bool:
    """Whether a table-plane point lies on the playing surface.

    The margin exists because neither the clicks nor the ball's centroid are
    exact, and a ball clipping the edge is still a table bounce. Beyond it is a
    floor bounce, which §7 calls the strongest rally-end signal there is.
    """
    x, y = table_point
    return (
        -margin_cm <= x <= calibration.width_cm + margin_cm
        and -margin_cm <= y <= calibration.length_cm + margin_cm
    )


def ball_candidates(frame, calibration: Calibration, gate: dict[str, int], *,
                    margin_cm: float = 10.0, tolerance: tuple[float, float] = (0.3, 3.0)):
    """Blobs that are the ball's colour, on the table, and the right size there.

    Returns (image point, table point, area) for each survivor.
    """
    homography = homography_of(calibration)
    mask = cv2.inRange(
        cv2.cvtColor(frame, cv2.COLOR_BGR2HSV),
        np.array([gate["hue_lo"], gate["sat_min"], gate["val_min"]], np.uint8),
        np.array([gate["hue_hi"], 255, 255], np.uint8),
    )
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    survivors = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 4:
            continue
        x, y, w, h = cv2.boundingRect(contour)
        centre = (x + w / 2.0, y + h / 2.0)
        table_point = to_table_cm(homography, centre)
        if not on_the_table(table_point, calibration, margin_cm=margin_cm):
            continue
        diameter = expected_ball_px(homography, table_point)
        expected_area = np.pi / 4.0 * diameter ** 2
        low, high = tolerance
        if low * expected_area <= area <= high * expected_area:
            survivors.append((centre, table_point, area))
    return survivors
