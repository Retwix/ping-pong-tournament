"""Mapping image pixels onto the table, with no camera involved."""

from __future__ import annotations

import pytest

from pingpong_vision.calibration import table_homography, to_table_cm

TABLE_LENGTH_CM = 280.0  # two 140 cm desks
TABLE_WIDTH_CM = 140.0


def camera_view() -> list[tuple[float, float]]:
    """Four corners as an oblique camera sees them: the far edge is narrower.

    Clicked near-left, near-right, far-right, far-left. The near edge spans
    1500 px and the far edge 500 px, which is the foreshortening a real view of
    a 280 cm table has and the reason a homography is needed at all.
    """
    return [(200.0, 1000.0), (1700.0, 1000.0), (1200.0, 400.0), (700.0, 400.0)]


def test_the_clicked_corners_land_on_the_corners_of_the_table() -> None:
    h = table_homography(camera_view(), length_cm=TABLE_LENGTH_CM, width_cm=TABLE_WIDTH_CM)

    corners_cm = [to_table_cm(h, p) for p in camera_view()]

    assert corners_cm == [
        pytest.approx((0.0, 0.0), abs=0.01),
        pytest.approx((TABLE_WIDTH_CM, 0.0), abs=0.01),
        pytest.approx((TABLE_WIDTH_CM, TABLE_LENGTH_CM), abs=0.01),
        pytest.approx((0.0, TABLE_LENGTH_CM), abs=0.01),
    ]


def test_equal_pixels_are_not_equal_centimetres() -> None:
    """Near pixels are magnified, so the image midpoint is a quarter of the table.

    Halfway up the image — row 700, between the near edge at 1000 and the far
    edge at 400 — is only 70 cm along a 280 cm table. The first 100 rows cover
    17.5 cm and the last 100 cover 105 cm, a six-fold difference, because the
    far half of the table is squeezed into the top of the frame.

    A mapping that scaled pixels linearly would put this point at 140 cm: the
    net line. It would therefore mislabel the half for a large band of the table
    — and §8 awards the point to the side *opposite* the last bounce, so a
    mislabelled half does not blur the result, it inverts it.
    """
    h = table_homography(camera_view(), length_cm=TABLE_LENGTH_CM, width_cm=TABLE_WIDTH_CM)

    _, y_cm = to_table_cm(h, (950.0, 700.0))

    assert y_cm < TABLE_LENGTH_CM / 2
    assert y_cm == pytest.approx(TABLE_LENGTH_CM / 4, abs=2.0)


def test_a_short_click_is_refused_by_name() -> None:
    """Three clicks is a mis-click, and OpenCV's own error names none of this."""
    three = camera_view()[:3]

    with pytest.raises(ValueError, match="4 corners"):
        table_homography(three, length_cm=TABLE_LENGTH_CM, width_cm=TABLE_WIDTH_CM)
