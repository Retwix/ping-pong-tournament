import { IconClock } from '@tabler/icons-react'
import { useCurrentTournament } from '../hooks/useCurrentTournament'
import { useRatings } from '../hooks/useRatings'
import { useTournament } from '../hooks/useTournament'
import { pickLiveMatch } from '../lib/liveHero'
import { defaultLadderScope } from '../lib/seasons'
import LiveHeroCard from './LiveHeroCard'

interface Props {
  onWatch: () => void
  onRef: () => void
  onNew: () => void
}

/**
 * Dashboard live hero — the emotional anchor of the home screen. Shows the coral
 * "match in progress" card when a game is live on the table, otherwise a slim
 * glass invite band. The Elo under each player is read off the ladder the
 * dashboard's other cards show — the season being played — not the lifetime one. Never renders nothing: while the active tournament is still
 * resolving, the idle band shows too, so the top of the page never flashes empty.
 */
export default function LiveHero({ onWatch, onRef, onNew }: Props) {
  const { id, loading } = useCurrentTournament()
  const { tournament, matches } = useTournament(id)
  const { rows } = useRatings(defaultLadderScope(new Date()))
  const live = pickLiveMatch(matches)

  if (loading || !tournament || !live) {
    return (
      <div className="rv-hero-idle">
        <div className="rv-hero-idle-left">
          <span className="rv-hero-idle-icon">
            <IconClock size={20} stroke={1.8} />
          </span>
          <div className="rv-hero-idle-text">
            <div className="rv-hero-idle-title">Aucun match en cours</div>
            <div className="rv-hero-idle-sub">
              Lance une partie — le score en direct apparaîtra ici pour tout le bureau.
            </div>
          </div>
        </div>
        <div className="rv-hero-idle-actions">
          <button className="btn-primary" onClick={onNew}>
            + Nouveau match
          </button>
          <button className="rv-hero-ghost" onClick={onWatch}>
            Mode présentation
          </button>
        </div>
      </div>
    )
  }

  return <LiveHeroCard tournament={tournament} live={live} rows={rows} onWatch={onWatch} onRef={onRef} />
}
