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

    kind: str                      # "crossed" | "bounce" | "floor" | "lost"
    half: str | None = None


def points_from(events: list[Event]) -> list[str]:
    """The side that won each rally in a stream of events.

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
    """
    points: list[str] = []
    crossed = False
    halves: list[str | None] = []

    for event in events:
        if event.kind == "crossed":
            crossed = True
        elif event.kind == "bounce":
            halves.append(event.half)
        elif event.kind in ("floor", "lost"):
            won = awarded_to(halves) if crossed and len(halves) >= 2 else None
            if won:
                points.append(won)
            crossed, halves = False, []
    return points
