# 🏓 Ping-Pong Tournament

A single-file web app to run and live-score a casual ping-pong tournament. No build step, no server, no dependencies beyond Google Fonts — just open `index.html`.

**Live demo:** _(add your Vercel URL here once deployed)_

## Features

- **Configurable roster** — add, remove, and rename players (2–16). The schedule regenerates automatically.
- **Round-robin generator** — everyone plays everyone, using the circle method. Odd player counts get a per-round bye ("exempt").
- **Dynamic scoring** — game to 11, 15, 21, or any custom target, win by 2.
- **Live scorer** — full-screen scoreboard; tap a player's half (or use the keyboard) to add points. Serve indicator alternates every 2 points and switches to every point at deuce.
- **Keyboard shortcuts** — `←` / `→` add a point to the left / right player, `Z` or `Backspace` to undo, `Enter` to validate, `Échap` to close.
- **Live standings** — ranked by wins, then point differential, with gold/silver/bronze medallions.
- **Champion screen** — confetti celebration and a top-3 podium when the last match is validated.
- **Auto-save** — config and scores persist in `localStorage`, so a refresh picks up right where you left off.

## Tech

Vanilla HTML, CSS, and JavaScript in one file. No framework, no bundler. UI is in French.

## Run locally

Open `index.html` in any modern browser. That's it.

## Deploy

Static site — deploys to Vercel (or any static host) with zero configuration. Vercel auto-detects `index.html` at the repo root.


---

_Deployed on Vercel with automatic deploys from `main`._
