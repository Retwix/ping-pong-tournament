import { expect, it, onTestFinished } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from '@vitest/browser/context'
import KingTable from './KingTable'
import type { PlayerRating } from '../lib/finalStandings'
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

const renderKingTable = (overrides: {
  rotation: Rotation
  matches: ReadonlyArray<Match>
  ended?: boolean
  unranked?: boolean
  ratings?: ReadonlyArray<PlayerRating>
}) => {
  const patches: Array<{ id: string; patch: Partial<Match> }> = []
  const rotations: Rotation[] = []
  const started: string[] = []
  const ended: Array<string | null> = []
  const closed: string[] = []
  const abandoned: Array<{ id: string; rotation: Rotation }> = []
  const screen = render(
    <KingTable
      ended={false}
      unranked={false}
      ratings={[]}
      players={['Inès', 'Léo', 'Sam', 'Nora']}
      {...overrides}
      look={() => ({ team: null, url: null })}
      onPatch={(id, patch) => patches.push({ id, patch })}
      onRotation={(rotation) => rotations.push(rotation)}
      onNext={() => started.push('next')}
      onEnd={(champion) => ended.push(champion)}
      onClose={() => closed.push('close')}
      onAbandon={(id, rotation) => abandoned.push({ id, rotation })}
      scorer={(match, onPatch) => (
        <section aria-label="scorer">
          {match.player_a} v {match.player_b}
          <button onClick={() => onPatch({ score_b: match.score_b + 1 })}>Point</button>
          <button onClick={() => onPatch({ done: true })}>Valider</button>
        </section>
      )}
    />,
  )
  return { screen, patches, rotations, started, ended, closed, abandoned }
}

it('scores the game at the table, and on validation the winner holds it while the loser joins the back of the File', async () => {
  const { screen, patches, rotations } = renderKingTable({
    rotation: ['Inès', 'Léo', 'Sam'],
    matches: [
      getMockGame({
        idx: 0,
        player_a: 'Inès',
        player_b: 'Sam',
        score_a: 7,
        score_b: 4,
        done: true,
      }),
      getMockGame({ idx: 1, player_a: 'Inès', player_b: 'Léo', score_a: 4, score_b: 6 }),
    ],
  })

  await expect
    .element(screen.getByRole('region', { name: 'scorer' }))
    .toHaveTextContent('Inès v Léo')
  await screen.getByRole('button', { name: 'Point' }).click()
  expect(rotations).toEqual([])

  await screen.getByRole('button', { name: 'Valider' }).click()
  expect(patches).toEqual([
    { id: 'm1', patch: { score_b: 7 } },
    { id: 'm1', patch: { done: true } },
  ])
  expect(rotations).toEqual([['Léo', 'Sam', 'Inès']])
})

it('calls up « Au suivant » once the last game is done, where the File is edited and one tap starts the next', async () => {
  const { screen, started, rotations } = renderKingTable({
    rotation: ['Inès', 'Léo', 'Sam'],
    matches: [getMockGame({ idx: 0, score_a: 7, score_b: 4, done: true })],
  })

  await expect.element(screen.getByRole('region', { name: 'le King' })).toHaveTextContent('Inès')
  await screen.getByRole('button', { name: 'Retirer Sam' }).click()
  await screen.getByRole('combobox', { name: 'Ajouter à la File' }).selectOptions('Nora')
  expect(rotations).toEqual([
    ['Inès', 'Léo'],
    ['Inès', 'Léo', 'Sam', 'Nora'],
  ])

  await screen.getByRole('button', { name: 'Lancer la partie' }).click()
  expect(started).toEqual(['next'])
})

