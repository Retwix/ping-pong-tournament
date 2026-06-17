-- ============================================================
-- Slack integration — migration for EXISTING databases
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
-- (New databases get these columns from schema.sql automatically.)
-- ============================================================

-- Map each player to a Slack user id (e.g. U0123ABCD). Null = not on Slack;
-- those players are simply skipped when sending invitations.
alter table public.players
  add column if not exists slack_user_id text;

-- Where the invitation was posted (a private group DM or a channel) and the
-- ts of that message, so final results can be posted as a threaded reply.
alter table public.tournaments
  add column if not exists slack_channel   text;
alter table public.tournaments
  add column if not exists slack_thread_ts text;

-- Guard so the result message is posted exactly once even though every
-- connected device reactively notices the tournament finishing.
alter table public.tournaments
  add column if not exists result_notified boolean not null default false;
