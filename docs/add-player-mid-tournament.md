# Adding a player mid-tournament — design notes

Status: **idea / not built yet.** This captures how we'd add a latecomer to an
active round-robin tournament, and why it's safe to do given the current model.

## The ask

Someone joins after the tournament has started (first round not finished). We
want to add them so they still play everyone — but their new matches should only
land in **rounds that aren't finished yet**, never in a round we've already
completed.

## Why this is easy here

The data model is already friendly to it:

- The full schedule is generated once at creation (`generateSchedule` →
  `matches` rows), but matches are played **ad-hoc**: you tap any matchup to
  score it, there's no "current round" gate (`Board.tsx` / `LiveScorer.tsx`).
- Standings are computed live from finished matches
  (`computeStandings(players, matches)`), independent of round numbers.
- The champion is only crowned once **every** match is `done`
  (`useTournament.ts`). New unfinished matches simply postpone that.
- New match rows already propagate to every device via the realtime
  subscription on the `matches` table, and roster changes via the `tournaments`
  subscription. So inserting rows + updating `players` is enough — no manual
  refresh.

Net effect: round-robin integrity ("everyone plays everyone exactly once") is
preserved as long as we add one match between the newcomer and each existing
player.

## The rule: only future rounds

A round counts as **finished** when all of its matches are `done`.

1. Group existing matches by `round`; mark each round finished/unfinished.
2. Find the earliest **non-finished** round — that's the first round we're
   allowed to use. (A partially-played round still counts as "coming up", so the
   newcomer can join it; only fully-completed rounds are off-limits.)
3. Place **one** new match per round, walking forward from that first open
   round, skipping any finished round we encounter. One-per-round means the
   newcomer is never double-booked against themselves.
4. If we run past the last existing round, just keep creating higher round
   numbers — those become brand-new appended rounds.

`idx` for the new rows continues from the current max `idx` + 1 so ordering
stays stable. `player_a_id` / `player_b_id` are resolved from the registry like
`createTournament` does, to keep stats rename-proof.

## Where it'd live

- `db.ts`: a new `addPlayerToTournament(tournamentId, name)` that does the
  round analysis above, `updateTournament(..., { players: [...players, name] })`,
  and inserts the newcomer's match rows.
- `Board.tsx`: a small "Add player" control on the active tournament screen
  (only `kind === 'tournament'` and `status === 'active'`), reusing the
  registered-player dropdown pattern from `Setup.tsx` (+ option for a brand-new
  name). No local refresh needed — realtime handles it.

## Caveats / things to decide

- **Cosmetic only:** adding a player flips the odd/even parity, so the tidy
  "one match each per round + clean byes" structure loosens for the appended
  matches. Because play is ad-hoc, nobody really notices — but the "Tour N /
  exempt" labels in `MatchList` will look less balanced.
- **Existing-player double-booking within a round:** the newcomer's match in
  round R may pair them with someone who already has a match in round R. Harmless
  since matches are played in any order; could be optimised later (e.g. prefer
  pairing the newcomer with whoever has the bye in that round).
- **Deploy reality:** this is a code change requiring a redeploy — it won't help
  a person standing at the table right now unless running a dev build.
- **Open question:** start the newcomer in the *current* in-progress round, or
  only from the *next* round onward? The notes above start at the current
  in-progress round (it isn't "finished"). Easy to change to next-round-only.
