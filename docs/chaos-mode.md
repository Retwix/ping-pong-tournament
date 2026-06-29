# Chaos Mode — brainstorm & spec

A wacky, full-chaos game variant. Every **X points**, the game throws a random
twist — a malus or a bonus — that lasts for the next X points only, then resets
and re-rolls. Pure comedy over competition.

This is an opt-in mode layered on top of the existing live scorer, not a
replacement. A normal match never sees any of this unless Chaos Mode is enabled
at creation.

---

## 1. The engine (locked decisions)

- **Roll cadence:** every **X points** of *combined* score (X=2 → rolls at 2, 4,
  6, …). X is a setup parameter, default 2.
- **Two randomizations per roll:**
  1. **What** — the modifier, drawn from the pool.
  2. **Who** — its scope: both players, one random player, or a targeted player
     (current leader / loser of the last point).
- **Duration:** exactly **X points** (until the next roll). Then it clears.
- **No stacking.** Each roll wipes the previous modifier before applying the new
  one. At most one modifier is ever active.
- **Tone:** full chaos. No ELO weighting, no balancing math — the dice decide
  everything. (ELO weighting was explored and dropped.)

### "Who" scope distribution (starting point, tunable)

- ~40% **both players**
- ~30% **one random player**
- ~30% **targeted** (leader or last-point loser)

Hitting "both" often keeps it feeling fair; targeting adds the drama.

### Timing rules

- Rolls fire **between points only**, never mid-rally.
- Severity is capped so a single roll can't become unplayable (no-stacking
  already guarantees this).

---

## 2. Setup parameters (the creation flow)

New options on the Setup screen when Chaos Mode is on:

- **Chaos Mode toggle** — off by default.
- **Roll interval (X)** — every X points. Default 2. Allow 1 as a "Mayhem"
  preset (a modifier every single point — maximum chaos).
- **Chaos intensity** — which tiers are in the deck: *mild only* / *full chaos* /
  *include legendaries*.
- **Legendary rarity** — on/off + frequency. Either ~5% chance per roll, or
  seed 2–3 guaranteed-but-rare legendaries per game. Optional one-per-game cap.
- **Custom pool** — let the organizer disable specific modifiers or add their own
  (later/stretch).

---

## 3. Modifier pool

Tags: 😈 malus · 😇 bonus · 🎲 neutral-chaos. Scope noted as *both* / *one*.
All UI strings ship in **French** (app convention); English names below are
working labels.

### Grip & paddle
- 😈 **Frying pan** — play with a frying pan / book / shoe instead of a paddle. *one*
- 😈 **Wrong hand** — non-dominant hand only. *both or one*
- 😈 **Pinch grip** — hold the paddle with two fingers only. *one*
- 🎲 **Paddle swap** — players trade paddles. *both*
- 😇 **Big bat** — oversized paddle. *one*

### Body & movement
- 😈 **One-legged** — flamingo stance; foot down = lose the point. *one*
- 😈 **Hand on head** — keep one hand on your head the whole rally. *one*
- 😈 **Sumo stance** — stay in a deep squat. *both*
- 😈 **Spin serve** — spin around twice before every serve. *one*
- 🎲 **Switch sides** — players physically swap ends. *both*
- 😈 **Back to wall** — tap the back wall after every hit. *one*

### Vision & senses
- 😈 **Blindfold serve** — eyes closed for the serve. *one*
- 😈 **One eye** — cover one eye for the rally. *one*
- 😈 **Theme song** — hum/sing continuously or lose the point. *one*
- 😈 **Silent assassin** — make any sound, lose the point. *both*

### Scoring & rules
- 😇 **Double points** — this block is worth double. *both*
- 😇 **Steal** — winner of the block also steals 1 from the opponent. *neutral*
- 😈 **Sudden death** — next point, loser drops 2 instead of opponent gaining. *both*
- 😇 **Mulligan** — one free re-serve. *one*
- 🎲 **Backwards** — the losing player serves; let = a point. *both*

