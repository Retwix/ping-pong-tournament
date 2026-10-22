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

const FINGER_SLOP = 6

const tapAt = (el: Element, position: { x: number; y: number }) =>
  userEvent.click(el, { position, force: true })

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

  it.each(PHONES)(
    'on a $name, a tap that lands just off the edge of "−1 point" still removes a point',
    async ({ width, height }) => {
      const screen = await renderReferee({
        viewport: { width, height },
        match: { score_a: 5, score_b: 9 },
      })
      const remove = screen.getByRole('button', { name: 'Retirer un point à Thibault' }).element()
      const { width: w, height: h } = remove.getBoundingClientRect()
      const aboveBelowLeftRight = [
        { x: w / 2, y: -FINGER_SLOP },
        { x: w / 2, y: h + FINGER_SLOP },
        { x: -FINGER_SLOP, y: h / 2 },
        { x: w + FINGER_SLOP, y: h / 2 },
      ]

      for (const [i, justOff] of aboveBelowLeftRight.entries()) {
        await tapAt(remove, justOff)
        await expect.element(screen.getByText(String(4 - i), { exact: true })).toBeVisible()
      }
    }
  )

  it('a tap on the greyed-out "−1 point" at zero does not give the player a point', async () => {
    const screen = await renderReferee({
      viewport: { width: 844, height: 390 },
      match: { score_a: 0, score_b: 0 },
    })
    const remove = screen.getByRole('button', { name: 'Retirer un point à Thibault' }).element()
    const { width: w, height: h } = remove.getBoundingClientRect()

    await tapAt(remove, { x: w / 2, y: h / 2 })
    await screen.getByText('Thibault', { exact: true }).click()

    await expect.element(screen.getByText('1', { exact: true })).toBeVisible()
  })
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

const SetsScreen = ({
  initial,
  onFinish = () => {},
  record = () => {},
}: {
  initial: Match
  onFinish?: () => void
  record?: (m: Match) => void
}) => {
  const [match, setMatch] = useState(initial)
  return (
    <LiveScorer
      match={match}
      target={11}
      bestOf={3}
      onPatch={(patch) =>
        setMatch((m) => {
          const next = { ...m, ...patch }
          record(next)
          return next
        })
      }
      onFinish={onFinish}
      onClose={() => {}}
    />
  )
}

const renderBo3 = async (match: Partial<Match>, props: { onFinish?: () => void; record?: (m: Match) => void } = {}) => {
  await page.viewport(844, 390)
  return render(<SetsScreen initial={getMockMatch(match)} {...props} />)
}

const lineShown = (text: string) =>
  [...document.querySelectorAll('div')].some(
    (el) => el.children.length === 0 && el.textContent === text && el.checkVisibility({ visibilityProperty: true })
  )

const zoneText = (screen: Awaited<ReturnType<typeof renderBo3>>, name: string) =>
  zoneOf(screen.getByRole('button', { name: `Retirer un point à ${name}` }).element()).textContent ?? ''

describe('referee scoring a match of sets', () => {
  it('a validated set starts the next one at 0-0, with the other player serving first', async () => {
    const finished: string[] = []
    const screen = await renderBo3({ score_a: 10, score_b: 5 }, { onFinish: () => finished.push('finished') })
    await expect.poll(() => lineShown('Bo3 en 11 · Set 1')).toBe(true)
    expect(zoneText(screen, 'Thibault')).toMatch(/BALLE DE SET.*1 point pour gagner le set/)

    await screen.getByText('Thibault', { exact: true }).click()
    await expect.poll(() => zoneText(screen, 'Thibault')).toMatch(/Set gagné/)
    expect(zoneText(screen, 'Thibault')).not.toMatch(/Vainqueur/)
    await screen.getByRole('button', { name: /Valider/ }).click()

    await expect.poll(() => lineShown('Bo3 en 11 · Set 2 · 11-5')).toBe(true)
    expect(finished).toEqual([])
    expect(screen.getByText('0', { exact: true }).elements()).toHaveLength(2)
    expect(zoneText(screen, 'Alexandre')).toMatch(/AU SERVICE/)
    expect(zoneText(screen, 'Thibault')).not.toMatch(/AU SERVICE/)

    await screen.getByRole('button', { name: /Inverser/ }).click()
    await expect.poll(() => lineShown('Bo3 en 11 · Set 2 · 5-11')).toBe(true)

    await screen.getByRole('button', { name: /Annuler/ }).click()
    await expect.poll(() => lineShown('Bo3 en 11 · Set 1')).toBe(true)
    await expect.element(screen.getByText('11', { exact: true })).toBeVisible()
  })

  it('only the set that can decide the match is a match ball, and only saving one counts', async () => {
    const saved: string[] = []
    const record = (m: Match) => saved.push(`${m.mb_saved_a}-${m.mb_saved_b}`)
    const thibaultOnSetBall = await renderBo3({ score_a: 10, score_b: 9 }, { record })
    await thibaultOnSetBall.getByText('Alexandre', { exact: true }).click()
    thibaultOnSetBall.unmount()
    const alexandreOnSetBall = await renderBo3({ score_a: 9, score_b: 10 }, { record })
    await alexandreOnSetBall.getByText('Thibault', { exact: true }).click()
    alexandreOnSetBall.unmount()
    expect(saved).toEqual(['0-0', '0-0'])

    const secondSet = await renderBo3({ score_a: 10, score_b: 9, sets: [[11, 5]] }, { record })
    expect(zoneText(secondSet, 'Thibault')).toMatch(/BALLE DE MATCH.*1 point pour gagner le match/)
    await secondSet.getByText('Alexandre', { exact: true }).click()
    expect(saved).toEqual(['0-0', '0-0', '0-1'])
  })

  it('validating the set that decides the match ends it', async () => {
    const finished: string[] = []
    const screen = await renderBo3(
      { score_a: 11, score_b: 9, sets: [[11, 5]] },
      { onFinish: () => finished.push('finished') }
    )

    await screen.getByRole('button', { name: /Valider/ }).click()

    expect(finished).toEqual(['finished'])
    await expect.element(screen.getByRole('button', { name: /Validé/ })).toBeDisabled()
  })
})
