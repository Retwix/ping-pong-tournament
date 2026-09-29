"""Deciding whether a blob could be the ball, at the place it appears."""

from __future__ import annotations

import cv2
import numpy as np
import pytest

from pingpong_vision.ball import ball_candidates, expected_ball_px, on_the_table
from pingpong_vision.calibration import Calibration, homography_of
from probe import DEFAULT_GATE

TABLE = Calibration(
    corners=((200.0, 1000.0), (1700.0, 1000.0), (1200.0, 400.0), (700.0, 400.0)),
    net_ends=((430.0, 620.0), (1130.0, 620.0)),
    length_cm=280.0,
    width_cm=140.0,
)


def test_the_ball_is_larger_near_the_camera_than_at_the_far_end() -> None:
    """The size gate has to move with depth, or it is useless at one end.

    A 40 mm ball does not change size; its image does. One fixed pixel threshold
    either rejects the far ball or accepts every speck near the camera.
    """
    h = homography_of(TABLE)

    near = expected_ball_px(h, (70.0, 20.0))
    far = expected_ball_px(h, (70.0, 260.0))

    assert near > far * 2


def test_the_expected_size_is_the_real_ball_projected_not_a_guess() -> None:
    """40 mm through the homography, so another table or lens needs no retuning."""
    h = homography_of(TABLE)

    doubled = expected_ball_px(h, (70.0, 140.0), ball_mm=80.0)
    normal = expected_ball_px(h, (70.0, 140.0), ball_mm=40.0)

    assert doubled == pytest.approx(normal * 2, rel=0.05)


def test_a_bounce_beyond_the_edge_is_not_on_the_table() -> None:
    """Floor bounces are told from table bounces by exactly this."""
    assert on_the_table((70.0, 140.0), TABLE) is True
    assert on_the_table((70.0, 305.0), TABLE) is False
    assert on_the_table((-20.0, 140.0), TABLE) is False


def test_a_margin_keeps_an_edge_ball_on_the_table() -> None:
    """A ball clipping the edge is still a table bounce; clicks are not exact."""
    assert on_the_table((70.0, 284.0), TABLE, margin_cm=8.0) is True
    assert on_the_table((70.0, 284.0), TABLE, margin_cm=0.0) is False


ORANGE = (0, 128, 255)          # BGR, inside DEFAULT_GATE's hue 3..28


def to_image_px(homography, table_point: tuple[float, float]) -> tuple[float, float]:
    x, y = cv2.perspectiveTransform(
        np.array([[table_point]], np.float32), np.linalg.inv(homography)
    )[0][0]
    return float(x), float(y)


def frame_with_smear(table_point, *, long_by: float, wide_by: float, colour=ORANGE):
    """One orange mark on black, sized in multiples of the ball's width there.

    Both dimensions are expressed against `expected_ball_px` so the shapes mean
    the same thing wherever on the table they are drawn — which is the only
    scale the gate is entitled to reason about. The smear runs off-axis on
    purpose: a ball travels where it likes, and one drawn along a pixel row
    would let an axis-aligned bounding box pass for a measurement of width.
    """
    homography = homography_of(TABLE)
    diameter = expected_ball_px(homography, table_point)
    cx, cy = to_image_px(homography, table_point)
    reach = diameter * long_by / 2.0
    along = np.radians(30.0)
    dx, dy = reach * np.cos(along), reach * np.sin(along)
    frame = np.zeros((1080, 1920, 3), np.uint8)
    cv2.line(frame, (round(cx - dx), round(cy - dy)), (round(cx + dx), round(cy + dy)),
             colour, round(diameter * wide_by))
    return frame


def test_a_ball_smeared_by_motion_is_still_the_ball() -> None:
    """§5: "the ball is a streak, not a circle" — the gate measures width.

    At 30 fps a ball crossing the table smears several diameters along its path,
    so its area runs many times a circle's. Judging area against π/4·d² rejects
    precisely the moving ball this exists to find. Length therefore carries no
    information; width still does, in both directions — but only loosely. The
    bounds sit at a quarter and six times the expected width, which is a
    sanity check rather than a filter: blur, partial occlusion and the lit
    edge of a white table all move the apparent width around, and 19c2e45
    measured that tightening this costs recall without buying any precision.
    The arc and travel tests do the discriminating; this only has to exclude
    a forearm and a thread. `fat` is four times the ball's width and is kept
    on purpose: under the tight gate this stride replaced it was rejected,
    and rejecting it was costing real sightings.

    `thread` is drawn near the camera, where the ball is ~43 px across, so
    that a fifth of that width is still several pixels and genuinely reaches
    the gate rather than being erased by the morphological opening first.
    """
    streak = frame_with_smear((70.0, 140.0), long_by=5.0, wide_by=1.0)
    forearm = frame_with_smear((70.0, 140.0), long_by=5.0, wide_by=9.0)
    fat = frame_with_smear((70.0, 140.0), long_by=5.0, wide_by=4.0)
    thread = frame_with_smear((70.0, 20.0), long_by=20.0, wide_by=0.15)

    assert len(ball_candidates(streak, TABLE, DEFAULT_GATE)) == 1
    assert ball_candidates(forearm, TABLE, DEFAULT_GATE) == []
    assert len(ball_candidates(fat, TABLE, DEFAULT_GATE)) == 1
    assert ball_candidates(thread, TABLE, DEFAULT_GATE) == []


