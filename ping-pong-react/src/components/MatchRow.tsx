import type { Match } from '../types'

interface Props {
  match: Match
  /** Tournament/game name this match belongs to (optional). */
  context?: string
  /** Open the match's tournament board. */
  onOpen?: () => void
}

function fmtDate(at: string | null): string {
  if (!at) return '—'
  const d = new Date(at)
  return (
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
}

/** One finished match: the two players, the score (winner bolded), and meta. */
export default function MatchRow({ match: m, context, onOpen }: Props) {
  const aWin = m.score_a > m.score_b
  const date = fmtDate(m.ended_at ?? m.started_at)
  return (
    <button className="match-row" onClick={onOpen} disabled={!onOpen}>
      <div className="mr-main">
        <span className={`mr-name${aWin ? ' win' : ''}`}>{m.player_a}</span>
        <span className="mr-sc">
          {m.score_a}–{m.score_b}
        </span>
        <span className={`mr-name end${!aWin ? ' win' : ''}`}>{m.player_b}</span>
      </div>
      <div className="mr-sub">{context ? `${context} · ${date}` : date}</div>
    </button>
  )
}
