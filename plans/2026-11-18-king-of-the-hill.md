# King of the Ping

## Idea

A drop-in format for short sessions: people who have to leave soon still get to play,
where a full tournament would leave them waiting or sitting out.

## Where it sits today

- A `Tournament` row is either a `tournament` (round-robin or double-elim, fixed roster)
  or a quick `game` (one match: 1 / 3 / 5 sets, can be unranked or doubles).
- Neither format lets players join or leave once it has started.

### Code map (read 2026-11-18, for slicing and planning)

- `lib/db.ts` `createTournament(name, players, target, kind, format, chaos, unranked,
  teams, bestOf)`: clears `is_active` everywhere, shuffles a round-robin roster, inserts
  the row and every match up front. A `game` is one round-robin match. King of the Ping
  will instead append matches one at a time.
- `TournamentKind` is `'tournament' | 'game'` (`types.ts`). Matches carry `round`/`idx`,
  `player_a/b(_id)`, `serve_start` (`blankMatch` defaults `'a'`; LiveScorer flips it).
- RLS (`supabase/schema.sql`): matches fully open; tournaments open for select / insert /
  update; delete only for a signed-in claimed player. `deleteTournament` throws when zero
  rows go, so an anonymous delete surfaces as an error to catch.
- Ratings: `ratedMatches` drops unranked tournaments; `replayRatings` takes margins over
  `targetByTournament`, so a 7-point target is already normalised.
- Slack stays off through `postsToSlack` (see `plans/2026-10-21-game-sets.md`).
- Routes: `/t/:id` board, `/live`, `/tv`, `/ref` (current), all follow `is_active`.
- Tests: `src/**/*.test.ts` (node) and `src/**/*.browser.test.tsx` (Playwright chromium);
  Stryker scoped with `npx stryker run --mutate <file>` (one `--mutate` only).

## Next

Grilling confirmed 2026-11-18; the human asked to run `until-pr`. Next: `story-splitting`
into end-to-end slices, pick the first (likely: create a session and play winner-stays
games with a fixed queue, ranked), declare destination + done, then TDD to a PR.

## Decisions

1. **Rotation: winner stays, no cap.** The loser goes to the back of the queue; the
   front of the queue challenges next. The king stays until beaten, however long.
2. **Ranked by default, « Non classée » toggle at creation.** Each game is an ordinary
   1v1 on the ladder (per-match Glicko-2, margin normalised by target). A win streak
   earns nothing beyond the sum of its games.
3. **Game length: always one set, target 5 / 7 / 11 chosen once at creation, default 7.**
   Win by 2. No best-of in this mode.
4. **Roster is open: join at the back of the queue, leave any time.** Anyone waiting can
   step out without touching the game in progress.
5. **A player at the table leaving mid-game abandons the game.** Nothing is recorded and
   no rating moves; the player who stays holds the table as king (even if they were the
   challenger) and the front of the queue steps up.
6. **Start: pick who is present, the app shuffles.** The first two in the shuffled order
   play the first game; the rest queue in that order.
7. **Headcount: 2 to start, ends automatically at 1.** Starting with 2 expects others to
   join; with 2 present they simply keep playing each other.
8. **Champion: longest reign** (most consecutive wins in the session); a tie goes to
   whoever reached it first. An abandoned game (decision 5) neither extends nor breaks a
   reign, since it never happened.
9. **Ending: a « Terminer » button anyone can tap, or starting any new partie closes it.**
   Either way the crown is computed from the games played. Plus the automatic end at 1
   player (decision 7). No timer, no server job.
10. **Queue control: anyone, from any phone.** The session screen shows the table and the
    queue; any device can add a player at the back or remove anyone. Matches the app's
    open write policies; realtime keeps /live and the TV in step.
11. **Between games: an « Au suivant » screen in the scorer.** Shows the king and their
    current reign, the next challenger and the queue; the queue is editable there; one tap
    starts the next game.
12. **The mode is called « King of the Ping »** in the UI (« + Nouveau », Parties, TV,
    result). On-screen words are decision 19.
13. **/live and the TV: the game in progress plus a king strip.** The king and their
    current reign, the session's best reign so far, and the queue in order.
14. **Afterwards: one Parties card per session** (champion, reign length, game count).
    Each game feeds player stats and head-to-heads like any 1v1. No all-time « plus long
    règne » record in v1.
15. **Singles only, no Chaos in v1.** The creation screen doesn't offer doubles or Chaos
    for King of the Ping.
16. **No Slack.** No invitation, no result post; kept off like best-of sets
    (`postsToSlack`).
17. **The challenger serves first** by default each game; the scorer's existing flip
    still works.
18. **A session that ends with zero completed games is deleted, through the existing
    policy only.** When whoever ends it is signed in with a claimed player, the row is
    deleted. Otherwise it stays as a done row with no champion. No new function, no
    policy change. Parties and stats hide a King of the Ping session with no
    completed game.
19. **On-screen words:** « le King » 👑 for the player holding the table, « règne » for
    their streak (« 3 victoires d'affilée »), « Prochain » for the next challenger,
    « File » for the queue, « Record » for the session's best reign.

## Open

None: every branch has a decision above.