it('« Terminer » ends the session, crowning the longest reign, a tie going to whoever reached it first', async () => {
  const { screen, ended, closed } = renderKingTable({
    rotation: ['Léo', 'Inès', 'Sam'],
    matches: [
      getMockGame({
        idx: 0,
        player_a: 'Inès',
        player_b: 'Sam',
        score_a: 7,
        score_b: 4,
        done: true,
      }),
      getMockGame({
        idx: 1,
        player_a: 'Inès',
        player_b: 'Léo',
        score_a: 7,
        score_b: 5,
        done: true,
      }),
      getMockGame({
        idx: 2,
        player_a: 'Inès',
        player_b: 'Léo',
        score_a: 3,
        score_b: 7,
        done: true,
      }),
      getMockGame({ idx: 3, player_a: 'Léo', player_b: 'Sam', score_a: 7, score_b: 2, done: true }),
    ],
  })

  await screen.getByRole('button', { name: 'Terminer' }).click()
  expect(ended).toEqual(['Inès'])
  expect(closed).toEqual([])
})

it('once the session has ended, crowns the longest reign, shows what it did to each Élo, then leaves', async () => {
  const { screen, closed } = renderKingTable({
    ended: true,
    rotation: ['Sam'],
    ratings: [
      { name: 'Inès', endRating: 1231.6, netDelta: 18.4, provisional: false },
      { name: 'Léo', endRating: 1004, netDelta: 2.2, provisional: false },
      { name: 'Sam', endRating: 987.2, netDelta: -9.1, provisional: false },
    ],
    matches: [
      getMockGame({
        idx: 0,
        player_a: 'Inès',
        player_b: 'Sam',
        score_a: 7,
        score_b: 4,
        done: true,
      }),
      getMockGame({
        idx: 1,
        player_a: 'Inès',
        player_b: 'Léo',
        score_a: 7,
        score_b: 5,
        done: true,
      }),
      getMockGame({
        idx: 2,
        player_a: 'Inès',
        player_b: 'Léo',
        score_a: 3,
        score_b: 7,
        done: true,
      }),
      getMockGame({ idx: 3, player_a: 'Léo', player_b: 'Sam', score_a: 7, score_b: 2, done: true }),
      getMockGame({ idx: 4, player_a: 'Léo', player_b: 'Sam', score_a: 1, score_b: 7, done: true }),
      getMockGame({ idx: 5, player_a: 'Sam', player_b: 'Inès', score_a: 3, score_b: 2 }),
    ],
  })

  const crown = screen.getByRole('region', { name: 'le champion' })
  await expect.element(crown).toHaveTextContent('Inès')
  expect(crown.element().textContent).toContain('2 victoires')
  expect(crown.element().textContent).toContain('5 parties')

  const elo = screen.getByRole('table', { name: 'Résultats de la session' })
  await expect.element(elo.getByRole('columnheader', { name: 'Δ' })).toBeVisible()
  const ines = elo.getByRole('row', { name: /Inès/ })
  await expect.element(ines).toHaveTextContent('2–1')
  await expect.element(ines).toHaveTextContent('1232')
  await expect.element(ines).toHaveTextContent('+18')

  await screen.getByRole('button', { name: 'Accueil' }).click()
  expect(closed).toEqual(['close'])
})

it('mid-game, opens the File over the scorer so someone arriving joins without stopping the game', async () => {
  await page.viewport(390, 700)
  const { screen, rotations } = renderKingTable({
    rotation: ['Inès', 'Léo', 'Sam'],
    matches: [getMockGame({ idx: 0, player_a: 'Inès', player_b: 'Léo', score_a: 4, score_b: 3 })],
  })

  await screen.getByRole('button', { name: 'File' }).click()
  const sheet = screen.getByRole('dialog', { name: 'File' })
  await sheet.getByRole('combobox', { name: 'Ajouter à la File' }).selectOptions('Nora')
  expect(rotations).toEqual([['Inès', 'Léo', 'Sam', 'Nora']])

  await sheet.getByRole('button', { name: 'Fermer' }).click()
  await expect.element(sheet).not.toBeInTheDocument()
  await expect
    .element(screen.getByRole('region', { name: 'scorer' }))
    .toHaveTextContent('Inès v Léo')
})

