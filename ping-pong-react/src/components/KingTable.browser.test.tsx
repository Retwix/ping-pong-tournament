import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import KingTable from './KingTable'
import type { Rotation } from '../lib/king'
import type { Match } from '../types'
import '../index.css'

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
  ...overrides,
})

const renderKingTable = (overrides: { rotation: Rotation; matches: ReadonlyArray<Match>; ended?: boolean }) => {
  const patches: Array<{ id: string; patch: Partial<Match> }> = []
  const rotations: Rotation[] = []
  const started: string[] = []
  const ended: Array<string | null> = []
  const closed: string[] = []
  const screen = render(
    <KingTable
      ended={false}
      {...overrides}
      look={() => ({ team: null, url: null })}
      onPatch={(id, patch) => patches.push({ id, patch })}
      onRotation={(rotation) => rotations.push(rotation)}
      onNext={() => started.push('next')}
      onEnd={(champion) => ended.push(champion)}
      onClose={() => closed.push('close')}
      scorer={(match, onPatch) => (
        <section aria-label="scorer">
          {match.player_a} v {match.player_b}
          <button onClick={() => onPatch({ score_b: match.score_b + 1 })}>Point</button>
          <button onClick={() => onPatch({ done: true })}>Valider</button>
        </section>
      )}
    />,
  )
  return { screen, patches, rotations, started, ended, closed }
}

it('scores the game at the table, and on validation the winner holds it while the loser joins the back of the File', async () => {
  const { screen, patches, rotations } = renderKingTable({
    rotation: ['Inès', 'Léo', 'Sam'],
    matches: [
      getMockGame({ idx: 0, player_a: 'Inès', player_b: 'Sam', score_a: 7, score_b: 4, done: true }),
      getMockGame({ idx: 1, player_a: 'Inès', player_b: 'Léo', score_a: 4, score_b: 6 }),
    ],
  })

  await expect.element(screen.getByRole('region', { name: 'scorer' })).toHaveTextContent('Inès v Léo')
  await screen.getByRole('button', { name: 'Point' }).click()
  expect(rotations).toEqual([])

  await screen.getByRole('button', { name: 'Valider' }).click()
  expect(patches).toEqual([
    { id: 'm1', patch: { score_b: 7 } },
    { id: 'm1', patch: { done: true } },
  ])
  expect(rotations).toEqual([['Léo', 'Sam', 'Inès']])
})

it('calls up « Au suivant » once the last game is done, one tap starting the next', async () => {
  const { screen, started } = renderKingTable({
    rotation: ['Inès', 'Léo', 'Sam'],
    matches: [getMockGame({ idx: 0, score_a: 7, score_b: 4, done: true })],
  })

  await expect.element(screen.getByRole('region', { name: 'le King' })).toHaveTextContent('Inès')
  await screen.getByRole('button', { name: 'Lancer la partie' }).click()
  expect(started).toEqual(['next'])
})

it('« Terminer » ends the session, crowning the longest reign, a tie going to whoever reached it first', async () => {
  const { screen, ended } = renderKingTable({
    rotation: ['Léo', 'Inès', 'Sam'],
    matches: [
      getMockGame({ idx: 0, player_a: 'Inès', player_b: 'Sam', score_a: 7, score_b: 4, done: true }),
      getMockGame({ idx: 1, player_a: 'Inès', player_b: 'Léo', score_a: 7, score_b: 5, done: true }),
      getMockGame({ idx: 2, player_a: 'Inès', player_b: 'Léo', score_a: 3, score_b: 7, done: true }),
      getMockGame({ idx: 3, player_a: 'Léo', player_b: 'Sam', score_a: 7, score_b: 2, done: true }),
    ],
  })

  await screen.getByRole('button', { name: 'Terminer' }).click()
  expect(ended).toEqual(['Inès'])
})

it('once the session has ended, crowns the longest reign with its wins in a row and the games played, then leaves', async () => {
  const { screen, closed } = renderKingTable({
    ended: true,
    rotation: ['Sam', 'Inès', 'Léo'],
    matches: [
      getMockGame({ idx: 0, player_a: 'Inès', player_b: 'Sam', score_a: 7, score_b: 4, done: true }),
      getMockGame({ idx: 1, player_a: 'Inès', player_b: 'Léo', score_a: 7, score_b: 5, done: true }),
      getMockGame({ idx: 2, player_a: 'Inès', player_b: 'Léo', score_a: 3, score_b: 7, done: true }),
      getMockGame({ idx: 3, player_a: 'Léo', player_b: 'Sam', score_a: 7, score_b: 2, done: true }),
      getMockGame({ idx: 4, player_a: 'Léo', player_b: 'Sam', score_a: 1, score_b: 7, done: true }),
    ],
  })

  const crown = screen.getByRole('region', { name: 'le champion' })
  await expect.element(crown).toHaveTextContent('Inès')
  expect(crown.element().textContent).toContain('2 victoires')
  expect(crown.element().textContent).toContain('5 parties')

  await screen.getByRole('button', { name: 'Accueil' }).click()
  expect(closed).toEqual(['close'])
})
