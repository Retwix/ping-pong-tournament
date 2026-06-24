import { useMemo } from 'react'
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react'
import { useRatings } from '../hooks/useRatings'
import { RATING } from '../lib/rating'
import { teamColor } from '../lib/teams'
import TopBack from './TopBack'
import ThemeToggle from './ThemeToggle'

function Avatar({ name, team }: { name: string; team: string | null }) {
  const color = teamColor(team ?? '')
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  return (
    <span className="avatar sm" style={{ background: `${color}24`, color }}>
      {initial}
    </span>
  )
}

function Trend({ delta }: { delta: number }) {
  const v = Math.round(delta)
  if (v === 0) return <span className="rt-trend flat">–</span>
  const up = v > 0
  return (
    <span className={`rt-trend ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {Math.abs(v)}
    </span>
  )
}

export default function Ratings({ onBack }: { onBack: () => void }) {
  const { rows, events, matchCount, loading, error, recompute } = useRatings()

  const leader = rows.find((r) => !r.provisional) ?? rows[0]

  // Highlights drawn from the rating history.
  const { biggestWin, biggestFinal } = useMemo(() => {
    let biggestWin: (typeof events)[number] | null = null
    let biggestFinal: (typeof events)[number] | null = null
    for (const e of events) {
      if (e.delta > 0 && (!biggestWin || e.delta > biggestWin.delta)) biggestWin = e
      if (e.stakes !== 'normal' && e.delta > 0 && (!biggestFinal || e.delta > biggestFinal.delta))
        biggestFinal = e
    }
    return { biggestWin, biggestFinal }
  }, [events])

  const header = (
    <>
      <TopBack onClick={onBack} label="Accueil" />
      <header>
        <ThemeToggle className="header-toggle" />
        <div className="eyebrow">Classement Elo</div>
        <h1>
          Le <span className="em">classement</span>
        </h1>
        <p className="subtitle">
          Force réelle de chaque joueur, calculée avec le système Glicko-2. L'écart du score
          (et les finales) pèse plus lourd. Le rang combine la note et sa fiabilité.
        </p>
      </header>
    </>
  )

  if (loading) {
    return (
      <div className="wrap">
        {header}
        <p className="empty">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="wrap">
      {header}

      {error && <div className="error-banner">Erreur : {error}</div>}

      {rows.length === 0 ? (
        <section>
          <div className="empty">
            Pas encore de classement. Joue quelques matchs pour démarrer les notes Elo !
          </div>
          <div className="footer-row">
            <span />
            <button className="link-btn" onClick={onBack}>
              <IconArrowLeft size={16} stroke={1.8} /> Accueil
            </button>
          </div>
        </section>
      ) : (
        <>
          <section>
            <div className="kpi-strip">
              <div className="kpi">
                <div className="num">{rows.length}</div>
                <div className="lbl">Joueurs classés</div>
              </div>
              <div className="kpi">
                <div className="num">{matchCount}</div>
                <div className="lbl">Matchs notés</div>
              </div>
              <div className="kpi">
                <div className="num">{leader ? Math.round(leader.rating) : '—'}</div>
                <div className="lbl">{leader ? `Meneur · ${leader.name}` : 'Meneur'}</div>
              </div>
            </div>
          </section>

          <section>
            <div className="section-title with-toggle">
              Notes Elo
              <button
                className="link-btn"
                onClick={recompute}
                title="Recalculer et enregistrer les notes"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <IconRefresh size={15} stroke={1.8} /> Recalculer
              </button>
            </div>
            <div className="panel">
              <table className="leaderboard rating-board">
                <thead>
                  <tr>
                    <th className="left">Joueur</th>
                    <th>Elo</th>
                    <th>Fiabilité</th>
                    <th>Tendance</th>
                    <th>J</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className={r.provisional ? '' : `r${r.rank}`}>
                      <td className="left">
                        <span className="rank">{r.rank}</span>
                        <span className="lb-player">
                          <Avatar name={r.name} team={r.team} />
                          {r.name}
                          {r.provisional && <span className="rt-prov">provisoire</span>}
                        </span>
                      </td>
                      <td>
                        <span className="rt-rating">{Math.round(r.rating)}</span>
                      </td>
                      <td>
                        <span className="rt-rd">± {Math.round(r.rd)}</span>
                      </td>
                      <td>
                        <Trend delta={r.trend} />
                      </td>
                      <td>{r.games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="setup-hint" style={{ textAlign: 'left' }}>
              « Fiabilité » est la marge d'incertitude (± points) : elle se resserre avec les
              matchs. Un joueur reste « provisoire » sous {RATING.provisionalGames} matchs ou tant
              que sa marge dépasse {RATING.provisionalRd}.
            </p>
          </section>

          {(biggestWin || biggestFinal) && (
            <section>
              <div className="section-title">Faits marquants</div>
              <div className="super-grid">
                {biggestWin && (
                  <div className="super-card">
                    <div className="sc-label">Plus gros gain</div>
                    <div className="sc-value">+{Math.round(biggestWin.delta)}</div>
                    <div className="sc-sub">
                      {biggestWin.name} bat {biggestWin.opponentName}
                    </div>
                  </div>
                )}
                {biggestFinal && (
                  <div className="super-card">
                    <div className="sc-label">Plus gros gain en finale 🏆</div>
                    <div className="sc-value">+{Math.round(biggestFinal.delta)}</div>
                    <div className="sc-sub">
                      {biggestFinal.name} vs {biggestFinal.opponentName}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="footer-row">
            <span className="hint">Notes Glicko-2 · parties rapides et tournois confondus.</span>
            <button className="link-btn" onClick={onBack}>
              <IconArrowLeft size={16} stroke={1.8} /> Accueil
            </button>
          </div>
        </>
      )}
    </div>
  )
}