it('keeps keys typed in the File sheet from reaching the scorer’s keyboard shortcuts', async () => {
  await page.viewport(390, 700)
  const keys: string[] = []
  const record = (e: KeyboardEvent) => keys.push(e.key)
  window.addEventListener('keydown', record)
  onTestFinished(() => window.removeEventListener('keydown', record))
  const { screen } = renderKingTable({
    rotation: ['Inès', 'Léo', 'Sam'],
    matches: [getMockGame({ idx: 0, player_a: 'Inès', player_b: 'Léo', score_a: 4, score_b: 3 })],
  })

  await screen.getByRole('button', { name: 'File' }).click()
  const sheet = screen.getByRole('dialog', { name: 'File' })
  await sheet.getByRole('combobox', { name: 'Ajouter à la File' }).click()
  await userEvent.keyboard('s{ArrowRight}{Enter}')
  expect(keys).toEqual([])

  await sheet.getByRole('button', { name: 'Fermer' }).click()
  await userEvent.keyboard('{Enter}')
  expect(keys).toEqual(['Enter'])
})

it('mid-game, someone at the table leaving abandons the game once confirmed, whoever stays holding the table', async () => {
  await page.viewport(390, 700)
  const { screen, abandoned, ended } = renderKingTable({
    rotation: ['Inès', 'Sam', 'Léo'],
    matches: [
      getMockGame({ id: 'm-on', player_a: 'Inès', player_b: 'Sam', score_a: 4, score_b: 3 }),
    ],
  })

  await screen.getByRole('button', { name: 'File' }).click()
  const sheet = screen.getByRole('dialog', { name: 'File' })
  await sheet.getByRole('button', { name: 'Retirer Sam' }).click()
  expect(abandoned).toEqual([])

  await sheet.getByRole('button', { name: 'Abandonner la partie' }).click()
  expect(abandoned).toEqual([{ id: 'm-on', rotation: ['Inès', 'Léo'] }])
  expect(ended).toEqual([])
  await expect.element(sheet).not.toBeInTheDocument()

  await screen.getByRole('button', { name: 'File' }).click()
  await expect.element(sheet.getByRole('button', { name: 'Retirer Inès' })).toBeInTheDocument()
  expect(sheet.getByRole('button', { name: 'Abandonner la partie' }).query()).toBeNull()
})

it('with no game left after the only one was abandoned, calls up whoever holds the table for the next', async () => {
  const { screen, started } = renderKingTable({ rotation: ['Inès', 'Léo'], matches: [] })

  await expect.element(screen.getByRole('region', { name: 'le King' })).toHaveTextContent('Inès')
  await screen.getByRole('button', { name: 'Lancer la partie' }).click()
  expect(started).toEqual(['next'])
})

it('when only one player is left at the table, the abandon ends the session and crowns the games already played', async () => {
  await page.viewport(390, 700)
  const { screen, abandoned, ended } = renderKingTable({
    rotation: ['Inès', 'Sam'],
    matches: [
      getMockGame({
        idx: 0,
        player_a: 'Inès',
        player_b: 'Sam',
        score_a: 7,
        score_b: 4,
        done: true,
      }),
      getMockGame({
        idx: 1,
        id: 'm-on',
        player_a: 'Inès',
        player_b: 'Sam',
        score_a: 2,
        score_b: 5,
      }),
    ],
  })

  await screen.getByRole('button', { name: 'File' }).click()
  await screen.getByRole('button', { name: 'Retirer Inès' }).click()
  await screen.getByRole('button', { name: 'Abandonner la partie' }).click()
  expect(abandoned).toEqual([{ id: 'm-on', rotation: ['Sam'] }])
  expect(ended).toEqual(['Inès'])
})

it('« Terminer » before any game was validated ends the session with nobody crowned and leaves', async () => {
  const { screen, ended, closed } = renderKingTable({ rotation: ['Inès', 'Léo'], matches: [] })

  await screen.getByRole('button', { name: 'Terminer' }).click()
  expect(ended).toEqual([null])
  expect(closed).toEqual(['close'])
})

