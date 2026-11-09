import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import GameResult from './GameResult'
import type { Match } from '../types'
import type { SideRating } from '../hooks/useRatingDeltas'
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

const getMockSide = (overrides?: Partial<SideRating>): SideRating => ({
  key: 'Léo',
  name: 'Léo',
  delta: 8,
  ratingBefore: 1500,
  ratingAfter: 1508,
  won: true,
  stakes: 'normal',
  rank: null,
  provisional: false,
  ...overrides,
})

const renderResult = (match: Partial<Match>, bestOf: number, ratings?: { a: SideRating; b: SideRating }) =>
  render(
    <GameResult
      match={getMockMatch(match)}
      bestOf={bestOf}
      onReplay={() => {}}
      onHome={() => {}}
      ratings={ratings}
      look={() => ({ team: null, url: null })}
    />,
  )

const loserMove = (delta: number) =>
  renderResult({}, 1, {
    a: getMockSide(),
    b: getMockSide({ key: 'Inès', name: 'Inès', delta, ratingAfter: 1500 + delta, won: false }),
  })

const colourOf = (el: Element) => getComputedStyle(el).color

const readsRed = (colour: string) => {
  const [r, g, b] = (colour.match(/\d+/g) ?? []).map(Number)
  return r > g && r > b
}

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

describe('GameResult Elo moves', () => {
  it("colours the loser's move like the final table: red beyond −5, quiet within", async () => {
    const big = (await loserMove(-8)).getByText('−8').element()
    const bigColour = colourOf(big)
    const small = (await loserMove(-3)).getByText('−3').element()

    expect(readsRed(bigColour)).toBe(true)
    expect(readsRed(colourOf(small))).toBe(false)
    expect(colourOf(small)).not.toBe('rgb(255, 255, 255)')
  })
})
