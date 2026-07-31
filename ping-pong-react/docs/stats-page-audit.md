# Stats page audit — what's there, what's missing, potential updates

Audit date: 2026-07-29. Compares `src/components/Stats.tsx` + `src/lib/stats.ts` against
the database surface (`supabase/*.sql`) and the other pages (Ratings, Predictions, dashboard
RecordsCard).

## What the stats page shows today

- **KPI strip**: matches played, player count, total points.
- **Activity chart**: matches per day.
- **Player leaderboard** (sortable): played, wins, losses, win %, point diff, current
  streak, match balls saved, match balls wasted.
- **Win-rate bars**: top 8 players by win rate.
- **Team ("pôle") leaderboard**: players, played, wins, win % (intra-team games excluded).
- **Records**: longest/shortest match, biggest blowout, closest game, most points in a
  match, most active, longest streak, capots dealt ("Bourreau"), capots taken ("Roi de la
  table"), match balls saved ("Sang-froid"), match balls wasted ("Cardiaque").
- **Head-to-head matrix** + **rivalries** (most played, tightest).
- **Player detail modal**: KPI grid, nemesis ("bête noire"), favorite victim, last 8 matches.

Data source: all `done` matches (byes excluded) + player registry, live via realtime.

## Database data NOT used by the stats page

| Data | Where it lives | Opportunity |
|---|---|---|
| Glicko-2 ratings (`rating`, `peak_rating`, `rated_games`, `last_rated_at`) | `players` | No rating column in the leaderboard, no peak-rating record; Ratings page is separate and unlinked |
| Rating history (`delta`, `stakes`, `won`, before/after) | `rating_events` | No sparkline / trend in the player detail modal, no "finals" stats |
| Tournament outcomes (`champion`, `kind`, `format`, `name`) | `tournaments` | **No titles count anywhere** — "who has won the most tournaments" is absent from the whole app |
| Match `round` / bracket metadata (`bracket`, `match_key`) | `matches` | No finals win rate, no loser-bracket comeback stats |
| `serve_start` | `matches` | Win rate when serving first (novelty stat) |
| Timestamps beyond day-bucketing | `matches` | No period filter (month/week), no per-player total/average play time, no "last seen" |
| Predictions (`bettor_name`, `status`, `bet_type`) | `predictions` | Stats page ignores betting entirely (own page exists — cross-link at most) |
| Chaos config | `tournaments` | Per-match chaos effects are **not stored at all**, so no chaos stats are possible without a data-model change |

## Present but arguably unnecessary / redundant

1. **MB ✓ / MB ✗ columns in the main leaderboard** — two of the nine columns for a niche
   stat that already has two record cards and two player-modal KPIs. Candidates to move to
   the player detail only.
2. **Win-rate bars chart** — repeats the `%` column of the table directly above it, for
   only the top 8. Low information gain; prime slot for something the page doesn't show
   yet (rating evolution, weekday activity heat, etc.).
3. **"Most points" record** — largely correlated with "closest game" (long deuce games win
   both). Could merge or replace with a fresher record.
4. **Records duplication with the dashboard's RecordsCard** (top streak, most active,
   biggest upset in `lib/dashboardRecords.ts`) — two implementations of overlapping
   records; could share one module.
5. **H2H matrix column headers use only the first letter** — ambiguous once two players
   share an initial.
6. **Subtitle wording** — says "tournois terminés" but the query counts every finished
   match, including those inside still-active tournaments.

## Potential updates, prioritized

### High value, data already available
1. **Tournament titles ("Palmarès")** — titles count per player (from `tournaments.champion`),
   a "Serial winner 🏆" record card, and a trophy count column or badge in the leaderboard.
2. **Ratings integration** — Glicko rating (+ trend arrow) as a sortable leaderboard
   column; "Peak rating" record card; rating sparkline in the player detail modal
   (rating_events already drive sparklines on the Ratings page).
3. **Period filter** — All-time / this month / this week toggle applied to every section
   (timestamps already on each match).
4. **Kind filter** — split or toggle quick games vs tournament matches (`tournaments.kind`),
   instead of silently merging them.
5. **Form column** — last 5 results as W/L dots in the leaderboard (data already computed
   for streaks).

### Medium value
6. **Finals stats** — finals played / finals win rate per player from `rating_events.stakes`
   or bracket metadata; "Mr. Finals" record card; "loser-bracket comeback" record for
   double-elim champions.
7. **Play-time stats** — total and average match duration per player; "Marathon man"
   record (durations already power longest/shortest match).
8. **Points-per-match averages** — avg scored / conceded in the player modal
   (pointsFor/pointsAgainst are computed but never shown).
9. **Last-played / activity status** — "last seen" date per player; dim dormant players.
10. **Full opponent record list in player modal** — the `opponentRecords` data is computed
    but only nemesis + victim are displayed.

### Cleanups
11. Slim the main leaderboard: move MB columns to the player modal, add rating/titles instead.
12. Replace the win-rate bars with a chart that adds new information.
13. Share one records module between Stats and the dashboard RecordsCard.
14. Use 2–3-letter abbreviations (or avatars) in the H2H matrix header.
15. Fix the subtitle to match what is actually counted.

### Requires a data-model change
16. **Chaos stats** — store applied chaos events per match to enable "wins under chaos",
    "most cursed player", etc.
17. **Serve tracking** — `serve_start` allows "won when serving first"; per-point serve
    data would need new storage.
