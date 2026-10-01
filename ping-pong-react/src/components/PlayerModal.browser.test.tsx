import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import PlayerModal from './PlayerModal'
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

describe('PlayerModal', () => {
  it('lets you sign out from your own card', async () => {
    const onSignOut = vi.fn()
    const screen = await render(
      <PlayerModal row={getMockRatingRow()} history={null} onClose={() => {}} onSignOut={onSignOut} />,
    )

    await screen.getByRole('button', { name: 'Se déconnecter' }).click()

    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it("offers no sign-out on someone else's card", async () => {
    const screen = await render(<PlayerModal row={getMockRatingRow()} history={null} onClose={() => {}} />)

    await expect.element(screen.getByRole('heading', { name: 'Léo' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Se déconnecter' })).not.toBeInTheDocument()
  })
})
