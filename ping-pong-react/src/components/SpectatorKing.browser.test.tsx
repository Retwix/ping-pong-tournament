import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import SpectatorView from './SpectatorView'
import type { Match, Tournament } from '../types'
import '../index.css'

const getMockSession = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  created_at: '2026-11-18T12:00:00.000Z',
  name: 'King of the Ping',
  target: 7,
  players: ['Inès', 'Sam', 'Léo', 'Nora'],
  status: 'active',
  kind: 'king',
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

const getMockGame = (overrides?: Partial<Match>): Match => ({
  id: `m${overrides?.idx ?? 0}`,
  tournament_id: 't1',
  round: 1,
  idx: 0,
  player_a: 'Inès',
  player_b: 'Sam',
  player_a_id: null,
  player_b_id: null,
  score_a: 0,
  score_b: 0,
  done: false,
  serve_start: 'b',
  started_at: '2026-11-18T12:01:00.000Z',
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

const renderSession = (overrides: { rotation: ReadonlyArray<string>; matches: Match[] }) => {
  const game = overrides.matches[overrides.matches.length - 1]
  return render(
    <SpectatorView
      tournament={getMockSession({ players: [...overrides.rotation] })}
      matches={overrides.matches}
      match={game}
      rows={[]}
      players={[]}
      ratingsFor={() => ({ a: null, b: null })}
      onBack={() => {}}
    />,
  )
}

it('beside the game in progress, shows who holds the table and their règne, the session Record and the File in order', async () => {
  const screen = renderSession({
    rotation: ['Sam', 'Nora', 'Inès', 'Léo'],
    matches: [
      getMockGame({ idx: 0, player_a: 'Inès', player_b: 'Sam', score_a: 7, score_b: 3, done: true }),
      getMockGame({ idx: 1, player_a: 'Inès', player_b: 'Léo', score_a: 7, score_b: 5, done: true }),
      getMockGame({ idx: 2, player_a: 'Inès', player_b: 'Nora', score_a: 7, score_b: 2, done: true }),
      getMockGame({ idx: 3, player_a: 'Inès', player_b: 'Sam', score_a: 4, score_b: 7, done: true }),
      getMockGame({ idx: 4, player_a: 'Sam', player_b: 'Léo', score_a: 7, score_b: 6, done: true }),
      getMockGame({ idx: 5, player_a: 'Sam', player_b: 'Nora', score_a: 2, score_b: 1 }),
    ],
  })

  const king = screen.getByRole('region', { name: 'le King' })
  await expect.element(king).toHaveTextContent('Sam')
  expect(king.element().textContent).toContain('2 victoires')

  const record = screen.getByRole('region', { name: 'Record' })
  expect(record.element().textContent).toContain('Inès')
  expect(record.element().textContent).toContain('3 victoires')
  expect(
    screen
      .getByRole('list', { name: 'File' })
      .getByRole('listitem')
      .elements()
      .map((li) => li.textContent),
  ).toEqual(['Inès', 'Léo'])
})

it('on the first game of a session, shows the King with no règne yet and no Record', async () => {
  const screen = renderSession({
    rotation: ['Inès', 'Sam', 'Léo'],
    matches: [getMockGame({ idx: 0, player_a: 'Inès', player_b: 'Sam', score_a: 1, score_b: 0 })],
  })

  const king = screen.getByRole('region', { name: 'le King' })
  await expect.element(king).toHaveTextContent('Inès')
  expect(king.element().textContent).toContain('0 victoire')
  expect(screen.getByRole('region', { name: 'Record' }).query()).toBeNull()
})
