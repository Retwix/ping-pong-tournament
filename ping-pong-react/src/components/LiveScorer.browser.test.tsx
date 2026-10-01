import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from '@vitest/browser/context'
import { render } from 'vitest-browser-react'
import LiveScorer from './LiveScorer'
import type { Match } from '../types'
import '../index.css'

const getMockMatch = (overrides?: Partial<Match>): Match => ({
  id: 'm1',
  tournament_id: 't1',
  round: 1,
  idx: 0,
  player_a: 'Thibault',
  player_b: 'Alexandre',
  player_a_id: null,
  player_b_id: null,
  score_a: 0,
  score_b: 0,
  done: false,
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
  ...overrides,
})

const RefereeScreen = ({ initial }: { initial: Match }) => {
  const [match, setMatch] = useState(initial)
  return (
    <LiveScorer
      match={match}
      target={11}
      tournamentName="Tournoi du jeudi"
      elos={{ a: 1512, b: 1488 }}
      onPatch={(patch) => setMatch((m) => ({ ...m, ...patch }))}
      onClose={() => {}}
    />
  )
}

const renderReferee = async (overrides: {
  viewport: { width: number; height: number }
  match?: Partial<Match>
}) => {
  await page.viewport(overrides.viewport.width, overrides.viewport.height)
  return render(<RefereeScreen initial={getMockMatch(overrides.match)} />)
}

const centreOf = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

const tapTwiceInPlace = async (el: Element) => {
  const { x, y } = centreOf(el)
  await userEvent.click(el)
  const underFinger = document.elementFromPoint(x, y)
  expect(underFinger).not.toBeNull()
  await userEvent.click(underFinger!)
}

const PHONES = [
  { name: 'phone in landscape', width: 844, height: 390 },
  { name: 'phone in portrait', width: 390, height: 844 },
  { name: 'large phone in landscape', width: 932, height: 430 },
]

describe('referee removing points', () => {
  it.each(PHONES)(
    'two taps in the same spot on a $name remove two points, even when the first one clears match point',
    async ({ width, height }) => {
      const screen = await renderReferee({
        viewport: { width, height },
        match: { score_a: 10, score_b: 9 },
      })
      const remove = screen.getByRole('button', { name: 'Retirer un point à Thibault' })

      await tapTwiceInPlace(remove.element())

      await expect.element(screen.getByText('8', { exact: true })).toBeVisible()
    }
  )
})

describe('referee seeing match point', () => {
  const visibleTexts = (zone: Element) =>
    [...zone.querySelectorAll('*')]
      .filter((el) => el.children.length === 0 && el.checkVisibility({ visibilityProperty: true }))
      .map((el) => el.textContent ?? '')
      .join(' ')

  it('only the player one point from winning is told so', async () => {
    const screen = await renderReferee({
      viewport: { width: 844, height: 390 },
      match: { score_a: 10, score_b: 9 },
    })
    const [leader, trailer] = ['Thibault', 'Alexandre'].map((name) =>
      visibleTexts(zoneOf(screen.getByRole('button', { name: `Retirer un point à ${name}` }).element()))
    )

    expect(leader).toMatch(/BALLE DE MATCH.*1 point pour gagner le match/)
    expect(trailer).not.toMatch(/BALLE DE MATCH|1 point pour gagner le match/)
  })

  it('once the game is won, the winner is crowned and nobody is on match point', async () => {
    const screen = await renderReferee({
      viewport: { width: 844, height: 390 },
      match: { score_a: 11, score_b: 9 },
    })
    const [winner, loser] = ['Thibault', 'Alexandre'].map((name) =>
      visibleTexts(zoneOf(screen.getByRole('button', { name: `Retirer un point à ${name}` }).element()))
    )

    expect(winner).toMatch(/Vainqueur/)
    expect(`${winner} ${loser}`).not.toMatch(/BALLE DE MATCH|1 point pour gagner le match/)
  })
})

