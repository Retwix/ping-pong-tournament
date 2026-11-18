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
    />,
  )
  return {
    calls,
    partie: screen.getByRole('button', { name: 'Partie rapide' }),
    tournoi: screen.getByRole('button', { name: 'Tournoi' }),
  }
}

it('on a King of the Ping screen, neither segment is current and both lead away', async () => {
  const { calls, partie, tournoi } = renderSwitch('king')

  await expect.element(partie).toHaveAttribute('aria-pressed', 'false')
  await expect.element(tournoi).toHaveAttribute('aria-pressed', 'false')
  await tournoi.click()
  await partie.click()

  expect(calls).toEqual(['tournoi', 'partie'])
})

it('the current segment is pressed and stays put; the other one leads away', async () => {
  const { calls, partie, tournoi } = renderSwitch('game')

  await expect.element(partie).toHaveAttribute('aria-pressed', 'true')
  await expect.element(tournoi).toHaveAttribute('aria-pressed', 'false')
  await partie.click()
  await tournoi.click()

  expect(calls).toEqual(['tournoi'])
})