### Ball & serve
- 😈 **Underhand only** — all shots below the waist. *one*
- 😈 **No smashing** — soft hits only. *both*
- 😇 **Two bounces** — ball may bounce twice on your side. *one*
- 🎲 **Wall ball** — shots off a designated wall still count. *both*
- 😈 **Left side only** — return only to the opponent's left half. *one*

### Pure spectacle
- 🎲 **Costume** — silly hat / wig for the block. *one or both*
- 😈 **Commentator** — narrate your own play out loud. *one*
- 😈 **Dance break** — dance between every point. *one*
- 😇 **Crowd power** — spectators cheer to rattle the opponent. *neutral*

---

## 4. Legendary modifiers (rare, dramatic)

Show up rarely (~5% per roll or 2–3 seeded per game) with their own sound/
animation so the room knows something big dropped. 👑 = legendary.

### Score-swinging
- 👑 **The Heist** — swap scores entirely. *both*
- 👑 **Wipeout** — both scores reset to 0. *both*
- 👑 **The Tithe** — next rally winner takes half the loser's points (round up). *both*
- 👑 **Mirror Match** — both scores set to the lower one. *both*

### Power
- 👑 **Godmode** — for this block, all your shots count even off the table. *one*
- 👑 **The Veto** — bank a token to cancel the next roll entirely. *one*
- 👑 **Double Agent** — call your opponent's next serve direction; they must obey. *one*
- 👑 **Triple Threat** — block worth 3× instead of double. *both*

### Total chaos
- 👑 **Role Reversal** — try to *lose* the next 2 points; winning a point gives it away. *both*
- 👑 **The Gauntlet** — every malus at once for one single point. *both*
- 👑 **King's Decree** — current leader invents a rule on the spot; both obey. *both*
- 👑 **Sudden Death Duel** — forget the score; next point wins the game. *both*

Standout picks for max drama: **The Heist**, **Role Reversal**, **Sudden Death Duel**.

---

## 5. How it slots into the existing app

Grounded in the current React + Supabase codebase.

- **`types.ts`** — extend `Tournament` (or `Match`) with chaos config:
  `chaos_enabled`, `chaos_interval` (X), `chaos_intensity`, `chaos_legendary`.
  Persist in Supabase via a small migration in `supabase/`.
- **New data file** `src/lib/chaos.ts` — the modifier pool (typed array with
  id, label FR, emoji/tier, scope, severity), plus the roll logic: pick modifier
  + pick scope, respecting intensity/legendary settings and the no-stacking rule.
- **`Setup.tsx`** — add the Chaos Mode toggle and its sub-options near the
  "Points par jeu" block. Keep strings French, match the design tokens.
- **`LiveScorer.tsx`** — the trigger point. In `addPoint`, after the score
  updates, check whether combined score is a multiple of X; if so, roll and set
  the active modifier into match state. Render a **chaos banner/overlay** showing
  the current modifier + who it hits, with the existing pulse/`playDing` cues
  (legendaries get a bigger reveal). Score-mutating legendaries (Heist, Wipeout,
  Mirror, Tithe) patch `score_a`/`score_b` directly — make sure **Undo** captures
  these in the history snapshot.
- **Spectator/live view** — surface the active modifier on the read-only
  scoreboard so the room sees the chaos too.

### Open questions for build time
- Store the active modifier in the DB (survives refresh, shows on `/live`) vs.
  keep it client-only? DB is more robust given the existing live-sync model.
- How do score-mutating legendaries interact with match-point / win detection
  and the match-ball (`mb_saved`) tracking?
- Does Chaos Mode apply to tournament matches, quick games, or both? (Suggest:
  a per-match toggle so a serious bracket can stay clean.)

---

## 6. Suggested build order

1. Pool + roll logic (`chaos.ts`) with unit-tested randomization, no UI.
2. Setup toggle + config persistence (types + migration).
3. LiveScorer trigger + banner for the simple modifiers (no score mutation).
4. Score-mutating legendaries + Undo integration.
5. Spectator-view display + sound/animation polish.
6. Custom pool editor (stretch).
