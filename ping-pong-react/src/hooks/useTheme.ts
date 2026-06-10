import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'rv-theme'

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'light' || t === 'dark') return t
  } catch {
    /* storage unavailable */
  }
  return 'light'
}

/** Light/dark theme, persisted to localStorage and reflected as data-theme on <html>. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])

  return { theme, setTheme }
}
