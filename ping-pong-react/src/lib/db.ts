import { supabase } from './supabase'
import { generateSchedule, shuffle } from './roundRobin'
import type { Match, Player, Tournament, TournamentKind } from '../types'

// ---------- players registry ----------

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Player[]
}

export async function createPlayer(name: string, team: string): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert({ name, team })
    .select()
    .single()
  if (error) throw error
  return data as Player
}

/**
 * Remove a player from the registry. Past tournaments/matches keep their recorded
 * names (they store text, not a reference), so history is unaffected.
 */
export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}

/**
 * Create a tournament (or a single game) + its round-robin matches.
 * A `game` is simply a 2-player round-robin, i.e. one match. Returns the new id.
 */
export async function createTournament(
  name: string,
  players: string[],
  target: number,
  kind: TournamentKind = 'tournament'
): Promise<string> {
  // Shuffle the running order so the same roster produces a different bracket
  // (which matchups land early, who gets byes, left/right side) each time.
  const ordered = shuffle(players)

  // Resolve names -> player ids so matches carry a stable identity (rename-proof
  // stats). Unknown names (e.g. since-removed players) keep a null id.
  const { data: reg } = await supabase.from('players').select('id, name')
  const idByName = new Map<string, string>((reg ?? []).map((p) => [p.name, p.id]))

  const { data: t, error } = await supabase
    .from('tournaments')
    .insert({ name, players: ordered, target, status: 'active', kind })
    .select()
    .single()
  if (error) throw error

  const rounds = generateSchedule(ordered)
  const rows: Omit<Match, 'id'>[] = []
  let idx = 0
  rounds.forEach((rd, ri) => {
    rd.pairs.forEach(([a, b]) => {
      rows.push({
        tournament_id: t.id,
        round: ri + 1,
        idx: idx++,
        player_a: a,
        player_b: b,
        player_a_id: idByName.get(a) ?? null,
        player_b_id: idByName.get(b) ?? null,
        score_a: 0,
        score_b: 0,
        done: false,
        serve_start: 'a',
        started_at: null,
        ended_at: null,
      })
    })
  })
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

/** Every finished match across all tournaments and games (for stats). */
export async function listAllDoneMatches(): Promise<Match[]> {
  const { data, error } = await supabase.from('matches').select('*').eq('done', true)
  if (error) throw error
  return (data ?? []) as Match[]
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
