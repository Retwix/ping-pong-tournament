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

Grilling confirmed 2026-11-18; split into slices the same day (below). The human asked
to run `until-pr` and chose **one PR for all six slices** (2026-11-18), committed slice by
slice in order S1→S6, each commit green.

- **Destination:** one PR `king-of-the-hill` → `main` covering S1–S6, visual review up.
- **Done when:** every acceptance example of every slice passes as a test; Stryker clean
  on the rotation/reign module; `npm run build` and `npm test` green; components
  screenshotted offline (never the dev server: it writes to prod).
- Progress (2026-11-18, 20:40): S3 done. AuSuivant « ✕ » e109716, « Ajouter à la File » select 3d2e21e, KingFile extracted a2a4b08, mid-game « File · n » button + bottom sheet over the scorer 547c2ba (LiveScorer untouched; S4's leave-the-table goes in this sheet), styles, sheet swallows keydown 66cfdf2 (LiveScorer listens on window). Harness-checked phone + desktop. Sheet tests need page.viewport(390, 700). Next: S4 step 15.
- Progress (2026-11-18, late night): S3 pure rules done: joinFile 0dcce05 (joiner ahead of the in-progress game's loser: settled rotation design kept over the literal « File ends with Léo », flag in PR Look at), leaveFile c12e2f6 (File = slice(2) only; Prochain between games not removable, note for S4). Stryker 126/126. Next: AuSuivant File editing UI.
- Progress (2026-11-18, night): S2 done. Step 11: closingCrowns dbb34bc, createTournament closes open sessions f539d7b. Step 12: endedWithoutAGame 6a15963, Home hides it 986e3f8 (Parties/stats already read only validated matches), delete-or-close 845d8e9 (only path today: new partie closes a gameless session; « Terminer » at zero games arrives with S4). Stryker king.ts 113/113. Next: S3 step 13.
- Progress (2026-11-18, evening): Step 9 done (menu 3c610e4, KindSwitch 13e7892: on /king neither segment pressed). Step 10 card done: kingRecap 1d81fd4, TournamentCard recap + « Session » meta 64f8c51, Home cardRecap e516468 (S2 card = Home « Tes tournois & parties » card). Left in S2: step 11 (new partie closes an open session with its crown), step 12 (zero-game delete/hide). Stryker king.ts 83/83.
- Progress (2026-11-18, later): Step 9 a–c done: recap rule aea9a0e, no estimate for king 5ae87e1, /king route + variant 5f5c107, king hides name/format/chaos/heure/poster/autre 34ce3ae. S1 rating check: no test (ratedMatches never reads kind); PR note: Stats « type » filter shows king games only under « tout ». Left in 9: menu entry + segmented control (seg shows « Tournoi » active on /king).
- Progress (2026-11-18): Steps 1–8 done (8b crown b7f0399, 8c endSession cb26e6c, harness-checked incl. rollback). Earlier: 8a 9a2eba3. Step 7b shipped as a narrow
  `setRotation` (no generic patchTournament: its rollback needs a cast). libelleFormat now
  labels king « King of the Ping ». Step 8 split: (a) « Terminer » on Au suivant → onEnd(champion)
  done; (b) props-driven `KingCrown` shown by KingTable when the session is done; (c) hook
  `endSession` sharing a private writeTournament(patch, rollback) with setRotation, Board wiring
  (8a uses a plain updateTournament), harness check. Also owed: an S1 test that a king match is
  rated like any ranked 1v1 (ratedMatches).
  `lib/king.ts`: `nextGame`, `afterGame`, `longestReign`, `reignOf`,
  `crownsWhenAllMatchesDone`. `lib/db.ts`: `addKingGame(tid, rotation, played)` appends
  the next game (idx = played.length); `createTournament('king')` calls it with `[]`.
  `components/AuSuivant.tsx` (props: rotation, matches, look, onNext) is built.
- Step 7 split: (b) `useTournament` gains an optimistic `patchTournament` (hooks are
  untested in this repo; mirror patchMatch, verify by offline render); (c) props-driven
  `KingTable` picks LiveScorer for the undone last game vs « Au suivant » when the last
  is done, and at validation calls onRotation(afterGame(rotation, winner)) — scorer via a
  render-prop seam so it's browser-testable; (d) Board's king branch wires it.
- Not done, note in PR: two devices tapping « Lancer la partie » together could insert
  two games (no unique index; accepted for v1).

## Build notes (design settled 2026-11-18, not yet coded)

- **No migration.** A session is `kind: 'king'` (`kind` is free text). Its `players`
  column holds the **rotation**: the current roster in order `[King, Prochain, ...File]`.
  At the very first game `[0]` is side a and `[1]` the challenger. Leavers drop out of
  `players`; their games stay in `matches`. This replaces the persisted-File migration
  S3 anticipated, so the PR has no database step (tell the human; they had accepted one).
- **Games are appended** one at a time: `player_a = rotation[0]`, `player_b = rotation[1]`,
  `serve_start: 'b'` (challenger serves, 17), `idx`/`round` = next after the last.
- **On validation** (the scorer device only): rotation becomes
  `[winner, ...rotation.slice(2), loser]`. The « Au suivant » screen shows when the last
  match is done: King `[0]`, Prochain `[1]`, File `slice(2)`. One tap inserts the next.
- **Reigns come from done matches in `idx` order**: a run of consecutive wins by one
  player. An abandoned game (S4) is deleted, so it neither extends nor breaks a run.
  Champion = longest run, tie to the run that reached that length first.
- **Abandon (S4):** delete the in-progress match; rotation becomes `[stayer, ...File]`;
  one player left ends the session.
- **Traps found reading the code:**
  - `useTournament`'s auto-crown effect marks a non-double-elim tournament done as soon
    as every match is done, which a king session hits after each game: skip `'king'`.
  - `postsToSlack` (`lib/sets.ts`) only checks `best_of`, so it says yes for a king
    session: make it say no for `'king'` (16).
  - Readers of `t.players` that would misread a rotation: `TournamentCard`,
    `lib/parties.ts`, `lib/tournamentBoard.ts`, `Predictions`, `LiveView`,
    `SpectatorView`, `Champion`.
  - `Board.tsx` renders `kind === 'game'` specially and treats everything else as a
    tournament; king needs its own branch.
- **Testing shape:** rules in a pure `lib/king.ts` (node tests, Stryker). UI through
  props-driven components in `*.browser.test.tsx` (`vi.mock` is broken in browser
  tests). Board/hook wiring checked by rendering offline with `lib/db` and
  `lib/supabase` stubbed, never against prod.
- **Creation UI:** `NewMenu` gets « 👑 King of the Ping » → route `/king` →
  `NouvellePartie` variant `'king'` (2+ players, target 5/7/11 default 7, the existing
  « L'enjeu » control gives S6, no doubles, no Chaos, no sets). `lib/nouvellePartie.ts`
  `recapitulatif` owns the validity/hint rule.

## Steps (one commit each, TDD)

1. `lib/king.ts`: first game from a shuffled roster (a v b, b serves).
2. Rotation after a validated game (winner stays, loser to the back; 2-player case).
3. Reigns: current King's run, session Record, champion with first-reached tie-break.
4. `postsToSlack` false for king; auto-crown skips king (extract the rule if needed).
5. `createTournament` path for `'king'` (one first match, no Slack invite).
6. « Au suivant » props-driven component (King, règne, Prochain, File, start button).
7. Board king branch: scorer → validation writes rotation → « Au suivant » → next game.
8. « Terminer » + crown screen. 9. Creation UI (`/king`, menu item, recap rule, enjeu).
10–12. S2: Parties card, new partie closes an open session, zero-game delete/hide.
13–14. S3: join at back / leave from File (rotation edits), realtime already covers it.
15. S4: abandon mid-game + auto-end at 1. 16. S5: king strip on /live and /tv.
17. S6 check: unranked session moves no Elo.

## Slices

Parent: people at the office who only have a few minutes can drop into a running
winner-stays session at the table, play ranked games while they are there, and leave
without wrecking anyone else's game.

Each slice ships to production on its own. S1 is the primitive whole; the order after it
puts the core promise (come and go) before the presentation work.

### S1 — Play a fixed-roster session, winner stays (first)

- **Value:** a group can run King of the Ping today with whoever is in the room; every
  game counts on the ladder. Proves the new kind runs end to end on the real path.
- **Includes:** « King of the Ping » in « + Nouveau »; pick 2+ present players and a
  target (5 / 7 / 11, default 7); the app shuffles; the first two play one set, win by 2,
  challenger serves first (17). When a game is validated, the « Au suivant » screen
  shows le King 👑 and their règne, Prochain and the File; one tap starts the next game
  with the loser at the back (1, 11). « Terminer » (anyone) ends it and shows the crown:
  longest reign, tie to whoever got there first (8, 9). Games are ranked 1v1s (2).
- **Defers:** joining, leaving, editing the File, abandoning a game, auto-end at 1,
  /live and TV strip, Parties card, « Non classée », a new partie closing the session,
  deleting a zero-game session.
- **Acceptance examples:**
  - Given Léo, Inès, Sam picked and the shuffle gives Inès, Sam, Léo; when the session
    starts, then Inès plays Sam and the File reads Léo; Sam (challenger) serves first.
  - Given Inès beats Sam 7-4; then « Au suivant » shows Inès 👑 règne 1, Prochain Léo,
    File Sam; one tap opens Inès v Léo with Léo serving.
  - Given Inès won 2 in a row, then Léo won 2 in a row; when someone taps « Terminer »,
    then Inès is crowned (2, reached first).
  - Given a 7-5 win in a session; then both players' ratings move as for any ranked 1v1.
  - Given two players only; the loser plays the winner again, over and over.
- **Release constraint:** shippable. Until S2, a finished session shows in Parties with
  the generic card and an unfinished one stays « En cours » after a new partie starts.
- **Shape hint (for planning, not a decision):** `kind` is free text (no check
  constraint), so a new kind needs no migration; with a fixed roster the File is
  derivable from the shuffled `players` order plus the finished games, so S1 may need
  no schema change at all. Matches are appended one at a time instead of up front.
  /live picks the first undone match, so it should follow the session as games append:
  check, don't assume.

### S2 — See a session afterwards

- **Value:** a finished session reads as one thing in history; no ghost sessions.
- **Includes:** one Parties card per session: « King of the Ping », champion, reign
  length, game count (14). Starting any new partie closes an open session and computes
  its crown (9). A session ended with zero games is deleted when the person ending it is
  a signed-in claimed player, otherwise stays done with no champion; Parties and stats
  hide it (18).
- **Defers:** an all-time « plus long règne » record (out of v1 per 14).
- **Acceptance examples:** a session where Inès reigned 3 shows « Inès 👑 3 victoires
  d'affilée · 5 parties »; starting a quick game while a session runs closes it with its
  champion; « Terminer » before any game, anonymous, leaves no card in Parties.

### S3 — Join and leave the File

- **Value:** the core promise: someone arriving mid-session plays without a restart;
  someone who has to go leaves without stopping anyone.
- **Includes:** from « Au suivant » or the session screen on any phone (10): add a
  player at the back of the File; remove anyone from the File (4). Realtime keeps every
  open device in step.
- **Defers:** removing a player who is at the table (S4).
- **Acceptance examples:** Léo joins while Inès v Sam is on; after the game the File
  ends with Léo. Sam leaves from the File and is never called up. Two phones on the
  session both see the change without a reload.
- **Likely needs:** a persisted roster/File (a column or rows): the File stops being
  derivable once people come and go. A migration, verified on local Postgres first.

### S4 — Leave the table mid-game

- **Value:** a player called away mid-game doesn't leave the table stuck.
- **Includes:** removing a player who is at the table abandons the game: nothing
  recorded, no rating moves; the one who stays holds the table as King, even as the
  challenger; the front of the File steps up (5). The abandoned game neither extends nor
  breaks a reign (8). The session ends by itself when one player is left (7).
- **Acceptance examples:** Inès v Sam at 4-3, Sam leaves: no match row survives, no
  Elo change, Inès is King with her reign unchanged, Léo steps up. With only Inès and
  Sam, Sam leaves: the session ends and the crown is computed.

### S5 — Watch it on /live and the TV

- **Value:** spectators see who holds the table and who is next.
- **Includes:** the game in progress plus a king strip: le King and their règne, the
  session Record, the File in order (13).

### S6 — « Non classée » sessions

- **Value:** a warm-up or newcomers' session leaves the ladder alone.
- **Includes:** the « Non classée » toggle on the King of the Ping creation screen (2);
  its games move no Elo and stay out of « Le classement », like an unranked game.
- Small and independent; can ride along with any slice after S1.

### Parking lot

- An all-time « plus long règne » record (excluded from v1 by 14).
- Doubles and Chaos for King of the Ping (excluded from v1 by 15).

### Warnings

- S1 ships with the generic Parties card (see its release constraint); S2 right after
  keeps that window short.
- S3 is where the data model changes; keep S1 from inventing a persisted File it
  will not need.

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