it('with one player left and nobody to crown, shows nothing rather than calling up a game it cannot make', async () => {
  const { screen } = renderKingTable({ rotation: ['Inès'], matches: [] })

  expect(screen.container).toBeEmptyDOMElement()
})

it('an unranked session ends on its players’ records alone, saying no Élo moved', async () => {
  const { screen } = renderKingTable({
    ended: true,
    unranked: true,
    rotation: ['Inès', 'Sam'],
    matches: [getMockGame({ idx: 0, score_a: 7, score_b: 4, done: true })],
  })

  const elo = screen.getByRole('table', { name: 'Résultats de la session' })
  const ines = elo.getByRole('row', { name: /Inès/ })
  await expect.element(ines).toHaveTextContent('1–0')
  expect(ines.getByRole('cell').elements()).toHaveLength(1)
  expect(elo.getByRole('columnheader', { name: 'Δ' }).query()).toBeNull()
  await expect.element(screen.getByText(/Non classée/)).toBeVisible()
})

it('a session ended elsewhere with nobody crowned reads as over here, not as a game to keep scoring', async () => {
  const { screen, closed } = renderKingTable({
    ended: true,
    rotation: ['Inès', 'Sam', 'Léo'],
    matches: [getMockGame({ idx: 0, player_a: 'Inès', player_b: 'Sam', score_a: 3, score_b: 2 })],
  })

  await expect.element(screen.getByRole('button', { name: 'Accueil' })).toBeVisible()
  expect(screen.getByRole('table', { name: 'Résultats de la session' }).query()).toBeNull()
  await screen.getByRole('button', { name: 'Accueil' }).click()
  expect(closed).toEqual(['close'])
})

it('mid-game, « Terminer » once confirmed drops the game in progress and crowns the games already validated', async () => {
  await page.viewport(390, 700)
  const { screen, abandoned, ended } = renderKingTable({
    rotation: ['Inès', 'Léo', 'Sam'],
    matches: [
      getMockGame({
        idx: 0,
        player_a: 'Inès',
        player_b: 'Sam',
        score_a: 7,
        score_b: 4,
        done: true,
      }),
      getMockGame({
        idx: 1,
        id: 'm-on',
        player_a: 'Inès',
        player_b: 'Léo',
        score_a: 2,
        score_b: 5,
      }),
    ],
  })

  await screen.getByRole('button', { name: 'File' }).click()
  expect(screen.getByRole('button', { name: 'Terminer la session' }).query()).toBeNull()
  await screen.getByRole('button', { name: 'Terminer', exact: true }).click()
  expect(abandoned).toEqual([])

  await screen.getByRole('button', { name: 'Terminer la session' }).click()
  expect(abandoned).toEqual([{ id: 'm-on', rotation: ['Inès', 'Léo', 'Sam'] }])
  expect(ended).toEqual(['Inès'])
})

it('closing the File sheet cancels a confirm left pending, so reopening it asks again', async () => {
  await page.viewport(390, 700)
  const { screen } = renderKingTable({
    rotation: ['Inès', 'Léo', 'Sam'],
    matches: [getMockGame({ idx: 0, player_a: 'Inès', player_b: 'Léo', score_a: 2, score_b: 5 })],
  })
  const sheet = screen.getByRole('dialog', { name: 'File' })

  await screen.getByRole('button', { name: 'File' }).click()
  await sheet.getByRole('button', { name: 'Terminer', exact: true }).click()
  await sheet.getByRole('button', { name: 'Retirer Léo' }).click()
  await expect.element(sheet.getByRole('button', { name: 'Terminer la session' })).toBeVisible()
  await expect.element(sheet.getByRole('button', { name: 'Abandonner la partie' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Fermer' }).click()

  await screen.getByRole('button', { name: 'File' }).click()
  await expect.element(sheet.getByRole('button', { name: 'Retirer Inès' })).toBeVisible()
  expect(sheet.getByRole('button', { name: 'Terminer la session' }).query()).toBeNull()
  expect(sheet.getByRole('button', { name: 'Abandonner la partie' }).query()).toBeNull()
})
