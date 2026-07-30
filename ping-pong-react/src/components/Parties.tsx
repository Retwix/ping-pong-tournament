import { useState } from 'react'
import { IconSearch } from '@tabler/icons-react'
import { useRatings } from '../hooks/useRatings'
import { historySubtitle, type PartiesFilter } from '../lib/parties'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'
import NewMenu from './NewMenu'

interface Props {
  filter: PartiesFilter
  onHome: () => void
  onClassement: () => void
  onStats: () => void
  onPlayers: () => void
  onNew: () => void
  onNewGame: () => void
}

/** « Tournois & parties » — the full history page, reached from the Accueil links (not a tab). */
export default function Parties({
  onHome,
  onClassement,
  onStats,
  onPlayers,
  onNew,
  onNewGame,
}: Props) {
  const { matches, tournaments, loading, error } = useRatings()
  const [query, setQuery] = useState('')

  const nav = (
    <DashboardNav
      onHome={onHome}
      onClassement={onClassement}
      onStats={onStats}
      onPlayers={onPlayers}
      onNew={onNew}
      onNewGame={onNewGame}
    />
  )
  const tabbar = (
    <DashboardTabBar
      onHome={onHome}
      onClassement={onClassement}
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

      <button className="pt-crumb" onClick={onHome}>
        ‹ Accueil
      </button>

      <div className="pt-head">
        <div className="pt-head-text">
          <h1 className="pt-title">Tournois &amp; parties</h1>
          <p className="pt-sub">{historySubtitle(matches, tournaments)}</p>
        </div>
        <div className="pt-head-actions">
          <label className="pt-search">
            <IconSearch size={17} stroke={2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Joueur, tournoi…"
              aria-label="Chercher un joueur ou un tournoi"
            />
          </label>
          <NewMenu onNew={onNew} onNewGame={onNewGame} />
        </div>
      </div>

      {tabbar}
    </div>
  )
}
