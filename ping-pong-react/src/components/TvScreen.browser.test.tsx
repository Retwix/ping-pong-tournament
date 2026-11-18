import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import TvScreen from './TvScreen'

test('a TV signed in to a company names it on screen', async () => {
  const screen = render(
    <TvScreen
      scene={null}
      now={new Date('2026-11-10T12:00:00')}
      org={{ orgId: '0b6f6a4e-5c1b-4f3e-9a51-2a8c7d1e9f00', orgName: 'Acme' }}
    />,
  )
  await expect.element(screen.getByText('Acme')).toBeInTheDocument()
})
