"""Calibration survives a restart, or says clearly why it cannot."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pingpong_vision.calibration import (
    Calibration,
    homography_of,
    load_calibration,
    net_cm_of,
    save_calibration,
)


def a_calibration(**overrides) -> Calibration:
    """A session's calibration: the desks, with the net clamped 25 cm off centre."""
    fields = {
        "corners": ((200.0, 1000.0), (1700.0, 1000.0), (1200.0, 400.0), (700.0, 400.0)),
        "net_ends": ((430.0, 620.0), (1130.0, 620.0)),
        "length_cm": 280.0,
        "width_cm": 140.0,
        **overrides,
    }
    return Calibration(**fields)


def test_a_calibration_survives_a_restart(tmp_path: Path) -> None:
    """Re-clicking six points every time the process restarts is not acceptable."""
    path = tmp_path / "calibration.json"
    original = a_calibration()

    save_calibration(path, original)

    assert load_calibration(path) == original


def test_the_restored_calibration_maps_the_table_identically(tmp_path: Path) -> None:
    """Round-tripping the numbers is not the point; round-tripping the geometry is."""
    path = tmp_path / "calibration.json"
    original = a_calibration()
    save_calibration(path, original)

    restored = load_calibration(path)

    assert net_cm_of(restored) == pytest.approx(net_cm_of(original))
    assert homography_of(restored).tolist() == homography_of(original).tolist()


def test_a_calibration_file_missing_a_field_is_refused_by_name(tmp_path: Path) -> None:
    """Half-written or hand-edited files should not produce a silent wrong table."""
    path = tmp_path / "calibration.json"
    path.write_text(json.dumps({"corners": [], "length_cm": 280.0, "width_cm": 140.0}))

    with pytest.raises(ValueError, match="net_ends"):
        load_calibration(path)


def test_a_calibration_records_the_table_it_was_measured_for(tmp_path: Path) -> None:
    """Dimensions travel with the clicks: another room's table is another table."""
    path = tmp_path / "calibration.json"
    save_calibration(path, a_calibration(length_cm=274.0, width_cm=152.5))

    restored = load_calibration(path)

    assert (restored.length_cm, restored.width_cm) == (274.0, 152.5)


def test_the_clicker_asks_for_corners_then_the_net() -> None:
    """Six clicks in a fixed order; the prompt is the only thing telling you which."""
    from pingpong_vision.calibration import next_prompt

    asked = [next_prompt(n) for n in range(7)]

    assert asked[:4] == ["near-left", "near-right", "far-right", "far-left"]
    assert asked[4:6] == ["net end (one side)", "net end (other side)"]
    assert asked[6] is None
