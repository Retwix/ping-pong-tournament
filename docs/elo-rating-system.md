# Système de classement (Glicko-2) — spec

Rating system for the ping-pong app. Glicko-2, single games, margin-aware,
with extra weight on double-elimination grand finals. Ratings are **stored** in
Supabase and shown in a dedicated **Classement** view.

---

## 1. Why Glicko-2 (and what it buys us)

Each player carries three numbers instead of one:

- **rating** (`r`, start **1500**) — the leaderboard number.
- **rating deviation** (`RD`, start **350**) — confidence band. New/inactive
  players have a high RD so their rating moves fast; regulars settle into a
  tight band and move slowly. Lets us show `1500 ± 120` and a "provisional" tag.
- **volatility** (`σ`, start **0.06**) — how erratic a player's results are.

This suits an office ladder where attendance is irregular: a returning player's
RD has grown, so a couple of games quickly re-finds their level.

System constant **τ = 0.5** (constrains how fast volatility moves).

---

## 2. Per-match update (the chosen granularity)

Standard Glicko-2 batches games into "rating periods". We update **after every
match** instead — both players are recomputed immediately from their current
numbers. Simpler mental model and always-live; the only cost is that RD's
statistical meaning drifts slightly from the textbook. Acceptable for a casual
ladder.

For a match between player and opponent `j` (Glicko-2 scale:
`μ = (r-1500)/173.7178`, `φ = RD/173.7178`):

```
g(φ_j) = 1 / sqrt(1 + 3·φ_j² / π²)
E      = 1 / (1 + exp(-g(φ_j)·(μ - μ_j)))          # expected score
v      = [ w · g(φ_j)² · E·(1-E) ]^(-1)            # estimated variance
Δ      = v · w · g(φ_j) · (s - E)                  # rating improvement
σ'     = solve via Illinois iteration (Δ, φ, v, τ) # new volatility
φ*     = sqrt(φ² + σ'²)
φ'     = 1 / sqrt(1/φ*² + 1/v)
μ'     = μ + φ'² · w · g(φ_j) · (s - E)
```

Then convert back: `r' = 173.7178·μ' + 1500`, `RD' = 173.7178·φ'`. Both players
are updated from the same match using each other's pre-match numbers.

- **`s` (outcome)** is binary: **1** for the winner, **0** for the loser.
- **`w` (game weight)** carries both margin and stakes (below). Weighting `v`
  and `Δ` keeps the Glicko-2 math sound while letting some games count more.

---

## 3. Margin of victory → `w_margin`

Single games to `target` (11 or 21), win-by-2. We normalise the point gap by the
target so an 11–2 and a 21–4 are treated comparably:

```
marginRatio = (winnerScore − loserScore) / target          # ~0.18 … 1.0
w_margin    = 1 + kMargin · marginRatio                     # kMargin = 0.75
            → clamped to [1.0, 1.75]
```

A nail-biter (11–9) barely exceeds `w = 1.1`; a blowout (11–1) approaches the
cap. Carrying margin as a **weight** (rather than a fractional `s`) means a
bigger win moves the rating more **and** tightens RD more, without the gaming
incentives that fractional scores can create. `kMargin` and the cap are tunable.

---

## 4. Finals weighting → `w_stakes`

Matches already carry bracket metadata (`bracket` ∈ `W|L|GF`, `match_key` e.g.
`"GF"`). We lean on that:

| Match                                   | `w_stakes` |
|-----------------------------------------|------------|
| Grand final (`match_key === 'GF'`)      | **1.5**    |
| Other bracket final (last W / last L)   | 1.25       |
| Everything else (round-robin, casual)   | 1.0        |

Final weight per game: **`w = w_margin · w_stakes`**. So winning the grand final
in a blowout is the single biggest rating swing possible. The Classement and
match detail can badge these as high-stakes (🏆) and surface "biggest final
swing" as a stat.

---

## 5. Storage & recompute

Two pieces in Supabase:

**Current state — new columns on `players`** (or a sibling `player_ratings`
table keyed by player id):

```sql
rating        real    not null default 1500
rd            real    not null default 350
vol           real    not null default 0.06
rated_games   int     not null default 0
peak_rating   real    not null default 1500
last_rated_at timestamptz
```

**History — `rating_events`** (drives sparklines, "biggest swing", trend arrows):

```sql
create table public.rating_events (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  rating_before real, rating_after real,
  rd_before real,     rd_after real,
  delta       real,        -- rating_after − rating_before
  weight      real,        -- the w applied
  created_at  timestamptz not null default now()
);
```

**Recompute strategy — deterministic full replay.** Because per-match Glicko
order matters, incremental-only updates break if a match is edited, deleted, or
back-dated. So the source of truth is a pure engine that **replays all finished,
non-bye matches in chronological order** (same input `useStats()` already loads),
then upserts `players` rating columns and rewrites `rating_events`. Run it:

- after a match is validated, and
- on any match insert/update/delete (already broadcast via realtime),
- plus a manual "Recalculer" button.

Existing match history seeds everyone automatically on first run — no backfill.
(For an office tool with open RLS this client-side recompute is fine. If
concurrent writers ever cause races, move the recompute into a Supabase edge
function so there's a single writer.)

---

## 6. New code

- **`src/lib/rating.ts`** — pure Glicko-2 engine. `replayRatings(matches,
  players)` → per-player final state + ordered events. No I/O, unit-testable.
- **`src/lib/db.ts`** — `recomputeRatings()` (replay + upsert + rewrite events),
  `listRatings()`.
- **`src/hooks/useRatings.ts`** — load ratings + events, live via realtime
  (mirrors `useStats`).
- **`src/components/Ratings.tsx`** — the **Classement** view. Route e.g.
  `/classement`. Note: existing `Leaderboard.tsx` is the *pronostics* board, so
  this is separate.

UI, consistent with the design tokens (dark/editorial, Fraunces for numbers),
**French strings**:

- Podium top 3, then ranked rows: rating in big serif, `± RD` muted.
- **Provisional** badge while `rated_games < 5` or `RD > 100`.
- Trend: ▲/▼ vs previous, optional sparkline (you already have `Charts.tsx`).
- 🏆 marker / "plus gros gain en finale" highlight from `rating_events`.

---

## 7. Tunables (one place, easy to adjust)

```
R0 = 1500   RD0 = 350   VOL0 = 0.06   TAU = 0.5
kMargin = 0.75   marginCap = 1.75
w_grandFinal = 1.5   w_final = 1.25
provisional: rated_games < 5 OR RD > 100
```

---

## 8. Open questions / edge cases

- **Win-by-2 / extra points**: `target` is the nominal cap but a deuce game can
  end 13–11. `marginRatio` still works (gap / target); just note margins can
  slightly exceed expectations at deuce.
- **Intra-team games** count toward Elo (unlike team standings, which skip them)
  — individual rating is about the player, not the pôle. Confirm.
- **Decay**: do we want inactive players' RD to grow over real elapsed time
  (Glicko's `c` term) so a 3-month absence loosens their rating? Optional.
- **Seeding**: ratings could later seed double-elim brackets (strongest players
  apart). Out of scope for v1 but the data enables it.
```