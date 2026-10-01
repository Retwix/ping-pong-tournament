import { describe, expect, it } from 'vitest'
import { buildLabel } from './buildInfo'

describe('build version label', () => {
  it('shows the short commit and when it was built, in Paris time', () => {
    expect(
      buildLabel({
        sha: 'edf87f7a18ad3962149652fa9b1a82fc5113dab4',
        builtAt: '2026-10-01T08:45:48Z',
      })
    ).toBe('edf87f7 · 01/10 10:45')
  })

  it('follows Paris winter time too', () => {
    expect(
      buildLabel({ sha: '14f09b68ed1f60336af0098e9c31ffe9e7cd9afc', builtAt: '2026-12-24T23:30:00Z' })
    ).toBe('14f09b6 · 25/12 00:30')
  })

  it('says "dev" for a local build with no commit', () => {
    expect(buildLabel({ sha: '', builtAt: '2026-10-01T08:45:48Z' })).toBe('dev · 01/10 10:45')
  })
})
