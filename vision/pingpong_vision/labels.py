"""Where the ball really was, written down by a person.

Everything in §5 is a claim about the ball that nothing checks. The tracker
finds *a* path and the arc test says it is plausible; no measurement so far can
say how many of the ball's flights were missed, because nothing records where
the ball was. This is that record, and it is the only thing in the pipeline a
machine cannot produce.

One row per frame offered. A frame where the ball could not be seen is written
down as such rather than skipped: "not visible" is an observation, and dropping
it would quietly bias the sample towards frames where the ball is easy to find
— which is exactly the population the tracker already handles.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

Point = tuple[float, float]

HEADER = "frame,x,y"


@dataclass(frozen=True)
class Label:
    """One answered frame. `at` is None when the ball could not be seen."""

    frame: int
    at: Point | None


def append_label(path: Path, label: Label) -> None:
    """Write one answer immediately.

    Immediately, and not on exit: labelling is tedious and gets done in short
    sittings, so closing the window has to be a pause rather than a loss.
    """
    new = not path.exists()
    with path.open("a") as out:
        if new:
            out.write(HEADER + "\n")
        x, y = label.at if label.at else ("", "")
        out.write(f"{label.frame},{x},{y}\n")


def read_labels(path: Path) -> list[Label]:
    """Every answer so far. A missing file is an unlabelled clip, not an error."""
    if not path.exists():
        return []
    rows = path.read_text().strip().splitlines()[1:]
    labels = []
    for row in rows:
        frame, x, y = row.split(",")
        labels.append(Label(int(frame), (float(x), float(y)) if x else None))
    return labels


def unlabelled(planned: list[int], labels: list[Label]) -> list[int]:
    """The frames still to answer, in the order they were planned."""
    done = {label.frame for label in labels}
    return [frame for frame in planned if frame not in done]
