import { useEffect, useRef } from 'react'
import { RATING } from '../lib/rating'
import { STREAK_BADGE_MIN, type PlayerRecord } from '../lib/classement'
import type { LadderRow } from '../lib/inactivity'
import Avatar from './Avatar'
import Trend from './Trend'

export type ClassementRow = LadderRow & {
  record: PlayerRecord
  form: boolean[]
  streak: number
  delta7: number
}

export default function ClassementTable({
  rows,
  leaderKey,
  ownKey,
  onSelect,
}: {
  rows: ClassementRow[]
  leaderKey: string | undefined
  ownKey?: string
  onSelect: (key: string) => void
}) {
  const ownRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ownRowRef.current?.scrollIntoView({ block: 'center' })
  }, [ownKey])

  return (
    <div className="cl-table">
      <div className="cl-tr cl-thead">
        <span className="cl-c-rank">#</span>
        <span className="cl-c-avatar" />
        <span className="cl-c-name">Joueur</span>
        <span className="cl-c-form">Forme</span>
        <span className="cl-c-rec">V–D</span>
        <span className="cl-c-games">Matchs</span>
        <span className="cl-c-elo">Elo</span>
        <span className="cl-c-delta">7 j</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.key}
          ref={r.key === ownKey ? ownRowRef : undefined}
          className="cl-tr cl-row"
          onClick={() => onSelect(r.key)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelect(r.key)
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Voir l'historique de ${r.name}`}
        >
          <span
            className={`cl-c-rank${
              r.daysIdle !== null
                ? ' idle'
                : r.provisional
                  ? ' prov'
                  : r.rank <= 3
                    ? ` p${r.rank}`
                    : ''
            }`}
          >
            {r.provisional || r.daysIdle !== null ? '—' : r.rank}
          </span>
          <span className="cl-c-avatar">
            <Avatar name={r.name} team={r.team} url={r.avatar_url} className="sm" />
          </span>
          <span className="cl-c-name">
            <span className="cl-name-text">{r.name}</span>
            {r.key === ownKey && <span className="cl-badge cl-badge-me">toi</span>}
            {!r.provisional && r.daysIdle === null && r.streak >= STREAK_BADGE_MIN && (
              <span className="cl-badge cl-badge-streak">{r.streak} victoires</span>
            )}
            {r.provisional && (
              <span className="cl-badge cl-badge-prov">Provisoire</span>
            )}
          </span>
          <span className="cl-c-form">
            {r.daysIdle !== null ? (
              <span className="cl-form-count">inactif depuis {r.daysIdle} j</span>
            ) : r.provisional ? (
              <span className="cl-form-count">
                {r.games} / {RATING.provisionalGames} matchs
              </span>
            ) : (
              r.form.map((won, i) => (
                <i key={i} className={`cl-dot ${won ? 'w' : 'l'}`} />
              ))
            )}
          </span>
          <span className="cl-c-rec">
            {r.record.wins}–{r.record.losses}
          </span>
          <span className="cl-c-games">{r.games}</span>
          <span
            className={`cl-c-elo${
              r.provisional || r.daysIdle !== null
                ? ' prov'
                : r.key === leaderKey
                  ? ' lead'
                  : ''
            }`}
          >
            {r.provisional ? `~${Math.round(r.rating)}` : Math.round(r.rating)}
          </span>
          <span className="cl-c-delta">
            <Trend delta={r.delta7} />
          </span>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="cl-empty-row">
          Aucun joueur trouvé. Essaie un autre nom ou une autre équipe.
        </div>
      )}
    </div>
  )
}
