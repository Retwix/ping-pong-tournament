import { useCallback, useState } from 'react'
import { normalizeName } from '../lib/predictions'

const KEY = 'pp_bettor_name'

/**
 * Remembers the name the bettor chose so they don't retype it every visit.
 * No auth — it's just a convenience stored in the browser. Trust-based by design.
 */
export function useBettorName() {
  const [name, setNameState] = useState<string>(() => {
    try {
      return localStorage.getItem(KEY) ?? ''
    } catch {
      return ''
    }
  })

  const setName = useCallback((raw: string) => {
    const value = normalizeName(raw)
    setNameState(value)
    try {
      if (value) localStorage.setItem(KEY, value)
      else localStorage.removeItem(KEY)
    } catch {
      /* storage unavailable — keep it in memory for this session */
    }
  }, [])

  return { name, setName }
}