def test_a_ball_shaped_blob_that_did_not_move_is_not_a_candidate() -> None:
    """§5 step 1, the stage this pipeline never had: motion.

    Colour cannot find a struck ball — d7a2179 measured 69.2% on a resting
    ball against 18.0% on a moving one, because blur washes the orange out —
    and the obvious repair, loosening the threshold, lets skin back in and
    made a warm-up outscore a rally. Motion is the signal that says "the ball"
    without saying "orange": whatever else a struck ball is, it was not there
    a moment ago. Anything the background model already knows about is out,
    however perfectly ball-coloured and ball-sized it is.
    """
    moving_at, parked_at = (40.0, 80.0), (100.0, 200.0)
    frame = np.maximum(frame_with_smear(moving_at, long_by=5.0, wide_by=1.0),
                       frame_with_smear(parked_at, long_by=5.0, wide_by=1.0))
    homography = homography_of(TABLE)
    foreground = np.zeros(frame.shape[:2], np.uint8)
    cx, cy = to_image_px(homography, moving_at)
    cv2.circle(foreground, (round(cx), round(cy)),
               round(5 * expected_ball_px(homography, moving_at)), 255, -1)

    assert len(ball_candidates(frame, TABLE, DEFAULT_GATE)) == 2
    seen = ball_candidates(frame, TABLE, DEFAULT_GATE, foreground=foreground)
    assert [table_point for _, table_point, _ in seen] == [pytest.approx(moving_at, abs=3.0)]


def test_a_ball_in_flight_is_not_discarded_for_leaving_the_table() -> None:
    """The homography assumes the ball is on the plane. In flight it is not.

    A ball 30 cm up is seen along a ray that meets the plane well beyond it,
    so its table coordinates land past the far edge — further the higher it
    goes. Rejecting candidates by the table polygon therefore discards
    exactly the frames a rally is made of and keeps the ones where the ball
    is lying still, which is the shape of what d7a2179 measured: 69.2% at
    rest, 18.0% in flight. §7 uses the polygon for bounces, which really are
    on the plane.

    The margin still has to stop somewhere, though it no longer asks anything
    about the table: at 15 m the ray is through the wall and the plane
    projection has stopped meaning anything. 19c2e45 measured recall rising
    all the way out to 900 cm with no loss of precision, so the bound is a
    guard against degenerate geometry and nothing more. A ball projecting 8 m
    beyond a 2.8 m table is still a candidate, which is the whole point:
    that is what a high ball looks like through a plane homography.
    """
    airborne = frame_with_smear((70.0, 330.0), long_by=5.0, wide_by=1.0)
    well_past_it = frame_with_smear((70.0, 800.0), long_by=5.0, wide_by=1.0)
    off_in_the_room = frame_with_smear((70.0, 1500.0), long_by=5.0, wide_by=1.0)

    assert len(ball_candidates(airborne, TABLE, DEFAULT_GATE)) == 1
    assert len(ball_candidates(well_past_it, TABLE, DEFAULT_GATE)) == 1
    assert ball_candidates(off_in_the_room, TABLE, DEFAULT_GATE) == []


def hsv_bgr(hue: int, sat: int = 215, val: int = 240) -> tuple[int, ...]:
    """A BGR colour named by the hue it is, because hue is what the gate reads."""
    return tuple(int(c) for c in cv2.cvtColor(np.uint8([[[hue, sat, val]]]),
                                              cv2.COLOR_HSV2BGR)[0][0])


def test_a_red_shirt_is_not_an_orange_ball() -> None:
    """Measured on rally.mp4: the ball sits at hue 14-18, red kit at 2-5.

    The gate opened at hue 3, so a red jumper and the red face of a bat both
    passed it — and being clothing they are large, close, and present in
    every frame. Sampling the tracker's own output found 90% of all tracked
    frames sitting below hue 6. The player wears red; the bat is red; almost
    nothing being followed was the ball.

    The shaded ball in a player's hand reads around hue 8 and is lost by this
    floor. That is not a cost worth paying attention to: a ball held before a
    serve is not in play, and §7 reads bounces, not grips.

    The ceiling matters as much as the floor and had nothing holding it: with
    no upper bound a green or blue object of the right size passes as readily
    as the ball, and §16's rooms are not all this one. Nor was anything
    holding the saturation floor, which is the one that keeps the table
    itself out: this table is white, it fills the frame, and washed-out
    pixels at the ball's hue are exactly what its lit edge looks like.
    """
    ball = frame_with_smear((70.0, 140.0), long_by=5.0, wide_by=1.0, colour=hsv_bgr(16))
    kit = frame_with_smear((70.0, 200.0), long_by=5.0, wide_by=1.0, colour=hsv_bgr(3))
    greenery = frame_with_smear((70.0, 200.0), long_by=5.0, wide_by=1.0, colour=hsv_bgr(60))
    washed = frame_with_smear((70.0, 200.0), long_by=5.0, wide_by=1.0,
                              colour=hsv_bgr(16, sat=40))

    assert len(ball_candidates(ball, TABLE, DEFAULT_GATE)) == 1
    assert ball_candidates(kit, TABLE, DEFAULT_GATE) == []
    assert ball_candidates(greenery, TABLE, DEFAULT_GATE) == []
    assert ball_candidates(washed, TABLE, DEFAULT_GATE) == []
