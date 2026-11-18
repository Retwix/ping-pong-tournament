import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { uniqueChannelName } from './realtimeChannel'
import type { Match, Tournament } from '../types'

interface MatchChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Match | Record<string, never>
  old: Partial<Match>
}

interface TournamentEvents {
  onMatch: (row: Match) => void
  onMatchGone: (id: string) => void
  onTournament: (row: Tournament) => void
  onSubscribed: () => void
}

/** Keeps one tournament and its matches live: every change another device makes is handed to `events`. */
export function watchTournament(id: string, events: TournamentEvents): RealtimeChannel {
  return supabase
    .channel(uniqueChannelName(`tournament-${id}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${id}` },
      (payload) => {
        const p = payload as unknown as MatchChangePayload
        if (p.eventType !== 'DELETE') events.onMatch(p.new as Match)
      },
    )
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'matches' }, (payload) => {
      const p = payload as unknown as MatchChangePayload
      if (p.old.id) events.onMatchGone(p.old.id)
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` },
      (payload) => {
        if (payload.eventType === 'DELETE') return
        events.onTournament(payload.new as Tournament)
      },
    )
    .subscribe((status) => {
      // On (re)subscribe, refetch to catch anything that changed while the
      // socket was down (mobile backgrounding, wifi roam, projector sleep).
      if (status === 'SUBSCRIBED') events.onSubscribed()
    })
}
