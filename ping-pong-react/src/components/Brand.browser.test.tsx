import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import Brand from './Brand'
import type { Org } from '../lib/org'

const recovr: Org = { orgId: '0b6f6a4e-5c1b-4f3e-9a51-2a8c7d1e9f00', orgName: 'Recovr' }

test.for([
  { who: 'a member signed in to Recovr', org: recovr, brand: 'Ping-Pong · Recovr' },
  { who: 'a signed-out visitor', org: null, brand: 'Ping-Pong' },
])('names the product, and the company for $who', async ({ org, brand }) => {
  const screen = render(
    <h1>
      <Brand org={org} />
    </h1>,
  )
  await expect.element(screen.getByRole('heading')).toHaveTextContent(new RegExp(`^${brand}$`))
})
