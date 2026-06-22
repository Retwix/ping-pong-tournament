# 🏓 → 💬 Slack — fixed-channel quickstart

The fast path: every tournament invite + final result is posted to **one Slack
channel**. No per-player Slack IDs needed.

The app's code side is already done — `VITE_SLACK_ENABLED=true` is set in `.env`.
The four steps below are the ones only you can do (they need your Slack workspace
and Supabase project). Once they're finished, Slack works with no further code
changes.

---

## 1. Create the Slack app + bot token

1. Go to <https://api.slack.com/apps> → **Create New App** → **From scratch**.
2. Name it (e.g. *Ping-Pong Bot*), pick your workspace → **Create App**.
3. Left menu → **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**, add:
   - `chat:write` — post messages.
4. Scroll up → **Install to Workspace** → **Allow**.
5. Copy the **Bot User OAuth Token** (starts with `xoxb-`). This is your
   `SLACK_BOT_TOKEN`.

## 2. Pick the channel + invite the bot

1. In Slack, create or choose the channel for notifications (e.g. `#ping-pong`).
2. In that channel, type `/invite @Ping-Pong Bot` so the bot can post there.
3. Get the **channel ID** (starts with `C…`): click the channel name → bottom of
   the **About** tab shows *Channel ID*, or copy it from the channel link.
   This is your `SLACK_CHANNEL`.

## 3. Run the database migration

In Supabase → **SQL Editor** → **New query**, paste the contents of
`supabase/slack-migration.sql` and **Run**. (Adds the `slack_channel`,
`slack_thread_ts`, and `result_notified` columns the function writes to.)

## 4. Deploy the Edge Function + set secrets

Install the Supabase CLI if needed: <https://supabase.com/docs/guides/cli>.

```bash
cd ping-pong-react

# Link this folder to your project (one time). Ref is in your project URL:
# https://<ref>.supabase.co
supabase link --project-ref <your-project-ref>

# Secrets the function reads:
supabase secrets set SLACK_BOT_TOKEN=xoxb-your-token
supabase secrets set SLACK_CHANNEL=C0123ABCD          # the channel ID from step 2
supabase secrets set APP_BASE_URL=https://your-app.vercel.app   # for live-board links

# Deploy.
supabase functions deploy slack-notify
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — don't
set them.

---

## Test it

1. Redeploy / restart the app so it picks up `VITE_SLACK_ENABLED=true`
   (locally: `npm run dev`).
2. Create a tournament → the invite (schedule + board link) should appear in your
   channel within a second or two.
3. Finish it (crown a champion) → the final standings post as a threaded reply.

If nothing shows up, open the browser console: the app logs `[slack] invite
failed: <reason>` and keeps working regardless. Common causes: bot not invited to
the channel, wrong channel ID, or the function not deployed yet.

## Notes

- **No player Slack IDs required** in channel mode — names appear in bold. If you
  later want real `@mentions`, give players their Slack user ID and re-enable the
  `slack_user_id` writes in `src/lib/db.ts` (currently stripped). Not needed for
  channel posting.
- Slack is best-effort: if it's down or misconfigured, creating/scoring a
  tournament is never blocked.
