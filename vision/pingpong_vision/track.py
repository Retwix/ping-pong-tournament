"""Where the ball should turn up next, given where it has just been.

A frame on its own cannot tell a ball from a forearm: at one instant both are
an orange-ish blob of roughly the right size, which is why §5's colour and size
gates plateau at a rally rate indistinguishable from a warm-up's. Across frames
there is something to tell them apart with, because a struck ball is in free
flight and a forearm is not. This module is only the memory that makes the
comparison possible.

Which part of it does the separating is now measured, and it is not the part
§5 step 4 nominates. `is_ballistic` refused none of the 1024 paths
`rally.mp4` discarded, and cannot refuse any while `tolerance_px` is the
looser of the two arc bounds. What separates a ball from an arm here is
`advance`'s gate — a per-frame bound with a track's history behind it.

Prediction is in **image pixels, not table centimetres**. A ball in flight is
above the table plane, so the homography — which assumes points lie *on* the
plane — throws it far from where it really is. Centimetres are for bounces.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from math import hypot

Point = tuple[float, float]


def predict_next(seen: list[Point]) -> Point:
    """Extrapolate one frame on from the last three positions.

    Constant acceleration, not constant velocity: gravity bends the path every
    frame, so a straight line drawn through the last two always undershoots.
    Three points is the fewest that can measure a bend at all, and few enough
    that the estimate stays fresh when the ball is struck and the arc restarts.

    A shorter history predicts with what it has rather than refusing, because
    a track has to survive its own first two frames to ever reach a third.
    """
    if len(seen) == 1:
        return seen[-1]
    if len(seen) == 2:
        (bx, by), (cx, cy) = seen
        return (2.0 * cx - bx, 2.0 * cy - by)
    (ax, ay), (bx, by), (cx, cy) = seen[-3:]
    return (3.0 * cx - 3.0 * bx + ax, 3.0 * cy - 3.0 * by + ay)


def advance(seen: tuple[Point, ...], candidates: list[Point], *, gate_px: float) -> tuple[Point, ...]:
    """Extend the track with whichever candidate best matches the prediction.

    A frame arrives as an unordered pile of orange blobs with nothing to rank
    them by. The prediction is the ranking, and `gate_px` is the limit on it:
    a blob further than that from where the ball was due is not the ball,
    however alone it is in the frame. Without the limit a track snaps onto a
    player's shirt the instant the ball is missed, and then stays there.

    Returns the track unchanged when nothing qualifies, so a lean frame costs
    the track nothing but a position.
    """
    if not candidates:
        return seen
    prediction = predict_next(seen)
    nearest = min(candidates, key=lambda c: _apart(prediction, c))
    if _apart(prediction, nearest) > gate_px:
        return seen
    return (*seen, nearest)


def is_ballistic(seen: tuple[Point, ...], *, tolerance_px: float, least: int) -> bool:
    """Has this path been falling freely, or is something carrying it?

    §5 step 4, and the only question in the pipeline a single frame cannot
    answer: a hand and a ball look alike for one instant and nothing alike
    over six. Between contacts a ball is in free fall, so every position is
    where its three predecessors said it would be; a forearm goes where its
    owner decides, and misses its own prediction immediately.

    `least` exists because consistency over too few frames proves nothing --
    three points fit a curve through themselves whatever they are. Neither
    bound is defaulted: §5 wants both tuned against footage, and a guessed
    constant in a signature is how a guess becomes a fact nobody rechecks.

    **At the tuned settings this refuses nothing, and that is structural.**
    `advance` admits a position only within `gate_px` of the same prediction
    and coasts exactly onto the arc, so every position examined here already
    passed a tighter bound than `tolerance_px` applies. Whenever
    `tolerance_px >= gate_px` — 30 against 25, as tuned — the answer is
    always yes.

    Tightening it below the gate does not recover a guard. A path holding a
    table contact is two parabolas rather than one, so the check eats those
    first: at tolerance 20 it refused 18 paths, 28% of them carrying a
    bounce against 13% of the paths kept, and points found fell from 7 to 6.
    """
    if len(seen) < least:
        return False
    return all(_apart(predict_next(seen[i - 3:i]), seen[i]) <= tolerance_px
               for i in range(3, len(seen)))


def _apart(a: Point, b: Point) -> float:
    """One definition of distance, used both to rank and to reject.

    Two copies of it could drift into meaning different things — squared
    against unsquared, say — and the gate would quietly stop being the
    distance it was tuned as.
    """
    return hypot(a[0] - b[0], a[1] - b[1])


@dataclass(frozen=True)
class Track:
    """A believed path: the frame it opened on, and where it went after.

    The frame number is not decoration. Paths overlap now, so frames covered
    cannot be counted by adding path lengths; §7 needs the frame a bounce
    happened on, and §8 needs to know whether the ball was being followed at
    a given moment. Positions are one frame apart by construction, so `start`
    and the length give the span.
    """

    start: int
    seen: tuple[Point, ...]


@dataclass(frozen=True)
class Discarded:
    """A path that was followed and then thrown away, and the guard that did it.

    Three guards refuse a path and until this existed all three refused
    silently, so a stretch of clip where the ball is never tracked looked the
    same whatever had gone wrong. §7 has two unscored points of exactly that
    shape — every frame offering candidates, almost none of them reaching an
    accepted path — and no way to ask which threshold was doing it short of
    re-reading the conditions into a script, which is how a measurement comes
    to describe the copy rather than the code.
    """

    start: int
    length: int
    reason: str


def sift(per_frame: Iterable[list[Point]], *, gate_px: float, reach_px: float,
         coast: int, least: int, tolerance_px: float,
         least_travel_px: float) -> tuple[list[Track], list[Discarded]]:
    """Every path through a clip, sorted into believed and refused.

    `follow` is this without the refusals, and is what the pipeline uses; the
    refusals are for asking why a clip went untracked.

    Takes one candidate list per frame and returns the tracks worth
    believing. A frame offering several blobs says nothing about which is the
    ball; held against its own past, only one of them is falling, and that is
    the whole reason this exists.

    Every candidate no live path claims starts a path of its own. Following
    only one at a time means following whichever blob the contour finder
    emitted first, and with the table-polygon fix in place most rally frames
    carry several. Spurious paths cost little: they fail to associate within
    a few frames and die unaccepted, so the population stays near the number
    of blobs per frame times `coast`.

    A missed frame is filled with the prediction rather than skipped, so the
    positions stay one frame apart and `predict_next` keeps meaning what it
    says. A coasted position asserts nothing about the path — it sits exactly
    on the arc by construction — which is why acceptance counts *observations*
    separately.

    `gate_px` is therefore the arc test, and the only one: re-applying
    `tolerance_px` at the end catches nothing it let through, since it is the
    looser of the two. Loosening the gate loosens what is accepted, with
    nothing behind it to compensate.

    A path still guessing reaches `reach_px`; one that can predict is held to
    `gate_px`. With fewer than three positions there is no acceleration to
    extrapolate, so the guess is little better than "stays put" and has to
    span a whole frame of the ball's travel — a median 25 px on rally.mp4 and
    75 px at the 90th percentile. With three, the prediction is the arc and
    the same distance becomes slack that lets a path wander onto clutter.
    Widening one gate for both jobs measured worse than either.

    `least_travel_px` asks the one thing the arc test cannot: did it go
    anywhere. Standing still is constant acceleration with a = 0, so a ball
    waiting in a hand fits an arc perfectly for as long as it is held, and
    nothing about it is the wrong colour, size or shape. On rally.mp4 that
    was the single longest accepted path.

    A path ends at its last real sighting: the invented positions after it
    were guesses about a ball nobody could see, and leaving them on would
    plant a bounce where none was observed.

    Two paths cannot share a blob, and the one with more sightings behind it
    chooses first. Evidence, not arrival order: a path that has watched the
    ball for six frames has a better claim on the next blob than one born
    last frame from a speck, and letting the newcomer take it shreds a good
    path into stubs that each die below `least`.
    """
    accepted: list[Track] = []
    discarded: list[Discarded] = []
    live: list[_Path] = []

    for frame, candidates in enumerate(per_frame):
        unclaimed = list(candidates)
        carried: list[_Path] = []
        for path in sorted(live, key=lambda path: -path.sightings):
            within = gate_px if len(path.seen) >= 3 else reach_px
            grown = advance(path.seen, unclaimed, gate_px=within)
            if len(grown) > len(path.seen):
                unclaimed.remove(grown[-1])
                carried.append(_Path(path.start, grown, 0, path.sightings + 1))
            elif path.misses < coast:
                carried.append(_Path(path.start, (*path.seen, predict_next(path.seen)),
                                     path.misses + 1, path.sightings))
            else:
                _judge(path, accepted, discarded, least=least, tolerance_px=tolerance_px,
                       least_travel_px=least_travel_px)
        live = carried + [_Path(frame, (blob,), 0, 1) for blob in unclaimed]

    for path in live:
        _judge(path, accepted, discarded, least=least, tolerance_px=tolerance_px,
               least_travel_px=least_travel_px)
    return accepted, discarded


def follow(per_frame: Iterable[list[Point]], *, gate_px: float, reach_px: float,
           coast: int, least: int, tolerance_px: float,
           least_travel_px: float) -> list[Track]:
    """Every path through a clip that behaved like a ball."""
    return sift(per_frame, gate_px=gate_px, reach_px=reach_px, coast=coast,
                least=least, tolerance_px=tolerance_px,
                least_travel_px=least_travel_px)[0]


@dataclass(frozen=True)
class _Path:
    """One candidate ball being followed: where it has been, and how surely."""

    start: int
    seen: tuple[Point, ...]
    misses: int
    sightings: int


def _judge(path: _Path, accepted: list[Track], discarded: list[Discarded], *,
           least: int, tolerance_px: float, least_travel_px: float) -> None:
    """File a finished path under believed or refused."""
    settled = path.seen[:len(path.seen) - path.misses]
    reason = _refused(path.sightings, settled, least=least, tolerance_px=tolerance_px,
                      least_travel_px=least_travel_px)
    if reason is None:
        accepted.append(Track(path.start, settled))
    else:
        discarded.append(Discarded(path.start, len(settled), reason))


def _refused(sightings: int, settled: tuple[Point, ...], *,
             least: int, tolerance_px: float, least_travel_px: float) -> str | None:
    """Which guard turned this path away, or None if none of them did.

    Three frauds, three guards: a long path that was mostly coasted, one
    that never left the spot it started on, and one that was watched the
    whole way and never fell.

    The first refusal is the answer, and the order is not arbitrary. A path
    barely seen has no travel worth measuring and no arc worth testing, so
    reporting a later guard would point a fix at a threshold that was never
    what stopped it.
    """
    if sightings < least:
        return "too few sightings"
    if _travelled(settled) < least_travel_px:
        return "went nowhere"
    if not is_ballistic(settled, tolerance_px=tolerance_px, least=least):
        return "never fell"
    return None


def _travelled(seen: tuple[Point, ...]) -> float:
    """How far apart the extremes of a path are, across the frame.

    The diagonal of its bounding box rather than start-to-end distance: a
    ball thrown up and caught ends where it began, and is still a ball that
    went somewhere.

    `seen` is never empty here: a path opens with one sighting and only ever
    gains a coasted position alongside a miss, so trimming the coasted tail
    always leaves the sighting it started from.
    """
    xs = [x for x, _ in seen]
    ys = [y for _, y in seen]
    return hypot(max(xs) - min(xs), max(ys) - min(ys))
