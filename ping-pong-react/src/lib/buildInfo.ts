export interface BuildInfo {
  sha: string
  builtAt: string
}

const PARIS_TIME = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** Short "which build is this?" label, e.g. "edf87f7 · 01/10 10:45". */
export function buildLabel({ sha, builtAt }: BuildInfo): string {
  const commit = sha ? sha.slice(0, 7) : 'dev'
  return `${commit} · ${PARIS_TIME.format(new Date(builtAt))}`
}
