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

const renderOwnCard = (onSaveBio: (bio: string | null) => Promise<void>, bio: string | null = null) =>
  render(
    <PlayerModal row={getMockRatingRow()} bio={bio} history={null} onClose={() => {}} onSaveBio={onSaveBio} />,
  )

describe('PlayerModal', () => {
  it('saves the bio you type on your own card, then closes the editor', async () => {
    const onSaveBio = vi.fn(async () => {})
    const screen = await renderOwnCard(onSaveBio)

    await screen.getByRole('button', { name: 'Modifier ma bio' }).click()
    await screen.getByRole('textbox', { name: 'Ma bio' }).fill('Roi du revers')
    await screen.getByRole('button', { name: 'Enregistrer' }).click()

    await expect.element(screen.getByRole('textbox', { name: 'Ma bio' })).not.toBeInTheDocument()
    expect(onSaveBio).toHaveBeenCalledWith('Roi du revers')
  })

  it('clears your bio when you save it blank', async () => {
    const onSaveBio = vi.fn(async () => {})
    const screen = await renderOwnCard(onSaveBio, 'Roi du revers')

    await screen.getByRole('button', { name: 'Modifier ma bio' }).click()
    await screen.getByRole('textbox', { name: 'Ma bio' }).fill('   ')
    await screen.getByRole('button', { name: 'Enregistrer' }).click()

    await expect.element(screen.getByRole('textbox', { name: 'Ma bio' })).not.toBeInTheDocument()
    expect(onSaveBio).toHaveBeenCalledWith(null)
  })

  it("shows the player's bio under the name", async () => {
    const screen = await render(
      <PlayerModal row={getMockRatingRow()} bio="Roi du revers" history={null} onClose={() => {}} />,
    )

    await expect.element(screen.getByText('Roi du revers')).toBeVisible()
  })

  it('lets you sign out from your own card', async () => {
    const onSignOut = vi.fn()
    const screen = await render(
      <PlayerModal row={getMockRatingRow()} bio={null} history={null} onClose={() => {}} onSignOut={onSignOut} />,
    )

    await screen.getByRole('button', { name: 'Se déconnecter' }).click()

    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it("offers no sign-out or bio editing on someone else's card", async () => {
    const screen = await render(
      <PlayerModal row={getMockRatingRow()} bio={null} history={null} onClose={() => {}} />,
    )

    await expect.element(screen.getByRole('heading', { name: 'Léo' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Se déconnecter' })).not.toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: 'Modifier ma bio' })).not.toBeInTheDocument()
  })
})
