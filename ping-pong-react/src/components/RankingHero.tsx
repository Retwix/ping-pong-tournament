import { useMemo } from 'react'
import { IconCrown } from '@tabler/icons-react'
import { useRatings } from '../hooks/useRatings'
import Avatar from './Avatar'
import Trend from './Trend'

interface Props {
  /** Open the full Classement view (/classement). */
  onFull: () => void
}

const MEDAL = ['gold', 'silver', 'bronze'] as const
const RING = { 1: '#e8b53a', 2: '#aeb6c0', 3: '#cb8e5e' } as const

/**
 * The dashboard hero: the Elo ranking rendered as content. Top-3 podium, then a
 * preview of ranks 4–7, then a link to the full Classement. Lives on `useRatings`,
 * the same engine the dedicated view uses, so it's always current.
 */
export default function RankingHero({ onFull }: Props) {
  const { rows, events, loading } = useRatings()

  // Win/loss record per player, derived from the rating history.
  const winLoss = useMemo(() => {
    const m = new Map<string, { w: number; l: number }>()
    for (const e of events) {
      const r = m.get(e.key) ?? { w: 0, l: 0 }
      if (e.won) r.w++
      else r.l++
      m.set(e.key, r)
    }
    return m
  }, [events])

  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3, 7)
  // Podium reads 2 · 1 · 3 so the leader sits centre and tallest.
  const podium = [top3[1], top3[0], top3[2]]

  return (
    <div className="rank-card">
      <div className="rank-head">
        <div className="title">
          <span className="pulse-dot coral" /> Classement Elo
        </div>
        <div className="meta">
          {rows.length > 0 ? `Saison en cours · ${rows.length} joueurs` : 'Saison en cours'}
        </div>
      </div>

      {loading ? (
        <div className="empty" style={{ border: 'none', padding: '40px 0' }}>
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="empty" style={{ border: 'none', padding: '40px 0' }}>
          Pas encore de classement. Jouez quelques matchs pour lancer les notes Elo !
        </div>
      ) : (
        <>
          <div className="podium">
            {podium.map((r, i) =>
              r ? (
                <div className={`podium-col${r.rank === 1 ? ' first' : ''}`} key={r.key}>
                  {r.rank === 1 && (
                    <div className="podium-crown">
                      <IconCrown size={20} stroke={1.6} />
                    </div>
                  )}
                  <div className="podium-av">
                    <Avatar
                      name={r.name}
                      team={r.team}
                      px={r.rank === 1 ? 58 : 46}
                      style={{
                        border: `${r.rank === 1 ? 3 : 2.5}px solid ${RING[r.rank as 1 | 2 | 3] ?? RING[3]}`,
                        boxShadow: r.rank === 1 ? '0 10px 22px rgba(74,42,164,.3)' : undefined,
                      }}
                    />
                  </div>
                  <div className="podium-name">{r.name}</div>
                  <div className="podium-elo">{Math.round(r.rating)}</div>
                  <div className={`podium-bar ${MEDAL[r.rank - 1] ?? 'bronze'}`}>{r.rank}</div>
                </div>
              ) : (
                <div className="podium-col" key={`empty-${i}`} />
              )
            )}
          </div>

          {rest.length > 0 && (
            <div className="rank-rows">
              {rest.map((r) => {
                const wl = winLoss.get(r.key)
                return (
                  <div className="rank-row" key={r.key}>
                    <span className="rk">{r.rank}</span>
                    <Avatar name={r.name} team={r.team} px={34} />
                    <span className="nm">{r.name}</span>
                    <span className="rec">{wl ? `${wl.w} V · ${wl.l} D` : '—'}</span>
                    <span className="elo">{Math.round(r.rating)}</span>
                    <span className="tr">
                      <Trend delta={r.trend} />
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="rank-foot">
            <button onClick={onFull}>Classement complet →</button>
          </div>
        </>
      )}
    </div>
  )
}
