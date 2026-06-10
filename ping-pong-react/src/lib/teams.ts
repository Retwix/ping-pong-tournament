export const TEAMS = [
  { key: 'tech', label: 'Tech', color: '#2BA572' },
  { key: 'support', label: 'Customer Support', color: '#D74251' },
  { key: 'marketing', label: 'Marketing', color: '#AB54D4' },
  { key: 'sales', label: 'Sales', color: '#F0913A' },
  { key: 'business', label: 'Business', color: '#8663E9' },
  { key: 'guests', label: 'Guests', color: '#5B8DEF' },
] as const

export type TeamKey = (typeof TEAMS)[number]['key']

export function teamLabel(key: string): string {
  return TEAMS.find((t) => t.key === key)?.label ?? key
}

export function teamColor(key: string): string {
  return TEAMS.find((t) => t.key === key)?.color ?? '#8E889C'
}
