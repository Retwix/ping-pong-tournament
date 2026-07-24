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
