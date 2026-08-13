# Les Anciens — archiving players who left the company

Design spec · 13 August 2026

## The problem

People leave. Their rating stays frozen at whatever it was on their last day, and
they keep occupying a spot in « Le classement » — sometimes a podium spot — that
nobody can take from them, because they will never play again. The ladder slowly
fills with ghosts.

## The decision

A `status` column on `players`. One migration, one filter, a control in the
Joueurs annuaire. Archived players (« les anciens ») drop out of the ranked
ladder and out of the default player picker, but keep every match, every record
and every stat they ever earned.

Rejected alternatives and why, in short:

- **Delete the player.** `matches.player_a_id` is `on delete set null`, so
  deleting orphans their rating events and silently rewrites match history.
- **Auto-inactivity (no match in N days).** Cannot distinguish "left the
  company" from "on parental leave" or "hasn't played since June". Punishes
  people for taking holiday.
- **Rank them anyway, just greyed out.** Honest, but they still occupy the spot,
  which is the thing being fixed.

## The invariant that governs everything

**Archiving is a display filter, never a data change.**

Ratings are replayed from match history on every load
(`rating.ts:replayRatings`, `db.ts:291`). An alumnus's matches must stay in that
replay. If they were dropped, every opponent they ever beat or lost to would be
re-rated, the whole ladder would shift, and past seasons could acquire a
different champion. So:

- alumni matches stay in `ratedMatches`
- alumni keep being rated by the replay — their `rating`, `peak_rating` and
  `rating_events` rows are untouched
- only the *presentation* of the ladder changes

## Data model

New file `supabase/alumni-migration.sql`, idempotent like the others:

```sql
-- « Les anciens » : a player who has left the company. Their history stays
-- whole and keeps counting for everyone else's rating; they simply stop
-- occupying a spot in the live ladder and the player picker.
alter table public.players add column if not exists status  text not null default 'active';  -- 'active' | 'alumni'
alter table public.players add column if not exists left_at date;  -- departure date; drives « parti en juin 2026 »
```

`src/types.ts`:

```ts
export type PlayerStatus = 'active' | 'alumni'
```

with `status: PlayerStatus` and `left_at: string | null` on `Player`. Rows
predating the migration read as `'active'` / `null`, so nothing changes until
someone is archived.

`db.ts:updatePlayer` gains `status` and `left_at` in its patch type. No new
mutation function — archiving *is* an update.

## Rules

### Who ranks in the all-time ladder

Active players only. Alumni never hold a rank in « Depuis toujours ».

### Who ranks in a season ladder

A player ranks in a season **iff they were still with the company when that
season closed**:

```
ranksInSeason = status === 'active' || (left_at !== null && left_at >= season.end)
```

This single comparison gets all the cases right:

- **A season that starts after they left** — they have no matches in the window
  anyway, and the rule excludes them regardless. This is the "alumni are not
  expected to be ranked in a new season" requirement.
- **The season they left during** — excluded from the ranked list, listed under
  « Anciens ». They were absent for part of the window; crowning them would be
  wrong.
- **A season that closed before they left** — they rank normally and keep the
  crown if they won it. They were a colleague for the whole thing; the title was
  won fairly and must not move when they resign three months later.

`left_at === null` on an alumnus (archived without a date) is treated as "left
long ago" — excluded everywhere. The archive control stamps today's date by
default precisely so this case stays rare.

### What alumni keep

Everything except a live rank:

- their full Parties history and head-to-head records
- all-time records: biggest swing, longest streak, most match balls saved
- team stats and team colour
- their own profile page and rating sparkline
- season titles already won (see rule above)

The Stats page is unchanged by this work. History is history.

## Surfaces

### « Le classement » (`Ratings.tsx`)

Active players fill ranks 1..N with no holes. Below the table, a section:

```
─── ANCIENS ────────────────────────────────
    ◍ Paul    1594   parti en juin 2026
    ◍ Sofia   1521   partie en mars 2026
```

- no rank number — that is the whole point
- B&W avatar, muted row treatment
- their frozen rating, no trend arrow and no « 7 J » delta (both are always zero
  and reading « — » is clearer than reading « 0 »)
- the departure line replaces the win/loss meta, gendered from the copy the
  registry already holds if available, `parti·e` otherwise
- the section only renders when the current scope has at least one alumnus with
  matches in it

New pure module `src/lib/alumni.ts`:

```ts
/** Split a ranked ladder into the players who hold a rank and les anciens. */
export function splitLadder(rows: RatingRow[], players: Player[], season: Season | null):
  { ranked: RatingRow[]; anciens: RatingRow[] }
```

It renumbers `ranked` so ranks stay contiguous, and preserves rating order
within `anciens`. `rankRatings` itself stays untouched — it keeps ranking
everyone, which is what makes the split a display concern and keeps the replay
honest.

**Every ladder selector consumes `ranked`, not `rows`.** In `Ratings.tsx` that
is `podium` (`classement.ts:74`), `tightestGaps` (`:110`) and `topProgressions`
(`:128`) — each filters `!provisional` today and would otherwise resurface an
alumnus in a « plus fortes progressions » card. Same for
`seasons.ts:seasonChampion` and the leader feeding `seasonBannerState`, and for
`TopPlayers.tsx` on the dashboard.

