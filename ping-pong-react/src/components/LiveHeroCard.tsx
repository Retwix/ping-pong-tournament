import { IconPlayerPlay } from '@tabler/icons-react'
import { serverIsA } from '../lib/pingpong'
import { sideBios } from '../lib/playerBio'
import type { RatingRow } from '../lib/rating'
import { ladderAvatar } from '../lib/spectator'
import { sideKey } from '../lib/stats'
import type { Match, Player, Tournament } from '../types'
import Avatar from './Avatar'

interface Props {
  tournament: Tournament
  live: Match
  rows: RatingRow[]
  players: Player[]
  onWatch: () => void
  onRef: () => void
}

/** The coral "match in progress" card of the dashboard's live hero. */
export default function LiveHeroCard({ tournament, live, rows, players, onWatch, onRef }: Props) {
  const rowA = rows.find((r) => r.key === sideKey(live.player_a_id, live.player_a))
  const rowB = rows.find((r) => r.key === sideKey(live.player_b_id, live.player_b))
  const eloA = rowA ? Math.round(rowA.rating) : null
  const eloB = rowB ? Math.round(rowB.rating) : null
  const avatarA = ladderAvatar(rows, live.player_a_id, live.player_a)
  const avatarB = ladderAvatar(rows, live.player_b_id, live.player_b)
  const aServes = serverIsA(live, tournament.target)
  const bios = sideBios(players, live)

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
        <div className="rv-hero-player" role="group" aria-label={live.player_a}>
          <Avatar
            name={live.player_a}
            team={rowA?.team ?? null}
            url={avatarA}
            className="rv-hero-av"
          />
          <div className="rv-hero-player-info">
            <div className="rv-hero-player-name">{live.player_a}</div>
            {bios.a && <div className="rv-hero-player-bio">{bios.a}</div>}
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

        <div className="rv-hero-player rv-hero-player-b" role="group" aria-label={live.player_b}>
          <div className="rv-hero-player-info rv-hero-player-info-b">
            <div className="rv-hero-player-name">{live.player_b}</div>
            {bios.b && <div className="rv-hero-player-bio">{bios.b}</div>}
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
