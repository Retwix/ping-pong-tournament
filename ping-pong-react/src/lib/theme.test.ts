import { describe, expect, it } from 'vitest'
import { parseTheme, resolveTheme, THEME_COLORS } from './theme'

describe('parseTheme', () => {
  it('keeps the two real themes and rejects anything else', () => {
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('sombre')).toBeNull()
    expect(parseTheme(null)).toBeNull()
  })
})

describe('resolveTheme', () => {
  it('follows the device until the user has picked a side', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
  })

  it('lets the stored pick win over the device', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('ignores a corrupted stored value', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('', false)).toBe('light')
  })
})

describe('THEME_COLORS', () => {
  it('gives each theme its own status-bar colour', () => {
    expect(THEME_COLORS.light).toBe('#4A2AA4')
    expect(THEME_COLORS.dark).toBe('#0c0f14')
    expect(THEME_COLORS.light).not.toBe(THEME_COLORS.dark)
  })
})
