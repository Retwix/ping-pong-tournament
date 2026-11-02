import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import GameResult from './GameResult'
import type { Match } from '../types'
import '../index.css'

const getMockMatch = (overrides?: Partial<Match>): Match => ({
  id: 'm1',
  tournament_id: 't1',
  round: 1,
  idx: 0,
  player_a: 'Léo',
  player_b: 'Inès',
  player_a_id: null,
  player_b_id: null,
  score_a: 11,
  score_b: 9,
  done: true,
  serve_start: 'a',
  started_at: null,
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

const renderResult = (match: Partial<Match>, bestOf: number) =>
  render(
    <GameResult
      match={getMockMatch(match)}
      bestOf={bestOf}
      onReplay={() => {}}
      onHome={() => {}}
      look={() => ({ team: null, url: null })}
    />,
  )

const rowText = (row: Element) => [...row.querySelectorAll('td')].map((td) => td.textContent).join(' ')

describe('GameResult for a match of sets', () => {
  it('shows every set as a scoreboard, the winner on top', async () => {
    const screen = await renderResult({ score_a: 11, score_b: 9, sets: [[11, 5], [8, 11]] }, 3)

    const [winner, loser] = screen.getByRole('row').elements()
    expect(winner.textContent).toMatch(/^Léo/)
    expect(rowText(winner)).toBe('11 8 11')
    expect(loser.textContent).toMatch(/^Inès/)
    expect(rowText(loser)).toBe('5 11 9')
  })

  it('a set lost 11-0 does not turn the result into a capot', async () => {
    const screen = await renderResult({ score_a: 11, score_b: 0, sets: [[11, 5]] }, 3)

    await expect.element(screen.getByText('Partie terminée')).toBeVisible()
  })

  it('a single game lost 11-0 is still a capot', async () => {
    const screen = await renderResult({ score_a: 11, score_b: 0 }, 1)

    await expect.element(screen.getByText('Balla di capot')).toBeVisible()
  })
})
