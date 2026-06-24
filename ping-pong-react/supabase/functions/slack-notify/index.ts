// ============================================================
// slack-notify — Supabase Edge Function (Deno)
//
// Sends ping-pong tournament notifications to Slack. The Slack bot token is a
// secret, so it lives here (server-side) and never touches the browser bundle.
//
// Two actions (POST JSON body):
//   { "action": "invite",  "tournamentId": "<uuid>" }
//     -> opens a private group DM with all participants who have a Slack id
//        (or posts to SLACK_CHANNEL if set), posts the invitation, and stores
//        the conversation + message ts on the tournament so results can thread.
//
//   { "action": "result",  "tournamentId": "<uuid>" }
//     -> posts the final standings as a threaded reply under the invitation.
//        Guarded so it fires exactly once even if several devices trigger it.
//
// Required secrets (supabase secrets set ...):
//   SLACK_BOT_TOKEN   xoxb-...           Slack bot token
//   APP_BASE_URL      https://...        public URL of the app (for board links)
// Optional:
//   SLACK_CHANNEL     C0123ABCD          post the invitation to this channel
//                                        instead of a private group DM
//   SLACK_NOTIFY_ENABLED  true|false     kill switch (default: true). Set to
//                                        "false" to pause: the function then
//                                        no-ops (returns { skipped: "disabled" })
//                                        without touching Slack. Set back to
//                                        "true" (or unset) to resume.
// Provided automatically by the Edge runtime:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Kill switch. Defaults to enabled so existing setups keep working; set the
// SLACK_NOTIFY_ENABLED secret to "false" to pause all notifications.
const SLACK_NOTIFY_ENABLED =
  (Deno.env.get("SLACK_NOTIFY_ENABLED") ?? "true").toLowerCase() !== "false";
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN") ?? "";
const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") ?? "").replace(/\/+$/, "");
const SLACK_CHANNEL = Deno.env.get("SLACK_CHANNEL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------- types (mirrors of the app's DB rows we need here) ----------
interface Tournament {
  id: string;
  name: string;
  target: number;
  players: string[];
  kind: string;
  champion: string | null;
  slack_channel: string | null;
  slack_thread_ts: string | null;
  result_notified: boolean;
}
interface Match {
  round: number;
  idx: number;
  player_a: string;
  player_b: string;
  score_a: number;
  score_b: number;
  done: boolean;
}
interface StandingRow {
  name: string;
  played: number;
  wins: number;
  diff: number;
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// ---------- Slack Web API helper ----------
async function slack(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack ${method} failed: ${json.error}`);
  return json;
}

// ---------- standings (ported from src/lib/pingpong.ts) ----------
function computeStandings(players: string[], matches: Match[]): StandingRow[] {
  const stats: Record<string, { wins: number; pf: number; pa: number; played: number }> = {};
  for (const p of players) stats[p] = { wins: 0, pf: 0, pa: 0, played: 0 };
  for (const m of matches) {
    if (!m.done || !stats[m.player_a] || !stats[m.player_b]) continue;
    stats[m.player_a].played++;
    stats[m.player_b].played++;
    stats[m.player_a].pf += m.score_a;
    stats[m.player_a].pa += m.score_b;
    stats[m.player_b].pf += m.score_b;
    stats[m.player_b].pa += m.score_a;
    if (m.score_a > m.score_b) stats[m.player_a].wins++;
    else stats[m.player_b].wins++;
  }
  return Object.entries(stats)
    .map(([name, s]) => ({ name, played: s.played, wins: s.wins, diff: s.pf - s.pa }))
    .sort((x, y) => (y.wins !== x.wins ? y.wins - x.wins : y.diff - x.diff));
}

// ---------- player name -> slack id map for a tournament ----------
async function slackIdsFor(names: string[]): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from("players")
    .select("name, slack_user_id")
    .in("name", names);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const p of data ?? []) {
    if (p.slack_user_id) map.set(p.name, p.slack_user_id as string);
  }
  return map;
}

function mention(name: string, ids: Map<string, string>): string {
  const id = ids.get(name);
  return id ? `<@${id}>` : `*${name}*`;
}

// Always link to the stable live-score view, which follows whichever tournament
// is currently on the table (no per-tournament id in the URL).
function boardLink(_id: string): string {
  return APP_BASE_URL ? `${APP_BASE_URL}/live` : "";
}

// ============================================================
// Flavour: capot shaming + a "fun fact" line for result posts.
// ============================================================

/** A finished match where the loser scored 0 — a "capot" / sous la table. */
function isCapot(m: Match): boolean {
  return Math.min(m.score_a, m.score_b) === 0 && Math.max(m.score_a, m.score_b) > 0;
}

/** Minimal shape we need from history to read win/loss streaks. */
interface HistMatch {
  player_a: string;
  player_b: string;
  score_a: number;
  score_b: number;
  ended_at: string | null;
  started_at: string | null;
}

function histTime(m: HistMatch): string {
  return m.ended_at ?? m.started_at ?? "";
}

/**
 * The player's current run of identical results (the most recent matches),
 * across all tournaments. e.g. { type: "L", count: 3 } = three losses in a row.
 */
function trailingStreak(
  name: string,
  all: HistMatch[],
): { type: "W" | "L" | null; count: number } {
  const mine = all
    .filter((m) => m.player_a === name || m.player_b === name)
    .sort((a, b) => histTime(a).localeCompare(histTime(b)));
  let type: "W" | "L" | null = null;
  let count = 0;
  for (let i = mine.length - 1; i >= 0; i--) {
    const m = mine[i];
    const meA = m.player_a === name;
    const won = (meA ? m.score_a : m.score_b) > (meA ? m.score_b : m.score_a);
    const r: "W" | "L" = won ? "W" : "L";
    if (type === null) {
      type = r;
      count = 1;
    } else if (r === type) {
      count++;
    } else break;
  }
  return { type, count };
}

const ORDINAL_F = ["", "1re", "2e", "3e", "4e", "5e", "6e", "7e", "8e", "9e", "10e"];
function ordinalF(n: number): string {
  return ORDINAL_F[n] ?? `${n}e`;
}

// Light, ping-pong-flavoured filler when there's no juicier stat to surface.
const TAUNTS = [
  "Les raquettes ont parlé. 🏓",
  "La revanche se joue à la machine à café. ☕",
  "Le filet, lui, n'a rien demandé.",
  "Quelqu'un veut une revanche ? 👀",
  "Statistiquement mérité. Probablement.",
  "On range la table, la légende est écrite. 📜",
];
function randomTaunt(): string {
  return TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
}

/**
 * One flavour line for the result post. Prefers a real stat (loser on a losing
 * streak, winner on a hot streak), else falls back to a random taunt.
 */
function funFactLine(
  winner: string,
  loser: string,
  history: HistMatch[],
): string {
  const loserStreak = trailingStreak(loser, history);
  if (loserStreak.type === "L" && loserStreak.count >= 2) {
    return `📉 ${loser} en est à sa ${ordinalF(loserStreak.count)} défaite d'affilée. Courage.`;
  }
  const winnerStreak = trailingStreak(winner, history);
  if (winnerStreak.type === "W" && winnerStreak.count >= 3) {
    return `🔥 ${winner} enchaîne : ${winnerStreak.count} victoires d'affilée.`;
  }
  return randomTaunt();
}

// ---------- action: invite ----------
async function handleInvite(tournamentId: string) {
  const { data: t, error } = await admin
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single();
  if (error) throw error;
  const tour = t as Tournament;

  // Idempotent: if we already invited (thread exists), do nothing.
  if (tour.slack_thread_ts) return { skipped: "already_invited" };

  const ids = await slackIdsFor(tour.players);

  // Pick the conversation: explicit channel, else a private group DM of players.
  let channel = SLACK_CHANNEL;
  if (!channel) {
    const userIds = tour.players.map((n) => ids.get(n)).filter(Boolean) as string[];
    if (userIds.length === 0) return { skipped: "no_slack_users" };
    const open = await slack("conversations.open", { users: userIds.join(",") });
    channel = open.channel.id as string;
  }

  const { data: ms } = await admin
    .from("matches")
    .select("round, idx, player_a, player_b, score_a, score_b, done")
    .eq("tournament_id", tournamentId)
    .order("idx", { ascending: true });
  const matches = (ms ?? []) as Match[];

  // Group matchups by round for a readable schedule.
  const byRound = new Map<number, Match[]>();
  for (const m of matches) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  }
  const isGame = tour.kind === "game";
  const scheduleLines: string[] = [];
  for (const [round, list] of [...byRound.entries()].sort((a, b) => a[0] - b[0])) {
    const pairs = list
      .map((m) => `${mention(m.player_a, ids)} vs ${mention(m.player_b, ids)}`)
      .join(" · ");
    scheduleLines.push(isGame ? pairs : `*Tour ${round}* — ${pairs}`);
  }

  const link = boardLink(tournamentId);
  const playerLine = tour.players.map((n) => mention(n, ids)).join(", ");
  const missing = tour.players.filter((n) => !ids.has(n));

  const header = isGame
    ? `🏓 *Défi ping-pong : ${tour.name}*`
    : `🏓 *Nouveau tournoi : ${tour.name}*`;
  const lines = [
    header,
    "",
    `Vous êtes convoqué·e ! ${playerLine}`,
    `Format : premier à *${tour.target}* points (2 d'écart).`,
    "",
    ...scheduleLines,
  ];
  if (link) lines.push("", `:point_right: Tableau de score en direct : ${link}`);
  // The "without Slack" hint only makes sense when inviting via a private group DM,
  // where missing ids mean those people don't get pinged. In fixed-channel mode
  // (SLACK_CHANNEL set) nobody is mentioned individually, so listing everyone here
  // is just noise — skip it.
  if (!SLACK_CHANNEL && missing.length) {
    lines.push("", `_Sans Slack (à inviter à la main) : ${missing.join(", ")}_`);
  }

  const post = await slack("chat.postMessage", {
    channel,
    text: lines.join("\n"),
    unfurl_links: false,
  });

  await admin
    .from("tournaments")
    .update({ slack_channel: channel, slack_thread_ts: post.ts })
    .eq("id", tournamentId);

  return { ok: true, channel, ts: post.ts };
}

