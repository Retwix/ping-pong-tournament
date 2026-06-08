export const TEAMS = [
  { key: 'tech', label: 'Tech' },
  { key: 'support', label: 'Customer Support' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'sales', label: 'Sales' },
  { key: 'business', label: 'Business' },
  { key: 'guests', label: 'Guests' },
] as const

export type TeamKey = (typeof TEAMS)[number]['key']

export function teamLabel(key: string): string {
  return TEAMS.find((t) => t.key === key)?.label ?? key
}
