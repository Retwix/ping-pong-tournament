"""Has the camera moved since it was calibrated?

Everything downstream assumes a fixed view: the homography maps pixels to the
table, and the background model assumes a static scene. A bump at minute 40 is
invisible — nothing errors, bounces simply start being attributed to the wrong
half, confidently, for the rest of the session.

Detecting the bump is cheap, and it was proved on the 2026-09-16 clips before it
was written: matching each clip against the calibration frame gave a median
shift of 0.0 px on all four, which is how we know that session is sound.
"""

from __future__ import annotations

import cv2
import numpy as np

# Measured, not guessed: ORB is far more generous than it looks. A single 28 px
# rectangle yields ~20 matches and two 6 px dots yield 14, so a floor of 12 was
# unreachable and did no work at all. A real room gives hundreds.
MIN_MATCHES = 40
MIN_SPREAD = 0.25         # matched points must span this fraction of each axis
FEATURES = 2000


def view_shift_px(reference, frame) -> float | None:
    """Median distance a tracked point has moved between two views, in pixels.

    None when the views cannot be compared — a blank wall, a lens cap, a dark
    room. That is deliberately not zero: "I cannot see anything to compare"
    and "nothing has moved" are opposite answers, and conflating them would
    report a healthy camera at exactly the moment it stopped seeing the table.
    """
    orb = cv2.ORB_create(FEATURES)
    grey = [cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
            for image in (reference, frame)]
    keys_a, desc_a = orb.detectAndCompute(grey[0], None)
    keys_b, desc_b = orb.detectAndCompute(grey[1], None)
    if desc_a is None or desc_b is None:
        return None

    matches = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(desc_a, desc_b)
    if len(matches) < MIN_MATCHES:
        return None

    anchored = np.array([keys_a[m.queryIdx].pt for m in matches])
    if not _spans_the_view(anchored, grey[0].shape):
        return None

    moved = np.array([keys_b[m.trainIdx].pt for m in matches]) - anchored
    return float(np.median(np.hypot(moved[:, 0], moved[:, 1])))


def _spans_the_view(points, shape) -> bool:
    """Are these matches spread across the frame, or huddled on one object?

    Counting matches is not enough, and assuming otherwise is a trap: ORB puts
    ~20 keypoints on a single small rectangle at multiple scales, so one object
    clears any sane match count on its own. A median computed from points all
    sitting on one chair measures *that chair*, and if somebody moved it the
    answer comes back as camera drift.
    """
    height, width = shape[:2]
    spread_x = (points[:, 0].max() - points[:, 0].min()) / width
    spread_y = (points[:, 1].max() - points[:, 1].min()) / height
    return spread_x >= MIN_SPREAD and spread_y >= MIN_SPREAD
