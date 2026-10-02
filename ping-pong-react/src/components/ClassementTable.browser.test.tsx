import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import ClassementTable, { type ClassementRow } from './ClassementTable'
import '../index.css'

const getMockClassementRow = (overrides?: Partial<ClassementRow>): ClassementRow => ({
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
  daysIdle: null,
  record: { wins: 6, losses: 4 },
  form: [true, false, true, true, false],
  streak: 0,
  delta7: 0,
  ...overrides,
})

describe('ClassementTable', () => {
  it('opens the player whose row is clicked', async () => {
    const onSelect = vi.fn()
    const screen = await render(
      <ClassementTable
        rows={[
          getMockClassementRow({ key: 'p1', name: 'Léo', rank: 1 }),
          getMockClassementRow({ key: 'p2', playerId: 'p2', name: 'Marc', rank: 2 }),
        ]}
        leaderKey="p1"
        onSelect={onSelect}
      />,
    )

    await screen.getByRole('button', { name: "Voir l'historique de Marc" }).click()

    expect(onSelect).toHaveBeenCalledWith('p2')
  })

  it('marks your own row « toi », and nobody else’s', async () => {
    const screen = await render(
      <ClassementTable
        rows={[
          getMockClassementRow({ key: 'p1', name: 'Léo', rank: 1 }),
          getMockClassementRow({ key: 'p2', playerId: 'p2', name: 'Marc', rank: 2 }),
        ]}
        leaderKey="p1"
        ownKey="p2"
        onSelect={vi.fn()}
      />,
    )

    const rowOf = (name: string) =>
      screen.getByRole('button', { name: `Voir l'historique de ${name}` })
    await expect.element(rowOf('Marc').getByText('toi', { exact: true })).toBeVisible()
    await expect.element(rowOf('Léo').getByText('toi', { exact: true })).not.toBeInTheDocument()
  })
})
