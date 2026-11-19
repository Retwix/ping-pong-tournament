import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import KindSwitch from './KindSwitch'
import type { TournamentKind } from '../types'

const renderSwitch = (variant: TournamentKind) => {
  const calls: string[] = []
  const screen = render(
    <KindSwitch
      variant={variant}
      onNew={() => calls.push('tournoi')}
      onNewGame={() => calls.push('partie')}
      onNewKing={() => calls.push('king')}
    />,
  )
  return {
    calls,
    partie: screen.getByRole('button', { name: 'Partie rapide' }),
    tournoi: screen.getByRole('button', { name: 'Tournoi' }),
    king: screen.getByRole('button', { name: 'King of the Ping' }),
  }
}

it('on a King of the Ping screen, the King segment is pressed and stays put; the others lead away', async () => {
  const { calls, partie, tournoi, king } = renderSwitch('king')

  await expect.element(king).toHaveAttribute('aria-pressed', 'true')
  await expect.element(partie).toHaveAttribute('aria-pressed', 'false')
  await expect.element(tournoi).toHaveAttribute('aria-pressed', 'false')
  await king.click()
  await tournoi.click()
  await partie.click()

  expect(calls).toEqual(['tournoi', 'partie'])
})

it('the current segment is pressed and stays put; the other ones lead away', async () => {
  const { calls, partie, tournoi, king } = renderSwitch('game')

  await expect.element(partie).toHaveAttribute('aria-pressed', 'true')
  await expect.element(tournoi).toHaveAttribute('aria-pressed', 'false')
  await expect.element(king).toHaveAttribute('aria-pressed', 'false')
  await partie.click()
  await tournoi.click()
  await king.click()

  expect(calls).toEqual(['tournoi', 'king'])
})
