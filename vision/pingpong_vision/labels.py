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


def drop_last_label(path: Path) -> None:
    """Remove the most recent answer, putting that frame back in the queue.

    A ball 15 px across, clicked at speed, gets missed sometimes. Stepping
    backwards without removing the row would leave the frame counted as done,
    so the one answer the labeller knows is wrong is the one they cannot fix.
    Doing nothing to an empty or missing store keeps undo safe to lean on.
    """
    labels = read_labels(path)
    if not labels:
        return
    keep = [f"{label.frame},{label.at[0]},{label.at[1]}" if label.at else f"{label.frame},,"
            for label in labels[:-1]]
    path.write_text("\n".join([HEADER, *keep]) + "\n")


@dataclass(frozen=True)
class Score:
    """How the tracker did against what a person actually saw."""

    judged: int       # labelled frames considered
    found: int        # clicked balls a track was on
    missed: int       # clicked balls no track was near
    invented: int     # frames where a track claimed a ball that was not there


def score_tracks(labels: list[Label], tracks: list, *, within_px: float) -> Score:
    """Mark the tracker against the frames a person labelled.

    `Track.start` and `Label.frame` must be numbered the same way; the caller
    aligns them, because the probe's sampling stride makes that its business
    rather than this function's.

    A track covering a frame proves nothing on its own — a coverage-shaped
    metric scored worse than chance in 7aecc88 — so a ball counts as found
    only when some track's position *for that frame* lands within `within_px`
    of the click. Every other claim at a judged frame is counted as invented,
    including any claim at all on a frame the labeller marked hidden.
    """
    found = missed = invented = 0
    for label in labels:
        claims = [track.seen[label.frame - track.start] for track in tracks
                  if 0 <= label.frame - track.start < len(track.seen)]
        near = [claim for claim in claims
                if label.at and _within(claim, label.at, within_px)]
        if label.at:
            found += bool(near)
            missed += not near
        invented += len(claims) > len(near)
    return Score(judged=len(labels), found=found, missed=missed, invented=invented)


def _within(a: Point, b: Point, limit: float) -> bool:
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 <= limit ** 2


@dataclass(frozen=True)
class Outcome:
    """One point a person marked: the frame they marked it on, and who won.

    `side` is written in the watcher's own terms — `left` and `right` as seen
    from where the camera stands — not the `near`/`far` the pipeline reasons
    in. Translating between them is §1's session-start question, and the two
    vocabularies are kept apart here so that a wrong answer to it shows up as
    a wrong score rather than as silence.
    """

    frame: int
    side: str


def read_outcomes(path: Path) -> list[Outcome]:
    """The points a person marked, in the order they were played.

    The seconds column the file also carries is ignored: it restates the
    frame at the clip's frame rate, and reading it would make this wrong on
    any clip shot at a different one.
    """
    rows = path.read_text().strip().splitlines()[1:]
    outcomes = []
    for row in rows:
        frame, _seconds, side = row.split(",")
        outcomes.append(Outcome(int(frame), side))
    return outcomes


@dataclass(frozen=True)
class PointScore:
    """How the scoring did against the points a person marked."""

    marked: int       # points a person wrote down
    found: int        # marked points the pipeline also awarded
    correct: int      # ...and awarded to the player who really won it
    spurious: int     # awarded points matching no marked point


def score_points(marked: list[Outcome], awarded: list, *, sides: dict[str, str],
                 before_frames: int, after_frames: int) -> PointScore:
    """Mark the pipeline's points against the ones a person saw.

    Three numbers rather than one: §15 asks for accuracy and for rally-end
    recall separately, and §7 measured settings that move them opposite ways.
    Reporting a single figure would have hidden the trade it was measuring.

    The window is lopsided because a mark follows the point it records — the
    ball has still to land and the marker still to react — so an award may
    precede its mark by seconds and should never follow it by more than the
    moment it takes to spot the rally is over.

    An award inside some marked point's window counts that point found; the
    last such award decides whether it was awarded correctly, being the one
    closest to the ending. Every award that lands in nobody's window is
    spurious, so a rally awarded twice costs a spurious point rather than
    passing for free.
    """
    found = correct = 0
    matched: set[int] = set()
    for outcome in marked:
        inside = [i for i, point in enumerate(awarded)
                  if outcome.frame - before_frames <= point.frame <= outcome.frame + after_frames]
        if not inside:
            continue
        found += 1
        matched.update(inside)
        correct += sides[awarded[inside[-1]].side] == outcome.side
    return PointScore(marked=len(marked), found=found, correct=correct,
                      spurious=len(awarded) - len(matched))