### Joueurs annuaire (`Players.tsx`)

- alumni sort last regardless of Elo, muted, B&W avatar, « Ancien·ne » badge
  where the team badge sits — the team badge moves inline after it, since which
  team they were on is still worth knowing
- a new filter chip « Anciens » alongside the team chips; the default view hides
  them, matching the ladder
- the edit modal gains the archive control: a toggle « A quitté l'entreprise »
  revealing a date field prefilled with today
- **archive replaces delete as the primary action.** Delete stays, demoted, for
  genuine mistakes (a duplicate row, a typo'd name never played)
- un-archiving is the same toggle in reverse: clear `status` and `left_at` and
  they walk straight back into the ladder with their rating intact. `decayRd`
  (`rating.ts:253`) has been inflating their RD the whole time, so a returning
  player's first results move them faster — exactly the right behaviour, free

### Nouvelle Partie (`NouvellePartie.tsx`)

Alumni are hidden from the picker behind a « Voir les anciens » toggle, so a
departed colleague dropping by for a game is still one tap away.

**A partie containing an alumnus is forced « non classée ».** The existing
mechanism carries this with no new concept: `unrankedEffectif` at
`NouvellePartie.tsx:175` becomes

```ts
const unrankedEffectif = isDouble || unranked || hasAncien
```

the enjeu buttons lock the same way they already do for doubles, and
`noteEnjeu` (`nouvellePartie.ts:141`) gains a third reason string — something
like « Un ancien joue : la partie ne compte pas pour le classement. »

This is the conservative choice. A visiting alumnus can beat three people and
reshuffle a live season otherwise, and their own rating would move in a ladder
they no longer appear in.

### Slack

Alumni are skipped when building the invitation recipient list — their Slack
account is usually deactivated, and the invite would bounce or, worse, reach a
stranger who inherited the handle.

## The B&W avatar

Slack's treatment, and the reason this reads instantly without a legend.

`Avatar.tsx` gains one prop:

```ts
/** Les anciens: desaturated, the way Slack greys a deactivated member. */
muted?: boolean
```

- **photo**: `filter: grayscale(1)` plus a small opacity drop (~0.75) so it
  recedes without disappearing
- **initials fallback**: the team-colour tint is replaced by a neutral grey
  (`#8E889C`, the same fallback `teamColor` already returns for an unknown
  team) — a greyscale filter on a coloured tint produces mud, so the fallback
  swaps the colour rather than filtering it
- the muted class lives on the `.avatar` span so the same treatment covers every
  render size the app already uses

Alumni rows carry the muted avatar everywhere they appear as *themselves* — the
ladder's Anciens section, the annuaire, their profile header. They keep their
full-colour avatar inside historical match rows in Parties, because that match
happened in colour.

## Edge cases

- **Archiving someone mid-tournament.** Archiving does not touch a running
  tournament. The bracket finishes as built and the results land as normal — the
  matches were played by a colleague.
- **Every ranked player in a season is an alumnus.** `seasonChampion` returns
  null and the banner already has a state for "no champion"
  (`seasons.ts:seasonBannerState` → `nochamp`). The copy needs a variant: the
  existing message blames the provisional gate, which would be a lie here.
- **A provisional alumnus.** No special case — they were never ranked, and they
  appear in the Anciens section like any other.
- **Name collision on re-hire.** `players.name` is unique, so a returning person
  un-archives rather than being re-added. Worth surfacing in the add-player form:
  if the name matches an archived player, offer to restore instead of erroring.

## Later: « Les Anciens » page

Worth building, deliberately not now. The archive above is the useful half; this
is the half people will talk about.

A page that turns the archive into a hall of fame rather than a graveyard:

- each ancien as a card — B&W portrait, final rating, peak rating, dates in
  service, and the win/loss record
- the seasons they won, as trophies. A season title is permanent and this is
  where it goes on being visible after they leave the ladder
- their signature stat: biggest single swing, longest streak, best head-to-head,
  the record they still hold
- a « leur dernière partie » line — the opponent, the score, the date. It is a
  send-off, and it costs nothing: the data is already in `rating_events`
- optionally, the all-time ladder *including* alumni, as a "if everyone who ever
  played were still here" table. The honest answer to "but where would Paul rank
  now" without letting Paul occupy the live spot

It needs no new data — `left_at`, the replay and `rating_events` already carry
all of it. That is the argument for shipping the migration in the right shape
now and the page whenever it feels worth an afternoon.

## Deliberately not built

- **Auto-inactivity.** No rule that archives someone for not playing. Departure
  is a human fact, entered by a human.
- **Rating decay for alumni.** Their rating freezes on their last match. RD
  already inflates via `decayRd`, which is the only decay that means anything
  here.
- **Per-alumnus permissions or an audit trail.** This is a casual office tool
  with open RLS policies; a departure date is enough.
- **Filtering alumni out of the Stats page.** Explicitly rejected — it would
  quietly rewrite the app's memory of who did what.
