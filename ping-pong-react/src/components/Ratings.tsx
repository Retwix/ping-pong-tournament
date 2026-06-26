import { useMemo, useState } from 'react'
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react'
import { useRatings, type RatingEvent } from '../hooks/useRatings'
import { RATING } from '../lib/rating'
import Avatar from './Avatar'
import Trend from './Trend'
import TopBack from './TopBack'
import ThemeToggle from './ThemeToggle'

const STAKES_LABEL: Record<RatingEvent['stakes'], string | null> = {
  normal: null,
  final: 'Finale',
  grand_final: 'Grande finale 🏆',
}

function fmtDate(at: string | null): string {
  if (!at) return '—'
  const d = new Date(at)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** One line of a log entry: a player's score and rating move for that match. */
function LogLine({ e, win }: { e: RatingEvent; win: boolean }) {
  return (
    <div className={`rt-log-line${win ? ' win' : ''}`}>
      <span className="rt-log-name">{e.name}</span>
      <span className="rt-log-score">
        {e.scoreFor}–{e.scoreAgainst}
      </span>
      <span className="rt-log-move">
        {Math.round(e.ratingBefore)} → <b>{Math.round(e.ratingAfter)}</b>
      </span>
      <Trend delta={e.delta} />
    </div>
  )
}

export default function Ratings({ onBack }: { onBack: () => void }) {
  const { rows, events, matchCount, loading, error, recompute } = useRatings()
  const [mode, setMode] = useState<'board' | 'log'>('board')

  const leader = rows.find((r) => !r.provisional) ?? rows[0]

  // Highlights drawn from the rating history.
  const { biggestWin, biggestFinal } = useMemo(() => {
    let biggestWin: RatingEvent | null = null
    let biggestFinal: RatingEvent | null = null
    for (const e of events) {
      if (e.delta > 0 && (!biggestWin || e.delta > biggestWin.delta)) biggestWin = e
      if (e.stakes !== 'normal' && e.delta > 0 && (!biggestFinal || e.delta > biggestFinal.delta))
        biggestFinal = e
    }
    return { biggestWin, biggestFinal }
  }, [events])

  // Group the two events of each match into one log entry, newest first.
  const logEntries = useMemo(() => {
    const byMatch = new Map<
      string,
      { at: string | null; stakes: RatingEvent['stakes']; weight: number; winner?: RatingEvent; loser?: RatingEvent }
    >()
    const order: string[] = []
    for (const e of events) {
      let g = byMatch.get(e.matchId)
      if (!g) {
        g = { at: e.at, stakes: e.stakes, weight: e.weight }
        byMatch.set(e.matchId, g)
        order.push(e.matchId)
      }
      if (e.won) g.winner = e
      else g.loser = e
    }
    return order
      .map((id) => ({ matchId: id, ...byMatch.get(id)! }))
      .filter((g) => g.winner && g.loser)
      .reverse()
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
      ) : mode === 'log' ? (
        <>
          <section>
            <div className="section-title with-toggle">
              Journal des calculs
              <button className="link-btn" onClick={() => setMode('board')}>
                <IconArrowLeft size={15} stroke={1.8} /> Classement
              </button>
            </div>
            <p className="setup-hint" style={{ textAlign: 'left', marginTop: 0 }}>
              Chaque match, du plus récent au plus ancien : la note <b>avant → après</b> de chaque
              joueur, et le <b>poids</b> appliqué (marge au score × enjeu).
            </p>
            <div className="rt-log-list">
              {logEntries.map((g) => {
                const label = STAKES_LABEL[g.stakes]
                return (
                  <div className="panel rt-log" key={g.matchId}>
                    <div className="rt-log-head">
                      <span className="rt-log-date">{fmtDate(g.at)}</span>
                      {label && <span className={`rt-stakes ${g.stakes}`}>{label}</span>}
                      <span className="rt-log-weight" title="Poids du match : marge au score × enjeu">
                        poids ×{g.weight.toFixed(2)}
                      </span>
                    </div>
                    <LogLine e={g.winner!} win />
                    <LogLine e={g.loser!} win={false} />
                  </div>
                )
              })}
            </div>
          </section>

          <div className="footer-row">
            <span className="hint">{logEntries.length} matchs notés.</span>
            <button className="link-btn" onClick={() => setMode('board')}>
              <IconArrowLeft size={16} stroke={1.8} /> Classement
            </button>
          </div>
        </>
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
              <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12 }}>
                <button
                  className="link-btn"
                  onClick={() => setMode('log')}
                  title="Voir comment chaque match a fait évoluer les notes"
                >
                  Journal des calculs →
                </button>
                <button
                  className="link-btn"
                  onClick={recompute}
                  title="Recalculer et enregistrer les notes"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <IconRefresh size={15} stroke={1.8} /> Recalculer
                </button>
              </div>
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
                          <Avatar name={r.name} team={r.team} size="sm" />
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

          <section>
            <div className="section-title">Comment ça marche ?</div>
            <div className="panel rt-explain">
              <p>
                Chaque joueur démarre à <b>1500</b>. Après un match, le vainqueur prend des points
                au perdant : battre un joueur mieux classé en rapporte beaucoup, battre un joueur
                moins bien classé très peu.
              </p>
              <p>
                L'<b>écart au score</b> compte — un 11–2 fait bouger les notes plus qu'un 11–9 — et
                les <b>finales</b> de tournoi pèsent encore plus lourd, surtout la grande finale 🏆.
              </p>
              <p>
                Le <b>«&nbsp;±&nbsp;»</b> est la marge d'incertitude : elle se resserre au fil des
                matchs. Tant qu'elle reste élevée (ou sous {RATING.provisionalGames} matchs), la
                note est <b>provisoire</b>.
              </p>
              <p>
                Une <b>longue absence ne fait pas baisser ta note</b>, mais élargit ton «&nbsp;±&nbsp;».
                Comme le classement tient compte de cette fiabilité, ton <b>rang peut reculer</b>
                malgré une note inchangée — et après quelques semaines sans jouer tu repasses
                «&nbsp;provisoire&nbsp;». À ton retour, cette marge plus large fait que tes premiers
                matchs comptent davantage et la note retrouve vite son niveau.
              </p>
              <p>
                Le <b>rang</b> combine la note et sa fiabilité, pour qu'une note vite acquise ne
                double pas une note bien établie. Le tout repose sur le système <b>Glicko-2</b>.
                Le <b>journal des calculs</b> détaille chaque match, un par un.
              </p>
            </div>
          </section>

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
