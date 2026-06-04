import { supabase } from './supabase'
import { generateSchedule } from './roundRobin'
import type { Match, Tournament } from '../types'

/** Create a tournament + its round-robin matches. Returns the new tournament id. */
export async function createTournament(
  name: string,
  players: string[],
  target: number
): Promise<string> {
  const { data: t, error } = await supabase
    .from('tournaments')
    .insert({ name, players, target, status: 'active' })
    .select()
    .single()
  if (error) throw error

  const rounds = generateSchedule(players)
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

/** Zero out all matches and reactivate the tournament. */
export async function resetTournament(id: string): Promise<void> {
  const { error: mErr } = await supabase
    .from('matches')
    .update({
      score_a: 0,
      score_b: 0,
      done: false,
      serve_start: 'a',
      started_at: null,
      ended_at: null,
    })
    .eq('tournament_id', id)
  if (mErr) throw mErr
  await updateTournament(id, { status: 'active', champion: null })
}
