import { useSyncExternalStore } from 'react'
import { parseTheme, resolveTheme, THEME_COLORS, THEME_KEY, type Theme } from '../lib/theme'

export type { Theme }

/**
 * The theme lives in one module-level store rather than in each toggle's own
 * state: several toggles are mounted at once (the desktop bar and the mobile
 * one), and they must all show the same side.
 */
const listeners = new Set<() => void>()

function darkQuery(): MediaQueryList | null {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)')
  } catch {
    return null
  }
}

function stored(): string | null {
  try {
    return localStorage.getItem(THEME_KEY)
  } catch {
    return null
  }
}

let theme: Theme = resolveTheme(stored(), darkQuery()?.matches === true)
/** Until the user picks a side themselves, the device's preference keeps driving. */
let userPicked = parseTheme(stored()) !== null

function apply(next: Theme): void {
  const root = document.documentElement
  root.setAttribute('data-theme', next)
  root.style.colorScheme = next
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[next])
}

function publish(next: Theme): void {
  theme = next
  apply(next)
  for (const listener of listeners) listener()
}

apply(theme)
try {
  darkQuery()?.addEventListener('change', (e) => {
    if (!userPicked) publish(e.matches ? 'dark' : 'light')
  })
} catch {
  /* older browsers: the theme simply stays where it started */
}

function setTheme(next: Theme): void {
  userPicked = true
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {
    /* storage unavailable */
  }
  publish(next)
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** Light/dark theme, persisted to localStorage and reflected as data-theme on <html>. */
export function useTheme() {
  return { theme: useSyncExternalStore(subscribe, () => theme), setTheme }
}
