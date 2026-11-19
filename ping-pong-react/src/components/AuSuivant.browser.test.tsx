import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import AuSuivant from './AuSuivant'
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
  score_a: 7,
  score_b: 4,
  done: true,
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

it('calls up the King, their règne, Prochain and the File, and starts the next game on one tap', async () => {
  const started: string[] = []
  const screen = render(
    <AuSuivant
      rotation={['Inès', 'Zoé', 'Sam', 'Léo']}
      players={[]}
      matches={[
        getMockGame({ idx: 0, player_a: 'Inès', player_b: 'Sam' }),
        getMockGame({ idx: 1, player_a: 'Inès', player_b: 'Léo' }),
      ]}
      look={() => ({ team: null, url: null })}
      onNext={() => started.push('next')}
      onEnd={() => {}}
      onRotation={() => {}}
    />,
  )

  await expect.element(screen.getByRole('region', { name: 'le King' })).toHaveTextContent('Inès')
  expect(screen.getByRole('region', { name: 'le King' }).element().textContent).toContain(
    '2 victoires',
  )
  expect(screen.getByRole('region', { name: 'Prochain' }).element().textContent).toContain('Zoé')
  expect(
    screen
      .getByRole('list', { name: 'File' })
      .getByRole('listitem')
      .elements()
      .map((li) => li.textContent),
  ).toEqual([expect.stringContaining('Sam'), expect.stringContaining('Léo')])

  await screen.getByRole('button', { name: 'Lancer la partie' }).click()
  expect(started).toEqual(['next'])
})

it('lets someone waiting in the File step out, leaving the table as it is', async () => {
  const rotations: string[][] = []
  const screen = render(
    <AuSuivant
      rotation={['Inès', 'Zoé', 'Sam', 'Léo']}
      players={[]}
      matches={[getMockGame()]}
      look={() => ({ team: null, url: null })}
      onNext={() => {}}
      onEnd={() => {}}
      onRotation={(rotation) => rotations.push([...rotation])}
    />,
  )

  await screen.getByRole('button', { name: 'Retirer Sam' }).click()
  expect(rotations).toEqual([['Inès', 'Zoé', 'Léo']])
})

it('lets someone arriving join at the back of the File, offering only players not already in the rotation', async () => {
  const rotations: string[][] = []
  const screen = render(
    <AuSuivant
      rotation={['Inès', 'Zoé']}
      players={['Inès', 'Léo', 'Zoé', 'Nora']}
      matches={[getMockGame()]}
      look={() => ({ team: null, url: null })}
      onNext={() => {}}
      onEnd={() => {}}
      onRotation={(rotation) => rotations.push([...rotation])}
    />,
  )

  const add = screen.getByRole('combobox', { name: 'Ajouter à la File' })
  await expect.element(add).toBeVisible()
  expect(
    add
      .getByRole('option')
      .elements()
      .filter((option) => option instanceof HTMLOptionElement && option.value !== '')
      .map((option) => option.textContent),
  ).toEqual(['Léo', 'Nora'])

  await add.selectOptions('Nora')
  expect(rotations).toEqual([['Inès', 'Zoé', 'Nora']])
  await expect.element(add).toHaveValue('')
})

it('lets the Prochain step out between games, the front of the File stepping up', async () => {
  const events: string[] = []
  const screen = render(
    <AuSuivant
      rotation={['Inès', 'Zoé', 'Sam', 'Léo']}
      players={[]}
      matches={[getMockGame()]}
      look={() => ({ team: null, url: null })}
      onNext={() => {}}
      onEnd={() => events.push('end')}
      onRotation={(rotation) => events.push(rotation.join(','))}
    />,
  )

  await screen.getByRole('button', { name: 'Retirer Zoé' }).click()
  expect(events).toEqual(['Inès,Sam,Léo'])
})

it('ends the session when the Prochain steps out and only the King is left', async () => {
  const events: string[] = []
  const screen = render(
    <AuSuivant
      rotation={['Inès', 'Zoé']}
      players={[]}
      matches={[getMockGame()]}
      look={() => ({ team: null, url: null })}
      onNext={() => {}}
      onEnd={() => events.push('end')}
      onRotation={(rotation) => events.push(rotation.join(','))}
    />,
  )

  await screen.getByRole('button', { name: 'Retirer Zoé' }).click()
  expect(events).toEqual(['Inès', 'end'])
})

it('lets the King step out between games, the Prochain taking the table', async () => {
  const events: string[] = []
  const screen = render(
    <AuSuivant
      rotation={['Inès', 'Zoé', 'Sam', 'Léo']}
      players={[]}
      matches={[getMockGame()]}
      look={() => ({ team: null, url: null })}
      onNext={() => {}}
      onEnd={() => events.push('end')}
      onRotation={(rotation) => events.push(rotation.join(','))}
    />,
  )

  await screen.getByRole('button', { name: 'Retirer Inès' }).click()
  expect(events).toEqual(['Zoé,Sam,Léo'])
})
