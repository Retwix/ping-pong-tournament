# Winner highlight on 1v1 game cards (Home page)

**Date:** 2026-07-08
**Status:** Approved by Thibault (design discussion in session)

## Goal

On the home page list of games & tournaments, visually highlight the winner of a
finished 1v1 quick game (`kind === 'game'`) directly on its card.

## Context

- `useTournaments` already returns `champion: string | null` and `players: string[]`
  on every `Tournament` row. When a game's single match finishes, the auto-crown
  effect in `useTournament.ts` sets `status: 'done'` and `champion` to the winner's
  name. **No new data fetching or schema change is needed.**
- Quick games default to the name `"<playerA> vs <playerB>"` (`Setup.tsx`), but the
  user can type any custom name.
- The card is rendered in `src/components/Home.tsx` (`.t-card` with `.t-name`,
  `.t-meta`, `.t-badge`).

## Behavior

For a card where `t.kind === 'game' && t.status === 'done' && t.champion`:

1. **Winner's name appears in the title** (the common case): the title renders with
   a leading 🏆 and the winner's name wrapped in a gold + bold `<span class="t-winner">`.
   Example: `🏆 **Alice** vs Bob`.
2. **Fallback — custom name not containing the winner** (e.g. "Revanche du midi"):
   title untouched; the status badge shows `🏆 Alice` instead of `Terminé`.
3. **Everything else is strictly unchanged**: tournaments (any status), unfinished
   games, and games without a champion keep today's rendering.

### Word-boundary matching (edge case)

With players "Ali" and "Alice", if Ali wins, naive `String.includes` would highlight
the "Ali" prefix inside "Alice". Matching must only hit the winner's name as a whole
word (delimited by string edges or non-letter characters, Unicode-aware so accented
names like "Zoé" work).

## Design

### Pure helper: `src/lib/winnerHighlight.ts`

```ts
type WinnerSplit = { before: string; winner: string; after: string }
splitOnWinner(name: string, winner: string): WinnerSplit | null
```

- Returns the segments of `name` around the **first whole-word occurrence** of
  `winner`, or `null` when absent (drives the badge fallback).
- Pure function, unit-tested first (TDD). Cases: winner at start / middle / end,
  absent, substring-of-other-player ("Ali" vs "Alice"), accented names, and a
  winner name containing regex metacharacters (must be escaped or matched without
  regex).

### `Home.tsx` wiring

- Compute `const split = isWonGame ? splitOnWinner(t.name, t.champion) : null`.
- Title: `split` present → `🏆 {before}<span className="t-winner">{winner}</span>{after}`.
- Badge: `isWonGame && !split` → `🏆 {t.champion}` (keeps the `done` badge class);
  otherwise current `Terminé` / `En cours` logic.

### CSS: `src/index.css`

```css
.t-winner { color: var(--gold); font-weight: 700; }
```

`--gold` is already defined for both light and dark themes.

## Testing

- **Unit (Vitest, TDD-first):** `src/lib/winnerHighlight.test.ts` covering all
  helper cases above. This is where the behavior lives.
- The `Home.tsx` change is a thin mapping over the helper's output; it follows the
  project's existing pattern of keeping logic in `src/lib/` under test and JSX thin.

## Out of scope

- Showing final scores on the card.
- Highlighting winners of full tournaments (the champion is already implied by the
  badge flow and Champion screen).
- Any change to how `champion` is computed or stored.
