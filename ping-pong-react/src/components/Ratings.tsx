import { useMemo, useState } from 'react'
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react'
import { useRatings, type RatingEvent } from '../hooks/useRatings'
import { RATING } from '../lib/rating'
import {
  STREAK_BADGE_MIN,
  lastFive,
  lastRatedAt,
  recordOf,
  weeklyDelta,
  winStreak,
} from '../lib/classement'
import { relativeTime } from '../lib/format'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'
import { playerHistory } from '../lib/playerHistory'
import Avatar from './Avatar'
import PlayerModal from './PlayerModal'

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

const STAKES_LABEL: Record<RatingEvent['stakes'], string | null> = {
  normal: null,
  final: 'Finale',
  grand_final: 'Grande finale 🏆',
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

interface Props {
  onHome: () => void
  onStats: () => void
  onPlayers: () => void
  onNew: () => void
  onNewGame: () => void
}

export default function Ratings({ onHome, onStats, onPlayers, onNew, onNewGame }: Props) {
  const { rows, events, matchCount, loading, error, recompute } = useRatings()
  const [mode, setMode] = useState<'board' | 'log'>('board')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const leader = rows.find((r) => !r.provisional) ?? rows[0]
  const ranked = rows.filter((r) => !r.provisional)
  const updatedAt = lastRatedAt(events)

  const tableRows = useMemo(() => {
    const now = new Date()
    return rows.map((r) => ({
      ...r,
      record: recordOf(events, r.key),
      form: lastFive(events, r.key),
      streak: winStreak(events, r.key),
      delta7: weeklyDelta(events, r.key, now),
    }))
  }, [rows, events])

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
      {
        at: string | null
        stakes: RatingEvent['stakes']
        weight: number
        winner?: RatingEvent
        loser?: RatingEvent
      }
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

  const nav = (
    <DashboardNav
      active="classement"
      onHome={onHome}
      onStats={onStats}
      onPlayers={onPlayers}
      onNew={onNew}
      onNewGame={onNewGame}
    />
  )
  const tabbar = (
    <DashboardTabBar
      active="classement"
      onHome={onHome}
      onStats={onStats}
      onPlayers={onPlayers}
      onNew={onNew}
      onNewGame={onNewGame}
    />
  )

  if (loading) {
    return (
      <div className="rv-page">
        {nav}
        <p className="empty">Chargement…</p>
        {tabbar}
      </div>
    )
  }

  return (
    <div className="rv-page">
      {nav}

      {error && <div className="error-banner">Erreur : {error}</div>}

      <div className="cl-head">
        <h1 className="cl-title">Classement Elo</h1>
        <p className="cl-sub">
          Classement général
          {updatedAt && ` · dernière mise à jour ${relativeTime(updatedAt, new Date())}`}
        </p>
      </div>

      {rows.length === 0 ? (
        <section>
          <div className="empty">
            Pas encore de classement. Joue quelques matchs pour démarrer les notes Elo !
          </div>
          <div className="footer-row">
            <span />
            <button className="link-btn" onClick={onHome}>
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
                      <span
                        className="rt-log-weight"
                        title="Poids du match : marge au score × enjeu"
                      >
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
          <div className="cl-tiles">
            <div className="cl-tile">
              <div className="cl-tile-num">{ranked.length}</div>
              <div className="cl-tile-lbl">Joueurs classés</div>
            </div>
            <div className="cl-tile">
              <div className="cl-tile-num">{matchCount}</div>
              <div className="cl-tile-lbl">Matchs notés</div>
            </div>
            <div className="cl-tile">
              <div className="cl-tile-num">{leader ? Math.round(leader.rating) : '—'}</div>
              <div className="cl-tile-lbl">{leader ? `Meneur · ${leader.name}` : 'Meneur'}</div>
            </div>
          </div>

          <section>
            <div className="cl-sec-head">
              <div className="cl-sec-title">Tous les joueurs</div>
              <div className="cl-sec-actions">
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
                >
                  <IconRefresh size={15} stroke={1.8} /> Recalculer
                </button>
              </div>
            </div>
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
              {tableRows.map((r) => (
                <div
                  key={r.key}
                  className="cl-tr cl-row"
                  onClick={() => setSelectedKey(r.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedKey(r.key)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Voir l'historique de ${r.name}`}
                >
                  <span
                    className={`cl-c-rank${
                      r.provisional ? ' prov' : r.rank <= 3 ? ` p${r.rank}` : ''
                    }`}
                  >
                    {r.provisional ? '—' : r.rank}
                  </span>
                  <span className="cl-c-avatar">
                    <Avatar name={r.name} team={r.team} url={r.avatar_url} className="sm" />
                  </span>
                  <span className="cl-c-name">
                    <span className="cl-name-text">{r.name}</span>
                    {!r.provisional && r.streak >= STREAK_BADGE_MIN && (
                      <span className="cl-badge cl-badge-streak">{r.streak} victoires</span>
                    )}
                    {r.provisional && <span className="cl-badge cl-badge-prov">Provisoire</span>}
                  </span>
                  <span className="cl-c-form">
                    {r.provisional ? (
                      <span className="cl-form-count">
                        {r.games} / {RATING.provisionalGames} matchs
                      </span>
                    ) : (
                      r.form.map((won, i) => <i key={i} className={`cl-dot ${won ? 'w' : 'l'}`} />)
                    )}
                  </span>
                  <span className="cl-c-rec">
                    {r.record.wins}–{r.record.losses}
                  </span>
                  <span className="cl-c-games">{r.games}</span>
                  <span
                    className={`cl-c-elo${
                      r.provisional ? ' prov' : r.key === leader?.key ? ' lead' : ''
                    }`}
                  >
                    {r.provisional ? `~${Math.round(r.rating)}` : Math.round(r.rating)}
                  </span>
                  <span className="cl-c-delta">
                    <Trend delta={r.delta7} />
                  </span>
                </div>
              ))}
            </div>
            <p className="cl-note">
              Un joueur entre au classement après {RATING.provisionalGames} matchs. Avant cela, son
              Elo provisoire s'affiche en gris.
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
                Une <b>longue absence ne fait pas baisser ta note</b>, mais élargit ton
                «&nbsp;±&nbsp;». Comme le classement tient compte de cette fiabilité, ton{' '}
                <b>rang peut reculer</b>
                malgré une note inchangée — et après quelques semaines sans jouer tu repasses
                «&nbsp;provisoire&nbsp;». À ton retour, cette marge plus large fait que tes premiers
                matchs comptent davantage et la note retrouve vite son niveau.
              </p>
              <p>
                Le <b>rang</b> combine la note et sa fiabilité, pour qu'une note vite acquise ne
                double pas une note bien établie. Le tout repose sur le système <b>Glicko-2</b>. Le{' '}
                <b>journal des calculs</b> détaille chaque match, un par un.
              </p>
            </div>
          </section>

          <div className="footer-row">
            <span className="hint">Notes Glicko-2 · parties rapides et tournois confondus.</span>
            <button className="link-btn" onClick={onHome}>
              <IconArrowLeft size={16} stroke={1.8} /> Accueil
            </button>
          </div>
        </>
      )}

      {(() => {
        const selected = selectedKey ? rows.find((r) => r.key === selectedKey) : undefined
        if (!selected) return null
        return (
          <PlayerModal
            row={selected}
            history={playerHistory(events, rows, selected.key)}
            onClose={() => setSelectedKey(null)}
          />
        )
      })()}
      {tabbar}
    </div>
  )
}
