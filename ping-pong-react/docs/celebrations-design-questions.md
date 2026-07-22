# Celebrations revamp — round 2 brief

Follow-up to the `design_handoff_celebrations` bundle (`Celebrations.dc.html`,
screens `#6a`, `#5a`, `#4b`, `#4c`).

**Extend the existing `Celebrations.dc.html`** — same runtime, same conventions,
same id scheme. Don't start a new file. Where a question below has a stated
default, **make the call and draw it**; only flag it back if you actively
disagree. We'd rather have opinionated mockups than a list of answers.

---

## 1. Deliverables

### Screens to add

| id | What | Canvas |
|---|---|---|
| `#6a-m` | 1v1 win, phone portrait | 402 × 874 |
| `#5a-m` | Tournament winner + standings, phone portrait | 402 × 874 |
| `#4b-m` | Capot, phone portrait | 402 × 874 |
| `#5a-rr` | Tournament winner + standings, **round-robin** variant, desktop | 1180 × 840 |
| `#5a-rr-m` | Round-robin variant, phone portrait | 402 × 874 |

### Screens to update

- `#6a` — eyebrow copy changes to `PARTIE TERMINÉE` (was "MATCH TERMINÉ").
- `#5a` — eyebrow becomes `{nom du tournoi} · TERMINÉ`; drop "· FINALE".
- Both — avatar treatment must support photos (see §4).

### Screens to delete

- `#4c` (simple win, phone) — dropped entirely. `#6a` is now the only 1v1 result
  design, on every surface. `#6a-m` replaces `#4c`'s role.
- `#4a` — already an empty placeholder, remove it.

---

## 2. Fixed constraints (do not change)

- **No light-mode variants.** These screens stay fixed dark — purple for
  6a/5a, coral/red for 4b — in both the app's light and dark themes. They are
  deliberately theme-independent takeover moments.
- **Buttons are out of scope.** The app keeps its own existing actions and
  navigation. Ignore "Partager la honte", "Voir le classement complet",
  "Revanche immédiate", etc. Draw a generic two-button action row as a slot; we
  only need its *layout*, not its labels. (Assume 2 buttons: one primary, one
  ghost, on every screen.)
- **Podium bar count follows player count.** 2 players = gold + silver, centred,
  no empty bronze. Never draw a placeholder bar.
- **Double-elim ranking for places 4+** is settled: ordered by elimination round
  (later exit = higher place), tie-broken by wins → point diff → net Elo, shown
  as distinct numbers (4, 5, 6, 7…), never shared ranks.

### Tokens — already correct, reuse as-is

The target app already ships this exact palette and both fonts. No token work.

```
purple #4a2aa4   purple-bright #8663e9   coral #d74251
green  #2ba572   gold #f0c84b            ink   #17082b
Fonts: Outfit (700/800/900), DM Sans (400/600/700) — both already loaded
```

---

## 3. Mobile compositions (the main gap)

All three screens exist only at 1180 × 840 landscape. The app is used mostly on
phones. For each of `#6a-m`, `#5a-m`, `#4b-m` we need the full portrait type
ramp and reflow, not just a squeeze.

**`#5a-m`** — stack vertically. Decide and show: block order, whether the podium
shrinks or holds height, whether the standings card scrolls internally with a
pinned header or the page scrolls as one, and whether the champion block stays
full-bleed above the fold. State the breakpoint where two-column becomes stacked.

**`#6a-m`** — the desktop scoreline is avatar 60px — score 84px — avatar 60px,
under a 126px winner avatar and a 66px name. Show how that reflows in portrait
and whether the two Elo chips stack.

**`#4b-m`** — "BALLA DI CAPOT" is 88px, avatars 66px, score 76px. Portrait sizing
and reflow.

**Standings table on narrow screens.** The grid is `30px 1fr 52px 54px 52px 48px`
— about 270px of fixed columns before the name, which does not fit 402px.
**Default: keep `#`, `JOUEUR`, `V–D`, `Δ`; drop `DIFF` and `ELO`.** Draw that
unless you have a better cut.

---

## 4. Avatars — the biggest conflict

The handoff draws avatars as white circles with **two-letter** initials in purple
(LÉ, TH, CL). The target app's shipped avatar component works differently:

- it renders an **uploaded profile photo** when the player has one (a separate,
  already-approved feature), and falls back to initials only when there isn't one;
- the fallback is currently a **single** letter — **we're adopting the handoff's
  two-letter initials**, so this is settled, no need to argue it;
- the fallback is coloured **per team** — a tinted background with matching text —
  not a fixed white-on-purple.

**Decided:** photo when `avatar_url` exists, otherwise two-letter initials. We'll
change the app's avatar component to match.

Please show, in the mockups:

1. A **real photo** inside the winner treatment (126px circle, 4px gold border,
   glow pulse) — how it's masked and whether the border/glow changes.
2. A **real photo** in the 28px standings rows.
3. The **initials fallback** on these dark backgrounds — does it keep its team
   colour, or switch to the handoff's white/purple? Draw both a photo player and
   a fallback player in the same standings table so the mix is visible.
4. The **derivation rule for the two letters**, since player names are free text
   and most are a single first name. The handoff's own examples (LÉ = Léo,
   TH = Thibault) read as *first two letters of the name*. Confirm that, and say
   what happens for a two-word name ("Marie Claire" → `MA` or `MC`?), a
   hyphenated one ("Jean-Baptiste" → `JE` or `JB`?), and a single-character name.
   *(Default: first two letters of the first word; first letter of each word when
   there are two.)*

---

## 5. Round-robin variant (`#5a-rr`)

Round-robin is the app's **default** format, but only the double-elim version was
drawn. Needed:

- What replaces the gold `DOUBLE ÉLIM.` pill.
- Whether the podium still appears, or the table alone carries it. *(Default: keep
  the podium — consistency across formats.)*
- Whether the champion subline ("remporte le tournoi · 5 victoires, 0 défaite")
  differs from the double-elim one.
- **The footnote string for both formats.** The current spec says a footnote
  explains the ordering rule but never gives the copy. We need the literal
  French text for the round-robin rule (wins → point diff → net Elo) and for the
  double-elim rule (elimination round, then those tiebreaks).

---

## 6. States to draw

Please include these as variants or annotated states rather than prose:

- **Player count:** the table at **3**, **8**, and **16** players. At 16, decide
  scroll vs a "+N autres" collapse. At 3, show how the full-height card handles
  mostly-empty space.
- **Long names:** a player named e.g. "Jean-Baptiste" in both the 58–66px winner
  slot and the table's name column. Truncate, shrink, or wrap — pick one.
- **Provisional Elo:** some players have a provisional rating. We show the number
  regardless — show whether it gets a marker (asterisk / muted style) or nothing.
- **Exact tie:** two round-robin players on identical wins *and* point diff.
  Any visual indication, or just adjacent rows?

---

## 7. Smaller confirmations

- **Entrance:** the 220ms screen-level entrance is specced — do podium bars and
  table rows **stagger** in, or is it one block fade? *(Default: subtle stagger on
  rows, ~30ms apart.)*
- **Champion appears three times** on 5a — big avatar, podium 1st, and the
  gold-highlighted row 1. Confirm that's intended and not redundant.
- **Capot has two contexts** in the app: a standalone 1v1, and a match inside a
  tournament (where it's an interruption, not an endpoint). Should they look
  identical, or does the in-tournament one need a lighter treatment?
- **Action row:** with the design's buttons replaced by the app's own two, does
  the 5a action row need rebalancing?
