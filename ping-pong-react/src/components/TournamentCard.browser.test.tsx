import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import TournamentCard from './TournamentCard'
import type { Tournament } from '../types'

const getMockSession = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  name: 'King of the Ping',
  players: ['Inès', 'Léo', 'Sam'],
  target: 7,
  status: 'done',
  champion: 'Inès',
  is_active: false,
  created_at: '2026-11-18T12:00:00.000Z',
  kind: 'king',
  format: 'round_robin',
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
  best_of: 1,
  ...overrides,
})

it('a finished King of the Ping session shows its recap and no head count', async () => {
  const screen = render(
    <TournamentCard
      tournament={getMockSession()}
      recap="Inès 👑 3 victoires d'affilée · 5 parties"
      onOpen={() => {}}
      onDelete={() => {}}
    />,
  )

  await expect.element(screen.getByText("Inès 👑 3 victoires d'affilée · 5 parties")).toBeVisible()
  await expect.element(screen.getByText(/^Session · jeu en 7/)).toBeVisible()
})
