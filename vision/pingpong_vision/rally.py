"""Who won the point.

§8, and it is smaller than it looks: **the point goes to the player on the side
opposite the last table bounce.** Every way a rally ends is a fault by exactly
one player, and the last place the ball legally touched the table names them —
into the net, long, or not reached at all, they all reduce to the same read.

§8 records the two cases this gets wrong, both the same shape: a player
intercepting the ball before it has bounced on their half. Casual play produces
them, people bat reflexively at balls that were going out, and v1 accepts them
and leans on §11's undo rather than pretending otherwise.
"""

from __future__ import annotations

from dataclasses import dataclass

from .bounce import bounce_between, bounces, table_half
from .calibration import Calibration
from .track import Track

OPPOSITE = {"near": "far", "far": "near"}


def awarded_to(halves: list[str | None]) -> str | None:
    """The side that won, from the halves a rally's bounces landed on.

    `None` entries are floor bounces. They end a rally but are not table
    bounces, so they are never the thing read: a ball going off the near
    player's end is exactly how a rally ends with the near player at fault,
    and taking it as the last touch awards the point to whoever just won it.

    `None` when no table bounce was seen. §8 leaves that case to the state
    machine, which refuses to score a rally under two table bounces. The rule
    itself has nothing to read, and must not guess a side.
    """
    landed = [half for half in halves if half is not None]
    return OPPOSITE[landed[-1]] if landed else None


@dataclass(frozen=True)
class Event:
    """Something the tracker noticed. `half` is set only on a bounce.

    §8 has the state machine consume events rather than frames, which is what
    makes every row of its table of endings a unit test with no video and no
    camera behind it.
    """

    frame: int
    kind: str                      # "crossed" | "bounce" | "floor" | "lost"
    half: str | None = None


@dataclass(frozen=True)
class Awarded:
    """A point: who won it, and the frame the rally ended on.

    The frame is not decoration either. §15 scores this pipeline against a
    list of frames a human marked points on, and a bare list of sides cannot
    be held against one — six "far"s say nothing about whether they are the
    same six rallies. Without it every measurement has to replay the rule
    below in a script of its own, and then the published figures are measured
    with the copy rather than with this.
    """

    frame: int
    side: str


def points_from(events: list[Event], *, cooldown_frames: int) -> list[Awarded]:
    """Each rally's winner, and the frame that rally ended on.

    §8's guard, and the reason an imperfect tracker is tolerable: **a rally
    only scores if it crossed the net and bounced on the table at least
    twice.** §5 measured the tracker following the dog in the doorway and a
    player's forearm, and neither of those ever bounces on a table. The
    detector does not have to be right about everything; it has to be wrong
    in ways that cannot fake a rally.

    A ball rolled across the table crosses the net and bounces once. Knocking
    about on one half bounces plenty and never crosses. Neither scores.

    A floor bounce or a lost ball ends the rally; §7 calls the floor bounce
    the strongest rally-end signal there is.

    For `cooldown_frames` after a point the stream is ignored, and §8 calls
    that the single most likely source of garbage points. The guard above
    cannot help: fetching the ball and lobbing it back over the table really
    does cross the net and really does bounce on both halves, so it is a
    rally by every measure except when it happened. Only the clock tells
    them apart.

    In frames rather than seconds, and with no default, because the caller
    is the only one who knows the frame rate — §8 asks for about three
    seconds, which is 90 frames at the 30 fps §2 is stuck with.
    """
    points: list[Awarded] = []
    crossed = False
    halves: list[str | None] = []
    scored_at: int | None = None

    for event in events:
        if scored_at is not None and event.frame - scored_at < cooldown_frames:
            continue
        if event.kind == "crossed":
            crossed = True
        elif event.kind == "bounce":
            halves.append(event.half)
        elif event.kind in ("floor", "lost"):
            won = awarded_to(halves) if crossed and len(halves) >= 2 else None
            if won:
                points.append(Awarded(event.frame, won))
                scored_at = event.frame
            crossed, halves = False, []
    return points


