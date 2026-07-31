import { describe, expect, it } from 'vitest'
import { uniqueChannelName } from './realtimeChannel'

describe('uniqueChannelName', () => {
  it('namespaces the base topic with the generated suffix', () => {
    expect(uniqueChannelName('ratings-live', () => 'abc')).toBe('ratings-live-abc')
  })

  it('keeps the base topic verbatim as the prefix', () => {
    expect(uniqueChannelName('leaderboard', () => 'x')).toBe('leaderboard-x')
  })

  it('produces a different name on every call so StrictMode remounts never reuse a subscribed channel', () => {
    const first = uniqueChannelName('ratings-live')
    const second = uniqueChannelName('ratings-live')
    expect(first).not.toBe(second)
    expect(first.startsWith('ratings-live-')).toBe(true)
    expect(second.startsWith('ratings-live-')).toBe(true)
  })
})