const LANDSCAPE_PHONES = [
  { name: 'small phone, browser bars showing', width: 667, height: 320 },
  { name: 'phone, browser bars showing', width: 844, height: 340 },
  { name: 'large Android phone', width: 915, height: 412 },
  { name: 'large iPhone, browser bars showing', width: 932, height: 380 },
]

type Box = { label: string; rect: DOMRect }

const boxOf = (el: Element, label: string): Box => ({ label, rect: el.getBoundingClientRect() })

const TOLERANCE = 1

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right - TOLERANCE &&
  b.left < a.right - TOLERANCE &&
  a.top < b.bottom - TOLERANCE &&
  b.top < a.bottom - TOLERANCE

const contains = (outer: DOMRect, inner: DOMRect) =>
  inner.left >= outer.left - TOLERANCE &&
  inner.right <= outer.right + TOLERANCE &&
  inner.top >= outer.top - TOLERANCE &&
  inner.bottom <= outer.bottom + TOLERANCE

const shownParts = (zone: Element): Box[] =>
  [...zone.children]
    .filter((el) => getComputedStyle(el).visibility !== 'hidden')
    .map((el) => boxOf(el, el.textContent ?? ''))

const zoneOf = (removeButton: Element) => {
  const zone = removeButton.parentElement
  expect(zone).not.toBeNull()
  return zone!
}

const layoutProblems = (zones: Element[], extras: Box[]) => {
  const zoneRects = zones.map((z) => z.getBoundingClientRect())
  const parts = zones.flatMap(shownParts)
  const outside = zones.flatMap((zone, i) =>
    shownParts(zone)
      .filter((p) => !contains(zoneRects[i], p.rect))
      .map((p) => `${p.label} sticks out of its zone`)
  )
  const all = [...parts, ...extras]
  const collisions = all.flatMap((a, i) =>
    all
      .slice(i + 1)
      .filter((b) => overlaps(a.rect, b.rect))
      .map((b) => `${a.label} overlaps ${b.label}`)
  )
  const offScreen = all
    .filter((p) => p.rect.bottom > window.innerHeight + TOLERANCE || p.rect.top < -TOLERANCE)
    .map((p) => `${p.label} is off screen`)
  return [...outside, ...collisions, ...offScreen]
}

describe('referee screen in landscape', () => {
  it.each(LANDSCAPE_PHONES)(
    'on a $name, everything in a player zone fits inside it without overlapping',
    async ({ width, height }) => {
      const screen = await renderReferee({
        viewport: { width, height },
        match: { score_a: 10, score_b: 9 },
      })
      const zones = ['Thibault', 'Alexandre'].map((name) =>
        zoneOf(screen.getByRole('button', { name: `Retirer un point à ${name}` }).element())
      )
      const extras = [
        boxOf(screen.getByRole('button', { name: 'Fermer' }).element(), 'back button'),
        boxOf(screen.getByRole('button', { name: /Annuler/ }).element(), 'Annuler'),
        boxOf(screen.getByRole('button', { name: /Valider/ }).element(), 'Valider'),
      ]

      expect(layoutProblems(zones, extras)).toEqual([])
    }
  )
})

describe('referee tapping fast', () => {
  it('quick repeated taps on the score zones and buttons are never taken as a double-tap zoom', async () => {
    const screen = await renderReferee({
      viewport: { width: 844, height: 390 },
      match: { score_a: 3, score_b: 2 },
    })
    const tapTargets = [
      screen.getByRole('button', { name: 'Retirer un point à Thibault' }).element(),
      screen.getByRole('button', { name: /Annuler/ }).element(),
      screen.getByText('3', { exact: true }).element(),
    ]

    expect(tapTargets.map((el) => getComputedStyle(el).touchAction)).toEqual([
      'manipulation',
      'manipulation',
      'manipulation',
    ])
  })
})
