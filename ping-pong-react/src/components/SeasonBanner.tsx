import { IconArrowRight, IconTrophy } from '@tabler/icons-react'
import { useRatings } from '../hooks/useRatings'
import { splitLadder } from '../lib/alumni'
import { RATING, ratedMatches } from '../lib/rating'
import { recordOf } from '../lib/classement'
import {
  ALL_TIME,
  currentSeason,
  daysLeft,
  isClosed,
  matchesInSeason,
  nextSeason,
  seasonBannerState,
  seasonWindowLabel,
  SEASONS_START,
  type LadderScope,
} from '../lib/seasons'
import Avatar from './Avatar'

interface Props {
  onClassement: () => void
  onNew: () => void
}

const dayMonth = (d: Date): string =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

/**
 * The season band under LiveHero. Hierarchy is live > season > everything else:
 * the hero is taller, coral and pulsing; this is calm lavender beneath it. With
 * no match live the band becomes the first object on the page, which is correct.
 */
export default function SeasonBanner({ onClassement, onNew }: Props) {
  const now = new Date()
  const season = currentSeason(now)
  const scope: LadderScope = season === null ? ALL_TIME : { kind: 'season', id: season.id }
  const { rows, events, matches, players, tournaments } = useRatings(scope)

  const ratedCount =
    season === null ? 0 : ratedMatches(matchesInSeason(matches, season.id), tournaments).length
  const { ranked } = splitLadder(rows, players, season)
  const leader = ranked[0] ?? null
  const state = seasonBannerState({ season, now, ratedCount, leader })

  if (state === 'pre') {
    const days = Math.max(0, Math.ceil((SEASONS_START.getTime() - now.getTime()) / 86_400_000))
    const first = currentSeason(SEASONS_START)
    return (
      <section className="sn-banner sn-pre">
        <div className="sn-banner-main">
          <div className="sn-banner-tile">
            <IconTrophy size={22} stroke={1.8} />
          </div>
          <div className="sn-banner-text">
            <div className="sn-banner-title">La première saison commence le 1er septembre</div>
            <div className="sn-banner-sub">
              {first?.label} — trois mois, tout le monde reparti de 1500. D'ici là, le classement
              reste celui de tous les temps.
            </div>
          </div>
        </div>
        <span className="sn-pill">Dans {days} jours</span>
      </section>
    )
  }

  if (season === null) return null

  if (state === 'empty') {
    return (
      <section className="sn-banner sn-neutral">
        <div className="sn-banner-main">
          <div className="sn-banner-tile">
            <IconTrophy size={22} stroke={1.8} />
          </div>
          <div className="sn-banner-text">
            <div className="sn-banner-title">{season.label}</div>
            <div className="sn-banner-sub">
              Aucune partie dans cette saison pour l'instant · {seasonWindowLabel(season)}
            </div>
          </div>
        </div>
        <button className="sn-banner-cta" onClick={onNew}>
          Lancer une partie <IconArrowRight size={15} stroke={2} />
        </button>
      </section>
    )
  }

  if (state === 'vacant') {
    const closed = isClosed(season, now)
    return (
      <section className="sn-banner sn-neutral">
        <div className="sn-banner-main">
          <div className="sn-banner-tile">
            <IconTrophy size={22} stroke={1.8} />
          </div>
          <div className="sn-banner-text">
            <div className="sn-banner-title">
              {season.label}
              {closed ? ' — terminée sans titre' : ''}
            </div>
            <div className="sn-banner-sub">
              Seul·e·s des ancien·ne·s ont joué cette saison
              {closed ? " : aucun titre n'est décerné." : " pour l'instant."}
            </div>
          </div>
        </div>
        <button className="sn-banner-cta" onClick={closed ? onClassement : onNew}>
          {closed ? (
            <>
              Le classement <IconArrowRight size={15} stroke={2} />
            </>
          ) : (
            <>
              Lancer une partie <IconArrowRight size={15} stroke={2} />
            </>
          )}
        </button>
      </section>
    )
  }

  if (state === 'nochamp') {
    return (
      <section className="sn-banner sn-neutral">
        <div className="sn-banner-main">
          <div className="sn-banner-tile">
            <IconTrophy size={22} stroke={1.8} />
          </div>
          <div className="sn-banner-text">
            <div className="sn-banner-title">{season.label} — terminée sans champion</div>
            <div className="sn-banner-sub">
              Personne n'a atteint {RATING.provisionalGames} parties. Le titre reste vacant :{' '}
              {leader?.name} finit en tête avec {Math.round(leader?.rating ?? 0)} Elo.
            </div>
          </div>
        </div>
        <button className="sn-banner-cta" onClick={onClassement}>
          Le classement <IconArrowRight size={15} stroke={2} />
        </button>
      </section>
    )
  }

  if (state === 'champion' && leader !== null) {
    const record = recordOf(events, leader.key)
    const runnersUp = ranked.filter((r) => !r.provisional).slice(1, 3)
    const upcoming = nextSeason(season)
    return (
      <section className="sn-plaque">
        <div className="sn-plaque-main">
          <Avatar
            name={leader.name}
            team={leader.team}
            url={leader.avatar_url}
            className="sn-plaque-avatar"
            fill="hero"
          />
          <div className="sn-plaque-text">
            <div className="sn-plaque-badge">Champion · {season.label.replace('Saison ', '')}</div>
            <div className="sn-plaque-name">{leader.name}</div>
            <div className="sn-plaque-line">
              {Math.round(leader.rating)} Elo · {leader.games} parties · {record.wins} victoires
            </div>
          </div>
          {runnersUp.length > 0 && (
            <div className="sn-plaque-podium">
              {runnersUp.map((r, i) => (
                <span className="sn-plaque-chip" key={r.key}>
                  {i === 0 ? '2e' : '3e'} {r.name} · {Math.round(r.rating)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="sn-plaque-foot">
          <span>
            {upcoming.label} · départ le {dayMonth(upcoming.start)}, tout le monde à 1500
          </span>
          <button className="sn-plaque-cta" onClick={onClassement}>
            Le classement final <IconArrowRight size={15} stroke={2} />
          </button>
        </div>
      </section>
    )
  }

  if (leader === null) return null

  const left = daysLeft(season, now)
  return (
    <section className="sn-banner sn-running">
      <div className="sn-banner-main">
        <div className="sn-banner-tile">
          <IconTrophy size={22} stroke={1.8} />
        </div>
        <div className="sn-banner-text">
          <div className="sn-banner-title">{season.label}</div>
          <div className="sn-banner-sub">{seasonWindowLabel(season)} · reparti de 1500</div>
        </div>

        <div className="sn-banner-sep" />

        <div className="sn-banner-leader">
          <Avatar
            name={leader.name}
            team={leader.team}
            url={leader.avatar_url}
            className="sn-banner-avatar"
          />
          <div>
            <div className="sn-banner-name">
              {leader.name} <span className="sn-banner-elo">{Math.round(leader.rating)}</span>
            </div>
            <div className="sn-banner-role">
              {state === 'noleader'
                ? `En tête · ${leader.games} parties sur ${RATING.provisionalGames}`
                : `Meneur · ${leader.games} parties · éligible au titre`}
            </div>
          </div>
        </div>
      </div>

      <div className="sn-banner-end">
        <span className={`sn-pill ${state === 'final' ? 'urgent' : ''}`}>
          {state === 'final' && <i className="sn-pill-dot" />}
          {state === 'final' ? `Fin dans ${left} jours` : `J-${left}`}
        </span>
        <button className="sn-banner-link" onClick={onClassement}>
          Le classement →
        </button>
      </div>
    </section>
  )
}
