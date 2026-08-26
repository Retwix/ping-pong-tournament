# Durée estimée d'un tournoi — spec

« Ça va durer combien de temps ? » — answered on the **Nouvelle partie** /
**Nouveau tournoi** page, before the tournament is generated, from the club's
own match history.

Code: `ping-pong-react/src/lib/dureeEstimee.ts` (pure, tested in
`dureeEstimee.test.ts`), surfaced in the rail of `NouvellePartie.tsx`.

---

## 1. What the estimate is made of

Every finished match stores `started_at` / `ended_at`, so how long a game to 11
takes **here** is a measured fact, not a guess. Three pieces are fitted from
that history, then combined:

| Piece | What it captures | Fitted from |
| --- | --- | --- |
| `fixeMs`, `parPointMs` | one match: `durée ≈ fixe + parPoint × points joués` | least squares over timed matches |
| `partSerree`, `partDesequilibree` | how many points a match actually goes to, given how even it is | loser's score vs. the pre-match Elo gap |
| `entracteMs` | the dead time between two matches on a single table | median gap `ended_at → started_at` inside past tournaments |

The three answer the three things the user asked about:

- **number of points** — `target` drives the expected points played;
- **number of players** — drives the match count (`n(n−1)/2` in round-robin,
  `2n−2` in double elimination) and, with it, the entractes;
- **level of the players** — drives how close the matches are, and close
  matches take longer.

## 2. Expected length of one match

The winner takes `target`; only the loser's share varies, and it varies with how
evenly matched the two sides are:

```
p      = 1 / (1 + 10^((eloB − eloA)/400))       # win probability
c      = 1 − |2p − 1|                           # closeness: 1 = coin flip, 0 = certainty
part   = partDesequilibree + (partSerree − partDesequilibree) · c
points = target · (1 + part)
durée  = fixeMs + parPointMs · points
```

`c` is the single knob the players' level turns. A field of equals grinds out
deuces; a field where the top seed meets a beginner is over in four minutes.

## 3. From matches to an evening

- **Round-robin** sums the real schedule, pair by pair — so a field with one
  runaway favourite comes out shorter than a field of equals, at the same
  player count.
- **Double elimination** cannot know its matchups before the draw, so it prices
  the average matchup of the field over the `2n−2` games it will play.
- **Quick game**: a single match, no entracte.

Then `total = Σ durées + (matchs − 1) × entracteMs`.

The ± band is the model's typical relative miss (`dispersion`, the median
relative residual of the per-match fit), narrowed by `√matchs` — per-match
misses partly cancel over a long evening — with a 6 % floor, because the model
itself is a guess.

## 4. Guard rails

A casual scorer produces odd rows: a tab left open over lunch, a match validated
twice. Everything is filtered and clamped (`DUREE` in the lib):

- a timed match counts only if it lasted 20 s – 1 h **and** paced between 2 s and
  2 min per point; byes never happened, so they carry no time;
- entracte gaps count only when positive and under 20 min (below that, two
  tables were running; above, the table was abandoned);
- a degenerate per-match fit (no spread in point counts, or a negative slope
  from a thin sample) falls back to the median pace with no fixed cost;
- the two ends of the closeness curve are ordered after fitting, so a wrong-way
  sample can never make a walkover the longer match.

## 5. Before there is history

Under 8 timed matches the fit is noise, so the built-in defaults stand and the
card says so out loud (« estimation de départ — pas encore assez de matchs
chronométrés »). Defaults: 45 s fixed + 17.5 s per point, 1 min 30 between
matches, loser share 0.62 (even) → 0.32 (lopsided) — i.e. a game to 11 between
equals lands around six minutes.

The fallback is piece by piece: a club with timed matches but no rated ones
still gets a real per-match cost, with the default closeness curve on top.

## 6. What the card shows

```
Durée estimée                    fin vers 19 h 25
🕐 ≈ 2 h 10   entre 1 h 55 et 2 h 25
15 matchs · ~6 min par match · ~2 min entre deux
d'après 143 matchs chronométrés
```

Durations are rounded to 5 minutes — a to-the-minute estimate would be a lie.
« fin vers » appears only when a start time has been entered in the (optional)
**Heure** field, and wraps past midnight rather than reporting a 25th hour.
