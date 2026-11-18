import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import NewMenu from './NewMenu'

it('opens the King of the Ping creation screen from « + Nouveau »', async () => {
  window.history.replaceState({}, '', '/')
  const screen = render(<NewMenu onNew={() => {}} onNewGame={() => {}} />)

  await screen.getByRole('button', { name: /Nouveau/ }).click()
  await screen.getByRole('menuitem', { name: /King of the Ping/ }).click()

  expect(window.location.pathname).toBe('/king')
})
