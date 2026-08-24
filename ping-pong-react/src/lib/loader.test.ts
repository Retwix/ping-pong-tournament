import { describe, expect, it } from 'vitest'
import { loaderSizing } from './loader'

describe('loader sizing', () => {
  it('derives width from the height using the racket 40:53 aspect ratio', () => {
    expect(loaderSizing(120).width).toBe(91)
    expect(loaderSizing(120).height).toBe(120)
  })

  it('rounds the derived width to whole pixels', () => {
    expect(loaderSizing(40).width).toBe(30)
  })

  it('drops the decorative effects at or below the 48px compact threshold', () => {
    expect(loaderSizing(48).compact).toBe(true)
    expect(loaderSizing(47).compact).toBe(true)
    expect(loaderSizing(40).compact).toBe(true)
  })

  it('keeps the decorative effects above the compact threshold', () => {
    expect(loaderSizing(49).compact).toBe(false)
    expect(loaderSizing(120).compact).toBe(false)
  })
})
