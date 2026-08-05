import type { Tournament } from '../types'

/**
 * Header label for what is being played: quick game (« · Double » when 2v2)
 * or the tournament format.
 */
export function libelleFormat(t: Pick<Tournament, 'kind' | 'format' | 'doubles'>): string {
  if (t.kind === 'game') return t.doubles ? 'Partie rapide · Double' : 'Partie rapide'
  return t.format === 'double_elim' ? 'Élimination directe' : 'Round-robin'
}

/**
 * A signed integer for display — Elo moves, point differentials — in the app's
 * house idiom: a plus on gains, a real minus sign (−, not a hyphen) on losses,
 * and ±0 for nothing either way. Rounds first, so a value that rounds to zero
 * never shows a stray minus.
 */
export function signed(value: number): string {
  const v = Math.round(value)
  if (v === 0) return '±0'
  return v > 0 ? `+${v}` : `−${Math.abs(v)}`
}

/**
 * A short French "time ago" label for a match's timestamp. Sub-minute reads as
 * "à l'instant"; then minutes, hours, days; beyond a week it falls back to a
 * short localized date. `now` is injected so the formatting is pure/testable.
 */
export function relativeTime(iso: string | null, now: Date): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.floor((now.getTime() - then) / 1000))
  if (secs < 60) return "à l'instant"
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}