def events_from(tracks: list[Track], calibration: Calibration, *,
                dwell_frames: int) -> list[Event]:
    """The event stream a set of tracks produces, in frame order.

    The join between §7 and §8, and the only place they meet. Everything
    above works in pixels; everything below works in sides and frames. Here
    a bounce stops being a local maximum in image y and becomes something
    that decides a point.

    Contacts and crossings both come from two places, for the same reason: a
    one-frame hole between fragments hides whichever happened in it. In play
    on rally.mp4 that is 57 turns and 12 crossings, against 15 and 43 found
    inside fragments.

    Contacts come from two places. A fragment long enough to contain the
    turn reports it directly; a turn that fell in the gap between two
    fragments the dwell has joined is solved for. On rally.mp4 during play
    the second kind outnumbers the first roughly four to one, so leaving it
    out starves §8's two-bounce guard.

    A `lost` is emitted only where the ball really went away: a track whose
    successor picks up within `dwell_frames` is a fragment of the same rally,
    not the end of one. On rally.mp4 that is the common case rather than the
    edge case — 126 tracks with a median length of 11 frames, and 92 of the
    125 gaps between them under 0.7 s. Closing a rally at every fragment
    means §8's two-bounce guard never sees two bounces, because they are
    spread across fragments that were all closed early.
    """
    ordered = sorted(tracks, key=lambda track: track.start)
    stream: list[Event] = []
    for i, track in enumerate(ordered):
        stream.extend(_crossings(track, calibration.net_ends))
        for bounce in bounces(track):
            stream.append(_contact(bounce, calibration))
        ends = track.start + len(track.seen) - 1
        resumes = ordered[i + 1].start if i + 1 < len(ordered) else None
        if resumes is None or resumes - ends > dwell_frames:
            stream.append(Event(ends, "lost"))
            continue
        gap = bounce_between(track, ordered[i + 1])
        if gap is not None:
            stream.append(_contact(gap, calibration))
        resuming = ordered[i + 1]
        if (_beyond_the_net(track.seen[-1], calibration.net_ends)
                != _beyond_the_net(resuming.seen[0], calibration.net_ends)):
            stream.append(Event(resuming.start, "crossed"))
    return sorted(stream, key=lambda event: event.frame)


def _contact(bounce, calibration: Calibration) -> Event:
    """One contact, tagged with the half it landed on or marked as the floor.

    A bounce that missed the table keeps its frame and loses its side: §8
    reads sides to award the point, and handing it one for a ball that landed
    on the floor awards the point to whoever just won it.
    """
    half = table_half(bounce, calibration)
    return Event(bounce.frame, "bounce", half) if half else Event(bounce.frame, "floor")


def _crossings(track: Track, net_ends) -> list[Event]:
    """Frames where the ball changed sides of the clicked net line.

    Measured in image space, against the line through the two net ends, and
    not in table centimetres. §5 established that a ball in flight is above
    the plane and its table coordinates are fiction; asking which half it is
    over gets a made-up answer, and a crossing is by definition asked while
    the ball is in the air.

    A ball lobbed high over its own half rises above the net line without
    going near the net, and reads as a crossing. That is accepted: it makes
    §8's guard more permissive rather than less, and a lob that then bounces
    twice on its own half is the "double bounce" row of §8's table, which is
    meant to score.
    """
    side = [_beyond_the_net(point, net_ends) for point in track.seen]
    return [Event(track.start + i, "crossed")
            for i in range(1, len(side))
            if side[i] != side[i - 1]]


def _beyond_the_net(point: tuple[float, float], net_ends) -> bool:
    """Which side of the clicked net line a point falls on.

    A sign, not a distance, and deliberately: the two sides are all §8 asks
    for, and the magnitude would be pixels rather than anything physical.
    """
    (ax, ay), (bx, by) = net_ends
    x, y = point
    return (bx - ax) * (y - ay) - (by - ay) * (x - ax) > 0
