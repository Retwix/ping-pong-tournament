import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import SpectatorView from './SpectatorView'
import type { Match, Player, Tournament } from '../types'
import '../index.css'

const getMockTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  created_at: '2026-07-01T09:00:00.000Z',
  name: 'Tournoi de juillet',
  target: 11,
  players: ['Léo', 'Inès'],
  status: 'active',
  kind: 'tournament',
  format: 'round_robin',
  champion: null,
  is_active: true,
  slack_channel: null,
  slack_thread_ts: null,
  result_notified: false,
  unranked: false,
  doubles: false,
  teams: null,
  chaos_enabled: false,
  chaos_interval: 5,
  chaos_intensity: 'mild',
  chaos_legendary: false,
  ...overrides,
})

const getMockMatch = (overrides?: Partial<Match>): Match => ({
  id: 'm1',
  tournament_id: 't1',
  round: 1,
  idx: 0,
  player_a: 'Léo',
  player_b: 'Inès',
  player_a_id: 'p1',
  player_b_id: 'p2',
  score_a: 4,
  score_b: 3,
  done: false,
  serve_start: 'a',
  started_at: '2026-07-01T09:05:00.000Z',
  ended_at: null,
  bracket: null,
  match_key: null,
  win_to: null,
  win_slot: null,
  lose_to: null,
  lose_slot: null,
  bye: false,
  mb_saved_a: 0,
  mb_saved_b: 0,
  sets: [],
  ...overrides,
})

const getMockPlayer = (overrides?: Partial<Player>): Player => ({
  id: 'p1',
  created_at: '2026-07-01T09:00:00.000Z',
  name: 'Léo',
  team: 'tech',
  slack_user_id: null,
  auth_user_id: null,
  avatar_url: null,
  bio: null,
  status: 'active',
  left_at: null,
  ...overrides,
})

const renderBoard = (players: Player[]) => {
  const match = getMockMatch()
  return render(
    <SpectatorView
      tournament={getMockTournament()}
      matches={[match]}
      match={match}
      rows={[]}
      players={players}
      ratingsFor={() => ({ a: null, b: null })}
      onBack={() => {}}
    />,
  )
}

describe('SpectatorView live board', () => {
  it("shows each player's bio on their own side, without needing a rated match", async () => {
    const screen = await renderBoard([
      getMockPlayer({ id: 'p1', name: 'Léo', bio: 'Roi du revers' }),
      getMockPlayer({ id: 'p2', name: 'Inès', bio: 'Service canon' }),
    ])

    await expect
      .element(screen.getByRole('group', { name: 'Léo' }).getByText('Roi du revers'))
      .toBeVisible()
    await expect
      .element(screen.getByRole('group', { name: 'Inès' }).getByText('Service canon'))
      .toBeVisible()
  })
})
