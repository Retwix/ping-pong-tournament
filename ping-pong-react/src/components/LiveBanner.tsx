import { useLiveMatch } from '../hooks/useLiveMatch'

interface Props {
  /** Spectator display of the live match (/live). Also used as the idle "présentation" link. */
  onWatch: () => void
  /** Referee mode for the live match (/ref). */
  onRef: () => void
}

/**
 * Contextual live-match banner. Full-colour with matchup + score and two CTAs
 * while a match is on the table; collapses to a thin muted line otherwise.
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

  const { match: m, tournament: t } = live
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
