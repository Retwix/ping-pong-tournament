import { useLeaderboard } from '../hooks/useLeaderboard'
import TopBack from './TopBack'
import ThemeToggle from './ThemeToggle'

interface Props {
  onBack: () => void
}

/**
 * The pronostics standings (/pronos) — ranks bettors by correct calls, then accuracy
 * and longest win streak. No money involved: it's pure bragging rights. Settles any
 * freshly-decided bets on load, then stays live.
 */
export default function Leaderboard({ onBack }: Props) {
  const { rows, loading, error } = useLeaderboard()

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

  return (
    <div className="wrap">
      <TopBack onClick={onBack} label="Accueil" />
      <header>
        <ThemeToggle className="header-toggle" />
        <div className="kicker">Pronostics</div>
        <h1>
          Les <span className="em">parieurs</span>
        </h1>
        <p className="subtitle">
          Qui devine le mieux ? Classement par bons pronos, puis réussite et série de
          victoires. Sans argent — juste l'honneur. 🔮
        </p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section>
        {loading ? (
          <div className="empty">Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            Aucun prono pour l'instant. Ouvre un tournoi et lance les paris !
          </div>
        ) : (
          <div className="panel prono-board">
            <div className="prono-board-head">
              <span className="lb-rank">#</span>
              <span className="lb-name">Parieur</span>
              <span className="lb-cell">Bons</span>
              <span className="lb-cell">Réussite</span>
              <span className="lb-cell">Série</span>
            </div>
            {rows.map((r, i) => (
              <div className="prono-board-row" key={r.name}>
                <span className="lb-rank">{medal(i)}</span>
                <span className="lb-name lb-player">
                  {r.name}
                  {r.open > 0 && <span className="prono-pending">{r.open} en attente</span>}
                </span>
                <span className="lb-cell">
                  <b>{r.correct}</b>
                  <span className="lb-sub">/ {r.total}</span>
                </span>
                <span className="lb-cell">
                  {r.total ? `${Math.round(r.accuracy * 100)}%` : '—'}
                </span>
                <span className="lb-cell">
                  {r.currentStreak > 1 ? `🔥 ${r.currentStreak}` : r.longestStreak > 0 ? `↑ ${r.longestStreak}` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="footer-row">
          <span className="hint">
            « Série » = victoires d'affilée en cours (🔥), sinon ton record (↑).
          </span>
          <button className="link-btn" onClick={onBack}>
            ← Accueil
          </button>
        </div>
      </section>
    </div>
  )
}
