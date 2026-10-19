import { describe, expect, it } from 'vitest'
import { unstickScrollOnResize } from './strandedScroll'

const getMockWindow = ({ scrollY }: { scrollY: number }) => {
  const listeners: Array<() => void> = []
  const win = {
    scrollY,
    scrollTo: ({ top }: { top: number }) => {
      win.scrollY = top
    },
    addEventListener: (_type: 'resize', listener: () => void) => {
      listeners.push(listener)
    },
  }
  return { win, rotate: () => listeners.forEach((listener) => listener()) }
}

describe('unstickScrollOnResize', () => {
  it('puts the page back at its top when a rotation leaves it stuck above it, so taps land under the finger', () => {
    const { win, rotate } = getMockWindow({ scrollY: -62 })
    unstickScrollOnResize(win)

    rotate()

    expect(win.scrollY).toBe(0)
  })

  it('leaves a page the reader scrolled down where it is, so a resize never throws them back to the top', () => {
    const { win, rotate } = getMockWindow({ scrollY: 300 })
    unstickScrollOnResize(win)

    rotate()

    expect(win.scrollY).toBe(300)
  })
})
