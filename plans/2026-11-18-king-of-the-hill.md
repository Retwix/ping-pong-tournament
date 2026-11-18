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
slice in order S1âS6, each commit green.

- **Destination:** one PR `king-of-the-hill` â `main` covering S1âS6, visual review up.
- **Done when:** every acceptance example of every slice passes as a test; Stryker clean
  on the rotation/reign module; `npm run build` and `npm test` green; components
  screenshotted offline (never the dev server: it writes to prod).
- Progress (2026-11-19): S1–S6 implemented. Sheet styled 530050b (table pair as chips, abandon confirm red), prettier over new files 5788f22, Stryker king.ts 135/135, main (orgs #83) merged 18d3ce6: build + 1220 tests green on the merge (org_id has a default, king inserts unchanged). Next: reviews, push, PR.
- Progress (2026-11-18, 23:50): S5 done: /ref on a king session runs KingBoard 47195af (harness-checked: validate writes rotation, next game Inès v Hugo). S6 needs no code: « L’enjeu » already on the king screen, passes unranked=true (harness-checked); unranked.test.ts already pins no Elo / off the ladder (a king-kind test would be green first run). TV strip + crown styled 37ac382. Next: sheet style fixes, prettier style commit, Stryker king.ts, ship.
- Progress (2026-11-18, 23:20): S5 TV crown on a done session c0393c1 (zero-game shows nobody); KingTable crown counted an unfinished game, fixed 730cf5a; sessionCrown shared 42795fd; KingBoard extracted from Board 9c93d2e (harness-checked). Next: LiveView referee mode (readOnly=false) on a king session renders KingBoard (presentTo '/live'); harness-check, PR Look at. Then S6, style commit, ship.
- Progress (2026-11-18, 22:40): S4 done: one-player rotation, no crown, renders nothing 14994bf. S5 strip in SpectatorView (/live and /tv): le King + rÃ¨gne 4bee2f1, Record c6fe876, File 2d580ce, strip replaces the podium between games 48c3434. Next: session over on the TV shows the crown, not podium/classement of the rotation; then /ref on a king session renders KingTable (plain LiveScorer validation would not advance the rotation; PR Look at); then S6, prettier style commit, ship.
- Progress (2026-11-18, 21:50): S4 nearly done: no game left â AuSuivant ca67a41; abandon leaving one player ends the session cd5f37a; endKingSession extracted 42120ae; zero-game Â« Terminer Â» ends + leaves 570bfb8; hook endSession(null) â endKingSession d6d0b1c (harness-checked). Next: KingTable with a one-player rotation renders AuSuivant with no Prochain and crashes (Avatar trim); render nothing there. Then S5.
- Progress (2026-11-18, 21:00): S4: deleteMatch b86b73f + refusal fac475b; sheet Â« â Â» on table players + confirm Â« Abandonner la partie Â» + hook abandonGame (delete first, then rotation; refused delete restores both; harness-checked) f615cd5. Next: no game left after abandoning the first â AuSuivant (rÃ¨gne 0) instead of null; then auto-end at 1; then zero-game Â« Terminer Â» delete-or-close. Style owed: sheet's Â« INÃS â ZOÃ â Â» line runs together, confirm button white.
- Progress (2026-11-18, 20:50): S4 started: leaveTable c308203 (shared otherAtTable; Stryker 132/132). S4 order: deleteMatch adapter (kingSession fake: its delete().eq() only offers .select(), make it thenable) â hook abandonGame (optimistic drop match + setRotation, rollback; harness-checked) â sheet: table players get Â« â Â» + confirm Â« Abandonner la partie Â» â onAbandon(game.id, leaveTable(...)) â auto-end when rotation length 1 (onEnd(champion)) â no game left after abandoning the first one: show AuSuivant (rÃ¨gne 0) instead of null â ended with no champion (zero games): delete-or-close then onBack.
- Progress (2026-11-18, 20:40): S3 done. AuSuivant Â« â Â» e109716, Â« Ajouter Ã  la File Â» select 3d2e21e, KingFile extracted a2a4b08, mid-game Â« File Â· n Â» button + bottom sheet over the scorer 547c2ba (LiveScorer untouched; S4's leave-the-table goes in this sheet), styles, sheet swallows keydown 66cfdf2 (LiveScorer listens on window). Harness-checked phone + desktop. Sheet tests need page.viewport(390, 700). Next: S4 step 15.
- Progress (2026-11-18, late night): S3 pure rules done: joinFile 0dcce05 (joiner ahead of the in-progress game's loser: settled rotation design kept over the literal Â« File ends with LÃ©o Â», flag in PR Look at), leaveFile c12e2f6 (File = slice(2) only; Prochain between games not removable, note for S4). Stryker 126/126. Next: AuSuivant File editing UI.
- Progress (2026-11-18, night): S2 done. Step 11: closingCrowns dbb34bc, createTournament closes open sessions f539d7b. Step 12: endedWithoutAGame 6a15963, Home hides it 986e3f8 (Parties/stats already read only validated matches), delete-or-close 845d8e9 (only path today: new partie closes a gameless session; Â« Terminer Â» at zero games arrives with S4). Stryker king.ts 113/113. Next: S3 step 13.
- Progress (2026-11-18, evening): Step 9 done (menu 3c610e4, KindSwitch 13e7892: on /king neither segment pressed). Step 10 card done: kingRecap 1d81fd4, TournamentCard recap + Â« Session Â» meta 64f8c51, Home cardRecap e516468 (S2 card = Home Â« Tes tournois & parties Â» card). Left in S2: step 11 (new partie closes an open session with its crown), step 12 (zero-game delete/hide). Stryker king.ts 83/83.
- Progress (2026-11-18, later): Step 9 aâc done: recap rule aea9a0e, no estimate for king 5ae87e1, /king route + variant 5f5c107, king hides name/format/chaos/heure/poster/autre 34ce3ae. S1 rating check: no test (ratedMatches never reads kind); PR note: Stats Â« type Â» filter shows king games only under Â« tout Â». Left in 9: menu entry + segmented control (seg shows Â« Tournoi Â» active on /king).
- Progress (2026-11-18): Steps 1â8 done (8b crown b7f0399, 8c endSession cb26e6c, harness-checked incl. rollback). Earlier: 8a 9a2eba3. Step 7b shipped as a narrow
  `setRotation` (no generic patchTournament: its rollback needs a cast). libelleFormat now
  labels king Â« King of the Ping Â». Step 8 split: (a) Â« Terminer Â» on Au suivant â onEnd(champion)
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
  `KingTable` picks LiveScorer for the undone last game vs Â« Au suivant Â» when the last
  is done, and at validation calls onRotation(afterGame(rotation, winner)) â scorer via a
  render-prop seam so it's browser-testable; (d) Board's king branch wires it.
- Not done, note in PR: two devices tapping Â« Lancer la partie Â» together could insert
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
  `[winner, ...rotation.slice(2), loser]`. The Â« Au suivant Â» screen shows when the last
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
- **Creation UI:** `NewMenu` gets Â« ð King of the Ping Â» â route `/king` â
  `NouvellePartie` variant `'king'` (2+ players, target 5/7/11 default 7, the existing
  Â« L'enjeu Â» control gives S6, no doubles, no Chaos, no sets). `lib/nouvellePartie.ts`
  `recapitulatif` owns the validity/hint rule.

## Steps (one commit each, TDD)

1. `lib/king.ts`: first game from a shuffled roster (a v b, b serves).
2. Rotation after a validated game (winner stays, loser to the back; 2-player case).
3. Reigns: current King's run, session Record, champion with first-reached tie-break.
4. `postsToSlack` false for king; auto-crown skips king (extract the rule if needed).
5. `createTournament` path for `'king'` (one first match, no Slack invite).
6. Â« Au suivant Â» props-driven component (King, rÃ¨gne, Prochain, File, start button).
7. Board king branch: scorer â validation writes rotation â Â« Au suivant Â» â next game.
8. Â« Terminer Â» + crown screen. 9. Creation UI (`/king`, menu item, recap rule, enjeu).
10â12. S2: Parties card, new partie closes an open session, zero-game delete/hide.
13â14. S3: join at back / leave from File (rotation edits), realtime already covers it.
15. S4: abandon mid-game + auto-end at 1. 16. S5: king strip on /live and /tv.
17. S6 check: unranked session moves no Elo.

## Slices

Parent: people at the office who only have a few minutes can drop into a running
winner-stays session at the table, play ranked games while they are there, and leave
without wrecking anyone else's game.

Each slice ships to production on its own. S1 is the primitive whole; the order after it
puts the core promise (come and go) before the presentation work.

### S1 â Play a fixed-roster session, winner stays (first)

- **Value:** a group can run King of the Ping today with whoever is in the room; every
  game counts on the ladder. Proves the new kind runs end to end on the real path.
- **Includes:** Â« King of the Ping Â» in Â« + Nouveau Â»; pick 2+ present players and a
  target (5 / 7 / 11, default 7); the app shuffles; the first two play one set, win by 2,
  challenger serves first (17). When a game is validated, the Â« Au suivant Â» screen
  shows le King ð and their rÃ¨gne, Prochain and the File; one tap starts the next game
  with the loser at the back (1, 11). Â« Terminer Â» (anyone) ends it and shows the crown:
  longest reign, tie to whoever got there first (8, 9). Games are ranked 1v1s (2).
- **Defers:** joining, leaving, editing the File, abandoning a game, auto-end at 1,
  /live and TV strip, Parties card, Â« Non classÃ©e Â», a new partie closing the session,
  deleting a zero-game session.
- **Acceptance examples:**
  - Given LÃ©o, InÃ¨s, Sam picked and the shuffle gives InÃ¨s, Sam, LÃ©o; when the session
    starts, then InÃ¨s plays Sam and the File reads LÃ©o; Sam (challenger) serves first.
  - Given InÃ¨s beats Sam 7-4; then Â« Au suivant Â» shows InÃ¨s ð rÃ¨gne 1, Prochain LÃ©o,
    File Sam; one tap opens InÃ¨s v LÃ©o with LÃ©o serving.
  - Given InÃ¨s won 2 in a row, then LÃ©o won 2 in a row; when someone taps Â« Terminer Â»,
    then InÃ¨s is crowned (2, reached first).
  - Given a 7-5 win in a session; then both players' ratings move as for any ranked 1v1.
  - Given two players only; the loser plays the winner again, over and over.
- **Release constraint:** shippable. Until S2, a finished session shows in Parties with
  the generic card and an unfinished one stays Â« En cours Â» after a new partie starts.
- **Shape hint (for planning, not a decision):** `kind` is free text (no check
  constraint), so a new kind needs no migration; with a fixed roster the File is
  derivable from the shuffled `players` order plus the finished games, so S1 may need
  no schema change at all. Matches are appended one at a time instead of up front.
  /live picks the first undone match, so it should follow the session as games append:
  check, don't assume.

### S2 â See a session afterwards

- **Value:** a finished session reads as one thing in history; no ghost sessions.
- **Includes:** one Parties card per session: Â« King of the Ping Â», champion, reign
  length, game count (14). Starting any new partie closes an open session and computes
  its crown (9). A session ended with zero games is deleted when the person ending it is
  a signed-in claimed player, otherwise stays done with no champion; Parties and stats
  hide it (18).
- **Defers:** an all-time Â« plus long rÃ¨gne Â» record (out of v1 per 14).
- **Acceptance examples:** a session where InÃ¨s reigned 3 shows Â« InÃ¨s ð 3 victoires
  d'affilÃ©e Â· 5 parties Â»; starting a quick game while a session runs closes it with its
  champion; Â« Terminer Â» before any game, anonymous, leaves no card in Parties.

### S3 â Join and leave the File

- **Value:** the core promise: someone arriving mid-session plays without a restart;
  someone who has to go leaves without stopping anyone.
- **Includes:** from Â« Au suivant Â» or the session screen on any phone (10): add a
  player at the back of the File; remove anyone from the File (4). Realtime keeps every
  open device in step.
- **Defers:** removing a player who is at the table (S4).
- **Acceptance examples:** LÃ©o joins while InÃ¨s v Sam is on; after the game the File
  ends with LÃ©o. Sam leaves from the File and is never called up. Two phones on the
  session both see the change without a reload.
- **Likely needs:** a persisted roster/File (a column or rows): the File stops being
  derivable once people come and go. A migration, verified on local Postgres first.

### S4 â Leave the table mid-game

- **Value:** a player called away mid-game doesn't leave the table stuck.
- **Includes:** removing a player who is at the table abandons the game: nothing
  recorded, no rating moves; the one who stays holds the table as King, even as the
  challenger; the front of the File steps up (5). The abandoned game neither extends nor
  breaks a reign (8). The session ends by itself when one player is left (7).
- **Acceptance examples:** InÃ¨s v Sam at 4-3, Sam leaves: no match row survives, no
  Elo change, InÃ¨s is King with her reign unchanged, LÃ©o steps up. With only InÃ¨s and
  Sam, Sam leaves: the session ends and the crown is computed.

### S5 â Watch it on /live and the TV

- **Value:** spectators see who holds the table and who is next.
- **Includes:** the game in progress plus a king strip: le King and their rÃ¨gne, the
  session Record, the File in order (13).

### S6 â Â« Non classÃ©e Â» sessions

- **Value:** a warm-up or newcomers' session leaves the ladder alone.
- **Includes:** the Â« Non classÃ©e Â» toggle on the King of the Ping creation screen (2);
  its games move no Elo and stay out of Â« Le classement Â», like an unranked game.
- Small and independent; can ride along with any slice after S1.

### Parking lot

- An all-time Â« plus long rÃ¨gne Â» record (excluded from v1 by 14).
- Doubles and Chaos for King of the Ping (excluded from v1 by 15).

### Warnings

- S1 ships with the generic Parties card (see its release constraint); S2 right after
  keeps that window short.
- S3 is where the data model changes; keep S1 from inventing a persisted File it
  will not need.

## Decisions

1. **Rotation: winner stays, no cap.** The loser goes to the back of the queue; the
   front of the queue challenges next. The king stays until beaten, however long.
2. **Ranked by default, Â« Non classÃ©e Â» toggle at creation.** Each game is an ordinary
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
9. **Ending: a Â« Terminer Â» button anyone can tap, or starting any new partie closes it.**
   Either way the crown is computed from the games played. Plus the automatic end at 1
   player (decision 7). No timer, no server job.
10. **Queue control: anyone, from any phone.** The session screen shows the table and the
    queue; any device can add a player at the back or remove anyone. Matches the app's
    open write policies; realtime keeps /live and the TV in step.
11. **Between games: an Â« Au suivant Â» screen in the scorer.** Shows the king and their
    current reign, the next challenger and the queue; the queue is editable there; one tap
    starts the next game.
12. **The mode is called Â« King of the Ping Â»** in the UI (Â« + Nouveau Â», Parties, TV,
    result). On-screen words are decision 19.
13. **/live and the TV: the game in progress plus a king strip.** The king and their
    current reign, the session's best reign so far, and the queue in order.
14. **Afterwards: one Parties card per session** (champion, reign length, game count).
    Each game feeds player stats and head-to-heads like any 1v1. No all-time Â« plus long
    rÃ¨gne Â» record in v1.
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
19. **On-screen words:** Â« le King Â» ð for the player holding the table, Â« rÃ¨gne Â» for
    their streak (Â« 3 victoires d'affilÃ©e Â»), Â« Prochain Â» for the next challenger,
    Â« File Â» for the queue, Â« Record Â» for the session's best reign.

## Open

None: every branch has a decision above.
