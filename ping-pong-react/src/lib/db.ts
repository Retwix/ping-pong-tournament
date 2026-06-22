import { supabase } from './supabase'
import { generateSchedule, shuffle } from './roundRobin'
import { buildDoubleElim } from './doubleElim'
import type { Match, Player, Tournament, TournamentKind, TournamentFormat } from '../types'

// ---------- players registry ----------

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Player[]
}

export async function createPlayer(
  name: string,
  team: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _slackUserId?: string | null
): Promise<Player> {
  // NOTE: the `slack_user_id` column isn't in the DB schema yet, so we don't
  // write it. Re-add it here (and below) once the column exists in Supabase.
  const { data, error } = await supabase
    .from('players')
    .insert({ name, team })
    .select()
    .single()
  if (error) throw error
  return data as Player
}

/** Update a player's name and/or team. */
export async function updatePlayer(
  id: string,
  patch: { name?: string; team?: string; slack_user_id?: string | null }
): Promise<void> {
  // Strip slack_user_id until the column exists in the DB schema.
  const { slack_user_id: _ignored, ...dbPatch } = patch
  const { error } = await supabase.from('players').update(dbPatch).eq('id', id)
  if (error) throw error
}

/**
 * Remove a player from the registry. Past tournaments/matches keep their recorded
 * names (they store text, not a reference), so history is unaffected.
 */
export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}

/** A blank match row, before the matchup-specific fields are filled in. */
function blankMatch(tournamentId: string): Omit<Match, 'id' | 'round' | 'idx' | 'player_a' | 'player_b'> {
  return {
    tournament_id: tournamentId,
    player_a_id: null,
    player_b_id: null,
    score_a: 0,
    score_b: 0,
    done: false,
    serve_start: 'a',
    started_at: null,
    ended_at: null,
    mb_saved_a: 0,
    mb_saved_b: 0,
    bracket: null,
    match_key: null,
    win_to: null,
    win_slot: null,
    lose_to: null,
    lose_slot: null,
    bye: false,
  }
}

/**
 * Create a tournament (or a single game) + its matches. A `game` is a single
 * round-robin match. Tournaments are either round-robin (everyone plays everyone)
 * or a double-elimination bracket, per `format`. Returns the new id.
 */
export async function createTournament(
  name: string,
  players: string[],
  target: number,
  kind: TournamentKind = 'tournament',
  format: TournamentFormat = 'round_robin'
): Promise<string> {
  // Games are always a single round-robin match regardless of the chosen format.
  const effectiveFormat: TournamentFormat = kind === 'game' ? 'round_robin' : format

  // Resolve names -> player ids so matches carry a stable identity (rename-proof
  // stats). Unknown names (e.g. since-removed players) keep a null id.
  const { data: reg } = await supabase.from('players').select('id, name')
  const idByName = new Map<string, string>((reg ?? []).map((p) => [p.name, p.id]))

  // Hand the "current" pointer to the new tournament: clear it everywhere first so
  // the partial unique index (at most one active) is never violated on insert.
  const { error: clearErr } = await supabase
    .from('tournaments')
    .update({ is_active: false })
    .eq('is_active', true)
  if (clearErr) throw clearErr

  // Players are persisted in the order they'll be displayed/seeded; the bracket
  // builder shuffles internally, so keep the given order for round-robin.
  const ordered = effectiveFormat === 'double_elim' ? players.slice() : shuffle(players)

  const { data: t, error } = await supabase
    .from('tournaments')
    .insert({
      name,
      players: ordered,
      target,
      status: 'active',
      kind,
      format: effectiveFormat,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error

  const base = blankMatch(t.id)
  const rows: Omit<Match, 'id'>[] = []

  if (effectiveFormat === 'double_elim') {
    for (const r of buildDoubleElim(ordered)) {
      rows.push({
        ...base,
        round: r.round,
        idx: r.idx,
        player_a: r.player_a,
        player_b: r.player_b,
        player_a_id: idByName.get(r.player_a) ?? null,
        player_b_id: idByName.get(r.player_b) ?? null,
        bracket: r.bracket,
        match_key: r.match_key,
        win_to: r.win_to,
        win_slot: r.win_slot,
        lose_to: r.lose_to,
        lose_slot: r.lose_slot,
      })
    }
  } else {
    let idx = 0
    generateSchedule(ordered).forEach((rd, ri) => {
      rd.pairs.forEach(([a, b]) => {
        rows.push({
          ...base,
          round: ri + 1,
          idx: idx++,
          player_a: a,
          player_b: b,
          player_a_id: idByName.get(a) ?? null,
          player_b_id: idByName.get(b) ?? null,
        })
      })
    })
  }

  if (rows.length) {
    const { error: mErr } = await supabase.from('matches').insert(rows)
    if (mErr) throw mErr
  }
  return t.id as string
}

export async function listTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Tournament[]
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Tournament) ?? null
}

/**
 * The tournament/game currently on the table (is_active = true), or null if none.
 * Backs the stable /live and /ref views. `limit(1)` keeps it safe even if the
 * one-active invariant is ever broken.
 */
export async function getActiveTournament(): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as Tournament) ?? null
}

/** Every finished match across all tournaments and games (for stats). */
export async function listAllDoneMatches(): Promise<Match[]> {
  const { data, error } = await supabase.from('matches').select('*').eq('done', true)
  if (error) throw error
  // Exclude double-elimination walkovers (auto-completed BYE matches): they are
  // not real games and would skew per-player stats.
  return ((data ?? []) as Match[]).filter((m) => !m.bye)
}

export async function getMatches(tournamentId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('idx', { ascending: true })
  if (error) throw error
  return (data ?? []) as Match[]
}

export async function updateMatch(id: string, patch: Partial<Match>): Promise<void> {
  const { error } = await supabase.from('matches').update(patch).eq('id', id)
  if (error) throw error
}

export async function updateTournament(id: string, patch: Partial<Tournament>): Promise<void> {
  const { error } = await supabase.from('tournaments').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTournament(id: string): Promise<void> {
  const { error } = await supabase.from('tournaments').delete().eq('id', id)
  if (error) throw error
}
