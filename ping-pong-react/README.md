# 🏓 Ping-Pong Tournament — React + Supabase

The tournament tracker, rebuilt as a maintainable React app with a real database and
**live multi-device sync** — score on a phone and the TV scoreboard + standings update
instantly.

Same UX as the original single-file app: editable roster, round-robin generation,
configurable points, full-screen live scorer with serve indicator + keyboard shortcuts,
match clock, live standings, and a champion screen with confetti. UI is in French.

## Tech

- **Vite + React + TypeScript** — static build, no server to run.
- **Supabase** (Postgres + realtime) — data + live sync, talked to directly from the browser.

## 1. Install

```bash
cd ping-pong-react
npm install
```

## 2. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project (free tier is fine).
2. In the dashboard, open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**. This creates the
   `tournaments` and `matches` tables, enables realtime, and sets open access policies.
   To enable the **Pronostics** (betting) feature, run
   [`supabase/predictions-migration.sql`](./supabase/predictions-migration.sql) the same
   way — it adds the `predictions` table (no-currency streak model, no auth).
3. Open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

## 3. Add your keys

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

The anon key is safe to expose in the browser — that's its purpose. Access is governed by
the row-level-security policies in the schema.

## 4. Run

```bash
npm run dev
```

Open the printed URL. Create a tournament, then **Copier le lien** gives you a shareable URL
(`/#/t/<id>`). Open that same link on the TV and on phones — everyone sees scores update live.

## Slack notifications (optional)

Send a **private group invitation** when a tournament is created and post the **final
standings into that same thread** when the champion is crowned. The Slack bot token lives
in a Supabase Edge Function (never in the browser). Players are mapped to Slack ids in the
**Les joueurs** screen. Full walkthrough: [`supabase/SLACK_SETUP.md`](./supabase/SLACK_SETUP.md).
When `VITE_SLACK_ENABLED` is unset, the app never calls Slack.

## Build & deploy (Vercel)

```bash
npm run build      # type-checks then builds to dist/
npm run preview    # preview the production build locally
```

On Vercel:

1. Import the GitHub repo. If this app lives in a subfolder, set **Root Directory** to
   `ping-pong-react`.
2. Framework preset: **Vite** (build `npm run build`, output `dist`).
3. Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in
   **Project Settings → Environment Variables**.
4. Deploy.

## Project structure

```
ping-pong-react/
├─ index.html              # Vite entry (loads fonts)
├─ supabase/schema.sql     # run this in Supabase once
├─ src/
│  ├─ main.tsx             # React entry
│  ├─ App.tsx              # hash routing: home / new / board
│  ├─ index.css            # all styles (ported from the original)
│  ├─ types.ts
│  ├─ lib/
│  │  ├─ supabase.ts       # Supabase client
│  │  ├─ db.ts             # data access (create/list/update/reset)
│  │  ├─ roundRobin.ts     # schedule generation (circle method)
│  │  └─ pingpong.ts       # rules, serve, duration, standings
│  ├─ hooks/
│  │  ├─ useTournaments.ts # list, live
│  │  └─ useTournament.ts  # one tournament + matches, realtime + mutations
│  └─ components/
│     ├─ Home.tsx          # tournament list
│     ├─ Setup.tsx         # create tournament
│     ├─ Board.tsx         # matches + standings + overlays
│     ├─ MatchList.tsx
│     ├─ Standings.tsx
│     ├─ LiveScorer.tsx    # full-screen scorer (keyboard + chrono)
│     ├─ Champion.tsx
│     └─ Confetti.tsx
```

## Notes

- **Security:** the schema uses open RLS policies (anyone with the anon key can read/write),
  which suits a casual, unauthenticated office tool. If you ever need it private, add Supabase
  Auth and tighten the policies.
- **Undo** in the live scorer is per-session (a local stack), so it works on the device that's
  scoring; it doesn't try to reconcile undos across devices.
