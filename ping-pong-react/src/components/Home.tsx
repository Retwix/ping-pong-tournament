import type { MouseEvent } from 'react'
import { useTournaments } from '../hooks/useTournaments'
import { deleteTournament } from '../lib/db'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'
import LiveHero from './LiveHero'
import NewMenu from './NewMenu'
import RecentResults from './RecentResults'
import RecordsCard from './RecordsCard'
import TopPlayers from './TopPlayers'
import TournamentCard from './TournamentCard'

interface Props {
  onOpen: (id: string) => void
  onNew: () => void
  onNewGame: () => void
  onPlayers: () => void
  onStats: () => void
  onClassement: () => void
  onPronos: () => void
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
  onPronos,
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
        onClassement={onClassement}
        onPronos={onPronos}
        onStats={onStats}
        onPlayers={onPlayers}
        onNew={onNew}
        onNewGame={onNewGame}
      />

      <LiveHero onWatch={onLive} onRef={onRef} onNew={onNew} />

      {error && <div className="error-banner">Erreur : {error}</div>}

      <div className="rv-grid">
        <div className="rv-main">
          <div className="section-title">Tes tournois &amp; parties</div>

          {loading ? (
            <div className="empty">Chargement…</div>
          ) : tournaments.length === 0 ? (
            <div className="empty">Aucun tournoi pour l'instant. Crée le premier !</div>
          ) : (
            <div className="rv-t-grid">
              {tournaments.map((t) => (
                <TournamentCard key={t.id} tournament={t} onOpen={onOpen} onDelete={onDelete} />
              ))}
              <div className="rvcard rv-t-new">
                <NewMenu onNew={onNew} onNewGame={onNewGame} />
              </div>
            </div>
          )}

          <RecentResults onOpenTournament={onOpen} />
        </div>

        <div className="rv-side">
          <TopPlayers onOpenClassement={onClassement} />
          <RecordsCard />
        </div>
      </div>

      <DashboardTabBar
        onClassement={onClassement}
        onStats={onStats}
        onPlayers={onPlayers}
        onNew={onNew}
        onNewGame={onNewGame}
      />
    </div>
  )
}
