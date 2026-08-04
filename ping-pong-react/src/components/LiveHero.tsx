import { IconClock, IconPlayerPlay } from '@tabler/icons-react'
import { useCurrentTournament } from '../hooks/useCurrentTournament'
import { useRatings } from '../hooks/useRatings'
import { useTournament } from '../hooks/useTournament'
import { ladderAvatar } from '../lib/spectator'
import { pickLiveMatch } from '../lib/liveHero'
import { serverIsA } from '../lib/pingpong'
import { sideKey } from '../lib/stats'
import Avatar from './Avatar'

interface Props {
  onWatch: () => void
  onRef: () => void
  onNew: () => void
}

/**
 * Dashboard live hero — the emotional anchor of the home screen. Shows the coral
 * "match in progress" card when a game is live on the table, otherwise a slim
 * glass invite band. Never renders nothing: while the active tournament is still
 * resolving, the idle band shows too, so the top of the page never flashes empty.
 */
export default function LiveHero({ onWatch, onRef, onNew }: Props) {
  const { id, loading } = useCurrentTournament()
  const { tournament, matches } = useTournament(id)
  const { rows } = useRatings()
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

  const rowA = rows.find((r) => r.key === sideKey(live.player_a_id, live.player_a))
  const rowB = rows.find((r) => r.key === sideKey(live.player_b_id, live.player_b))
  const eloA = rowA ? Math.round(rowA.rating) : null
  const eloB = rowB ? Math.round(rowB.rating) : null
  const avatarA = ladderAvatar(rows, live.player_a_id, live.player_a)
  const avatarB = ladderAvatar(rows, live.player_b_id, live.player_b)
  const aServes = serverIsA(live, tournament.target)

  return (
    <div className="rv-hero-live">
      <div className="rv-hero-live-meta">
        <span className="rv-hero-live-dot" aria-hidden="true" />
        <span className="rv-hero-live-label">EN DIRECT</span>
        <span className="rv-hero-live-meta-sep">·</span>
        <span>Jeu en {tournament.target}</span>
        {tournament.unranked && <span className="badge-nc on-color">Non classé</span>}
      </div>

      <div className="rv-hero-matchup">
        <div className="rv-hero-player">
          <Avatar
            name={live.player_a}
            team={rowA?.team ?? null}
            url={avatarA}
            className="rv-hero-av"
          />
          <div className="rv-hero-player-info">
            <div className="rv-hero-player-name">{live.player_a}</div>
            <div className="rv-hero-player-sub">
              {eloA !== null && <span>{eloA} Elo</span>}
              {eloA !== null && aServes && ' · '}
              {aServes && <span>au service</span>}
            </div>
          </div>
        </div>

        <div className="rv-hero-score">
          {live.score_a} – {live.score_b}
        </div>

        <div className="rv-hero-player rv-hero-player-b">
          <div className="rv-hero-player-info rv-hero-player-info-b">
            <div className="rv-hero-player-name">{live.player_b}</div>
            <div className="rv-hero-player-sub">
              {eloB !== null && <span>{eloB} Elo</span>}
              {eloB !== null && !aServes && ' · '}
              {!aServes && <span>au service</span>}
            </div>
          </div>
          <Avatar
            name={live.player_b}
            team={rowB?.team ?? null}
            url={avatarB}
            className="rv-hero-av"
          />
        </div>
      </div>

      <div className="rv-hero-actions">
        <button className="rv-hero-btn-primary" onClick={onWatch}>
          <IconPlayerPlay size={16} stroke={2} />
          Regarder
        </button>
        <button className="rv-hero-btn-secondary" onClick={onRef}>
          Arbitrer
        </button>
      </div>
    </div>
  )
}
