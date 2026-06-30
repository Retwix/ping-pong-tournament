import { useLiveMatch } from '../hooks/useLiveMatch'

interface Props {
  /** Spectator display of the live match (/live). Also used as the idle "présentation" link. */
  onWatch: () => void
  /** Referee mode for the live match (/ref). */
  onRef: () => void
}

/**
 * Contextual live-match banner with three states: full-colour with matchup + score
 * and two CTAs while a match is on the table; a calmer "about to start" banner —
 * still navigable, so a referee can open a match before the first point; and a thin
 * muted line when nothing is on.
 */
export default function LiveBanner({ onWatch, onRef }: Props) {
  const { live } = useLiveMatch()

  if (!live) {
    return (
      <div className="live-banner">
        <div className="live-idle">
          <span className="idot" />
          Aucun match en cours
          <button className="present" onClick={onWatch}>
            Présentation →
          </button>
        </div>
      </div>
    )
  }

  const { match: m, tournament: t, status } = live

  if (status === 'upcoming') {
    return (
      <div className="live-banner">
        <div className="live-upcoming">
          <div className="lb-left">
            <span className="up-flag">VA COMMENCER</span>
            <span className="live-sep" />
            <div style={{ minWidth: 0 }}>
              <div className="up-match">
                {m.player_a} <span className="vs">vs</span> {m.player_b}
              </div>
              <div className="up-sub">
                Manche {m.round} · jeu en {t.target} · en attente du 1er point
              </div>
            </div>
          </div>
          <div className="live-cta">
            <button className="ref-primary" onClick={onRef}>
              Arbitrer
            </button>
            <button className="watch-ghost" onClick={onWatch}>
              Regarder
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="live-banner">
      <div className="live-active">
        <div className="lb-left">
          <span className="lb-flag">
            <span className="pulse-dot white" />
            <span className="live-flag">EN DIRECT</span>
          </span>
          <span className="live-sep" />
          <div style={{ minWidth: 0 }}>
            <div className="live-match">
              {m.player_a} <span className="sc">{m.score_a}</span> — <span className="sc">{m.score_b}</span> {m.player_b}
            </div>
            <div className="live-sub">
              Manche {m.round} · jeu en {t.target}
            </div>
          </div>
        </div>
        <div className="live-cta">
          <button className="watch" onClick={onWatch}>
            Regarder
          </button>
          <button className="ref" onClick={onRef}>
            Arbitrer
          </button>
        </div>
      </div>
    </div>
  )
}
