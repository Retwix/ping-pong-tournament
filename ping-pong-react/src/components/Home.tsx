import type { MouseEvent } from 'react'
import { useTournaments } from '../hooks/useTournaments'
import { deleteTournament } from '../lib/db'
import { recentTournaments } from '../lib/recentTournaments'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'
import LiveHero from './LiveHero'
import RecentResults from './RecentResults'
import RecordsCard from './RecordsCard'
import TopPlayers from './TopPlayers'
import TournamentCard from './TournamentCard'

/**
 * The tournaments grid shows a fixed two rows on desktop, filled with the most
 * recent tournaments/games (`COLUMNS * ROWS` slots). Keep DASHBOARD_COLUMNS in
 * sync with the desktop `grid-template-columns` count on `.rv-t-grid` in
 * index.css.
 */
const DASHBOARD_COLUMNS = 4
const DASHBOARD_ROWS = 2

interface Props {
  onOpen: (id: string) => void
  onNew: () => void
  onNewGame: () => void
  onPlayers: () => void
  onStats: () => void
  onClassement: () => void
  onParties: (filter: 'all' | 'match') => void
  onLive: () => void
  onRef: () => void
}

export default function Home({
  onOpen,
  onNew,
  onNewGame,
  onPlayers,
  onStats,
  onClassement,
  onParties,
  onLive,
  onRef,
}: Props) {
  const { tournaments, loading, error } = useTournaments()

  const onDelete = async (e: MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (confirm(`Supprimer « ${name} » ? Cette action est définitive.`)) {
      await deleteTournament(id)
    }
  }

  return (
    <div className="rv-page">
      <DashboardNav
        active="home"
        onClassement={onClassement}
        onStats={onStats}
        onPlayers={onPlayers}
        onNew={onNew}
        onNewGame={onNewGame}
      />

      <LiveHero onWatch={onLive} onRef={onRef} onNew={onNew} />

      {error && <div className="error-banner">Erreur : {error}</div>}

      <div className="rv-grid">
        <div className="rv-main">
          <div className="rv-slot-tournaments">
            <div className="rv-sec-head">
              <div className="section-title">Tes tournois &amp; parties</div>
              <button className="rv-top-link" onClick={() => onParties('all')}>
                Tout voir →
              </button>
            </div>

            {loading ? (
              <div className="empty">Chargement…</div>
            ) : tournaments.length === 0 ? (
              <div className="empty">Aucun tournoi pour l'instant. Crée le premier !</div>
            ) : (
              <div className="rv-t-grid">
                {recentTournaments(tournaments, DASHBOARD_COLUMNS * DASHBOARD_ROWS).map((t) => (
                  <TournamentCard key={t.id} tournament={t} onOpen={onOpen} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>

          <div className="rv-slot-recent">
            <RecentResults onOpenTournament={onOpen} onHistory={() => onParties('match')} />
          </div>
        </div>

        <div className="rv-side">
          <div className="rv-slot-top">
            <TopPlayers onOpenClassement={onClassement} />
          </div>
          <div className="rv-slot-records">
            <RecordsCard />
          </div>
        </div>
      </div>

      <DashboardTabBar
        active="home"
        onClassement={onClassement}
        onStats={onStats}
        onPlayers={onPlayers}
        onNew={onNew}
        onNewGame={onNewGame}
      />
    </div>
  )
}
