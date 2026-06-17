# 🏓 → 💬 Slack notifications — setup

This wires the tournament tracker to Slack:

- **Private group invitation** — when you create a tournament, everyone who has a
  Slack id gets a private group DM (or a channel post, your choice) announcing it,
  with the schedule and a live-scoreboard link.
- **Threaded results** — when the champion is crowned, the final standings are posted
  as a reply in that same invitation thread.

The Slack bot token is a secret, so the actual Slack calls run in a small Supabase
**Edge Function** (`slack-notify`). The browser never sees the token — it just asks
the function to "invite" or "post the result".

---

## 1. Create the Slack app

1. Go to <https://api.slack.com/apps> → **Create New App** → **From scratch**.
2. Name it (e.g. *Ping-Pong Bot*) and pick your workspace.
3. In the left menu → **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**, add:
   - `chat:write` — post messages
   - `mpim:write` — open a private group DM with the players
   - `im:write` — open direct messages
   - *(only if you'll post to a channel instead of a group DM)* `channels:read` and,
     for the bot to post in a public channel, invite it to that channel with `/invite @Ping-Pong Bot`.
4. Scroll up → **Install to Workspace** → **Allow**.
5. Copy the **Bot User OAuth Token** — it starts with `xoxb-`. This is your
   `SLACK_BOT_TOKEN`.

## 2. Get each player's Slack user id

A Slack user id looks like `U0123ABCD` (not the @handle).

- In Slack: click a person → **View full profile** → **⋯ More** → **Copy member ID**.
- Then in the app: **Les joueurs** → pencil icon on a player → paste the id → ✓.
  You can also set it when adding a new player.

Players without an id are simply skipped (and listed in the invitation so you can
ping them by hand).

## 3. Deploy the Edge Function

Install the Supabase CLI if you don't have it: <https://supabase.com/docs/guides/cli>.

```bash
cd ping-pong-react

# Link this folder to your Supabase project (one time).
# Find the ref in your project URL: https://<ref>.supabase.co
supabase link --project-ref <your-project-ref>

# Set the secrets the function needs.
supabase secrets set SLACK_BOT_TOKEN=xoxb-your-token
supabase secrets set APP_BASE_URL=https://your-app.vercel.app
# Optional: post the invitation to a channel instead of a private group DM.
# supabase secrets set SLACK_CHANNEL=C0123ABCD

# Deploy.
supabase functions deploy slack-notify
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — don't set them.

> The function keeps `verify_jwt` on (the default), so it only accepts calls carrying
> your project's anon key. The app's Supabase client sends that automatically.

## 4. Run the DB migration

If your database predates this feature, run **`supabase/slack-migration.sql`** in the
Supabase SQL editor (new databases get the columns from `schema.sql` already). It adds
`players.slack_user_id` and the `slack_channel` / `slack_thread_ts` / `result_notified`
columns on `tournaments`.

## 5. Turn it on in the app

In `.env` (and your Vercel env vars):

```
VITE_SLACK_ENABLED=true
```

Rebuild / redeploy. That's it.

---

## How it behaves

- **Create a tournament** → the app calls `slack-notify` with `invite`. It opens a private
  group DM with the participants (or posts to `SLACK_CHANNEL`), posts the schedule + board
  link, and stores the message so results can thread under it. Sending the invitation only
  happens once per tournament.
- **Champion crowned** → the app calls `slack-notify` with `result`. It posts the final
  standings as a threaded reply (broadcast to the conversation). A `result_notified` flag
  guards against duplicates if several devices finish the last point at once.

If Slack is down or misconfigured, the app logs a console warning and carries on — Slack
problems never block creating a tournament or scoring.

## Want individual 1:1 DMs instead of a group DM?

The default group DM is the cleanest fit for "private invite to everyone + one results
thread". If you'd rather each player get a separate 1:1 DM, that's a small change to the
`invite` handler in `functions/slack-notify/index.ts` (loop the user ids, `conversations.open`
per user) — note results can then only thread into one of them, so you'd pick a primary.
Ask and it can be wired up.