// ---------- action: result ----------
async function handleResult(tournamentId: string) {
  const { data: t, error } = await admin
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single();
  if (error) throw error;
  const tour = t as Tournament;

  if (!tour.slack_channel || !tour.slack_thread_ts) {
    return { skipped: "no_invitation_thread" };
  }

  // Atomic-ish guard: flip result_notified false -> true and only proceed if
  // this call is the one that flipped it. Stops duplicate posts from several
  // devices all reacting to the tournament finishing.
  const { data: claimed } = await admin
    .from("tournaments")
    .update({ result_notified: true })
    .eq("id", tournamentId)
    .eq("result_notified", false)
    .select("id");
  if (!claimed || claimed.length === 0) return { skipped: "already_posted" };

  const { data: ms } = await admin
    .from("matches")
    .select("round, idx, player_a, player_b, score_a, score_b, done")
    .eq("tournament_id", tournamentId);
  const matches = (ms ?? []) as Match[];

  const ids = await slackIdsFor(tour.players);
  const standings = computeStandings(tour.players, matches);
  const champ = tour.champion ?? standings[0]?.name ?? null;
  const medals = ["🥇", "🥈", "🥉"];

  // All finished matches across every tournament, for win/loss-streak facts.
  const { data: allMs } = await admin
    .from("matches")
    .select("player_a, player_b, score_a, score_b, ended_at, started_at")
    .eq("done", true);
  const history = (allMs ?? []) as HistMatch[];

  const isGame = tour.kind === "game";
  const lines: string[] = [];
  if (isGame) {
    const m = matches.find((x) => x.done);
    lines.push(`🏁 *Résultat — ${tour.name}*`);
    if (m) {
      const aWin = m.score_a > m.score_b;
      const winner = aWin ? m.player_a : m.player_b;
      const loser = aWin ? m.player_b : m.player_a;
      const sa = Math.max(m.score_a, m.score_b);
      const sb = Math.min(m.score_a, m.score_b);
      if (isCapot(m)) {
        lines.push(
          "",
          `🪑 *Capot !* ${mention(loser, ids)} passe sous la table, la méga honte.`,
          `${mention(winner, ids)} s'impose *${sa}–${sb}* sans pitié 🫣`,
        );
      } else {
        lines.push("", `${mention(winner, ids)} l'emporte *${sa}–${sb}* 🏆`);
      }
      lines.push("", funFactLine(winner, loser, history));
    }
  } else {
    lines.push(`🏆 *${tour.name} terminé !*`);
    if (champ) lines.push("", `Champion : ${mention(champ, ids)} 🎉`);
    lines.push("", "*Classement final*");
    standings.forEach((s, i) => {
      const medal = medals[i] ?? `${i + 1}.`;
      const diff = s.diff > 0 ? `+${s.diff}` : `${s.diff}`;
      lines.push(`${medal} ${s.name} — ${s.wins} V · diff ${diff}`);
    });

    // Name and shame: every capot inflicted during the tournament.
    const capots = matches.filter((m) => m.done && isCapot(m));
    if (capots.length) {
      lines.push("", "*Sous la table* 🪑");
      for (const m of capots) {
        const aWin = m.score_a > m.score_b;
        const w = aWin ? m.player_a : m.player_b;
        const l = aWin ? m.player_b : m.player_a;
        const hi = Math.max(m.score_a, m.score_b);
        lines.push(`${mention(w, ids)} colle un capot à ${mention(l, ids)} (${hi}–0)`);
      }
    }

    // One flavour line — champion's hot streak if any, else a taunt.
    if (champ) {
      const cs = trailingStreak(champ, history);
      lines.push(
        "",
        cs.type === "W" && cs.count >= 2
          ? `🔥 ${champ} reste sur ${cs.count} victoires d'affilée.`
          : randomTaunt(),
      );
    }
  }

  await slack("chat.postMessage", {
    channel: tour.slack_channel,
    thread_ts: tour.slack_thread_ts,
    // Keep the result inside the thread only — no broadcast back to the channel.
    reply_broadcast: false,
    text: lines.join("\n"),
    unfurl_links: false,
  });

  return { ok: true };
}

// ---------- HTTP entry ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Paused via the kill switch: no-op cleanly (200) so callers treat it as a
  // successful skip rather than an error.
  if (!SLACK_NOTIFY_ENABLED) {
    return new Response(JSON.stringify({ skipped: "disabled" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    if (!SLACK_BOT_TOKEN) throw new Error("SLACK_BOT_TOKEN is not set");
    const { action, tournamentId } = await req.json();
    if (!tournamentId) throw new Error("tournamentId is required");

    let result: unknown;
    if (action === "invite") result = await handleInvite(tournamentId);
    else if (action === "result") result = await handleResult(tournamentId);
    else throw new Error(`unknown action: ${action}`);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
