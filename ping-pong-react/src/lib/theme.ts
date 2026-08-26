export type Theme = 'light' | 'dark'

/** localStorage key holding the user's own pick (absent while they follow the device). */
export const THEME_KEY = 'rv-theme'

/**
 * What `<meta name="theme-color">` becomes per theme — the colour the browser
 * and the installed PWA paint behind the status bar. Light keeps the brand
 * purple; dark matches `--bg` so the app doesn't wear a bright hat at night.
 */
export const THEME_COLORS: Record<Theme, string> = {
  light: '#4A2AA4',
  dark: '#0c0f14',
}

/** A stored value, or null when nothing (or something bogus) is stored. */
export function parseTheme(value: string | null): Theme | null {
  return value === 'light' || value === 'dark' ? value : null
}

/**
 * The theme to show: the user's own pick wins, otherwise the device's
 * preference — an installed PWA opens in dark on a phone set to dark.
 */
export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  return parseTheme(stored) ?? (prefersDark ? 'dark' : 'light')
}
