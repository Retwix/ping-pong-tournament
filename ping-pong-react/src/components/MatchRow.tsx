import type { Match } from '../types'

interface Props {
  match: Match
  /** Tournament/game name this match belongs to (optional). */
  context?: string
  /** Open the match's tournament board. */
  onOpen?: () => void
  /** Render as an in-progress match: live score, "en cours" marker, no winner. */
  live?: boolean
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

/**
 * One match row: the two players and the score. For a finished match the winner is
 * bolded and the meta shows when it was played; for a live match (`live`) neither
 * side is bolded and the meta carries an "en cours" marker instead of a date.
 */
export default function MatchRow({ match: m, context, onOpen, live }: Props) {
  const aWin = !live && m.score_a > m.score_b
  const bWin = !live && m.score_b > m.score_a
  const date = fmtDate(m.ended_at ?? m.started_at)
  return (
    <button className={`match-row${live ? ' is-live' : ''}`} onClick={onOpen} disabled={!onOpen}>
      <div className="mr-main">
        <span className={`mr-name${aWin ? ' win' : ''}`}>{m.player_a}</span>
        <span className="mr-sc">
          {m.score_a}–{m.score_b}
        </span>
        <span className={`mr-name end${bWin ? ' win' : ''}`}>{m.player_b}</span>
      </div>
      <div className="mr-sub">
        {live ? (
          <>
            <span className="mr-live">
              <span className="pulse-dot coral" /> En cours
            </span>
            {context ? ` · ${context}` : ''}
          </>
        ) : context ? (
          `${context} · ${date}`
        ) : (
          date
        )}
      </div>
    </button>
  )
}
