import { expect, test } from 'vitest'
import { userEvent } from '@vitest/browser/context'
import { render } from 'vitest-browser-react'
import WorkspaceRefusal from './WorkspaceRefusal'

test('a visitor refused for their workspace is told so, once, and can dismiss it', async () => {
  history.replaceState(null, '', '#error=access_denied&error_description=workspace_not_on_ping_pong')

  const screen = render(<WorkspaceRefusal />)

  await expect.element(screen.getByRole('alert')).toBeInTheDocument()
  expect(window.location.hash).toBe('')
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  await expect.element(screen.getByRole('alert')).not.toBeInTheDocument()
})

test('any other auth error is left alone', async () => {
  history.replaceState(null, '', '#error=access_denied&error_description=Email+link+is+invalid')

  const screen = render(<WorkspaceRefusal />)

  expect(screen.container).toBeEmptyDOMElement()
  expect(window.location.hash).toContain('error_description')
  history.replaceState(null, '', window.location.pathname + window.location.search)
})
