import { describe, expect, it, vi } from 'vitest'
import { page } from '@vitest/browser/context'
import { render } from 'vitest-browser-react'
import OwnCardButton from './OwnCardButton'
import type { RatingRow } from '../lib/rating'
import '../index.css'

const getMockRatingRow = (overrides?: Partial<RatingRow>): RatingRow => ({
  key: 'p1',
  playerId: 'p1',
  name: 'Léo',
  rating: 1500,
  rd: 80,
  vol: 0.06,
  games: 10,
  peak: 1500,
  lastPlayedAt: '2026-07-01T00:00:00.000Z',
  rank: 1,
  provisional: false,
  team: 'tech',
  avatar_url: null,
  trend: 0,
  ...overrides,
})

const renderInTopBar = (onSignOut = vi.fn()) =>
  render(
    <nav className="rv-nav">
      <OwnCardButton row={getMockRatingRow()} history={null} onSignOut={onSignOut} />
    </nav>,
  )

describe('OwnCardButton', () => {
  it('opens your own card over the whole page, not just the top bar', async () => {
    const screen = await renderInTopBar()

    await screen.getByRole('button', { name: 'Ma fiche (Léo)' }).click()

    await expect.element(page.getByRole('heading', { name: 'Léo' })).toBeVisible()
    const scrim = document.querySelector('.scrim')!.getBoundingClientRect()
    expect({ width: scrim.width, height: scrim.height }).toEqual({
      width: window.innerWidth,
      height: window.innerHeight,
    })
  })

  it('signs you out from the card it opens', async () => {
    const onSignOut = vi.fn()
    const screen = await renderInTopBar(onSignOut)

    await screen.getByRole('button', { name: 'Ma fiche (Léo)' }).click()
    await page.getByRole('button', { name: 'Se déconnecter' }).click()

    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('closes your card again', async () => {
    const screen = await renderInTopBar()

    await screen.getByRole('button', { name: 'Ma fiche (Léo)' }).click()
    await page.getByRole('button', { name: 'Fermer' }).click()

    await expect.element(page.getByRole('heading', { name: 'Léo' })).not.toBeInTheDocument()
  })
})
