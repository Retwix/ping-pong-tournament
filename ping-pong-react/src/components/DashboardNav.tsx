import { IconPingPong } from '@tabler/icons-react'
import NewMenu from './NewMenu'
import ThemeToggle from './ThemeToggle'

interface Props {
  onClassement: () => void
  onStats: () => void
  onPlayers: () => void
  onNew: () => void
  onNewGame: () => void
}

/** Desktop glass top bar: brand, nav links (Accueil active), theme toggle, "+ Nouveau" CTA. */
export default function DashboardNav({
  onClassement,
  onStats,
  onPlayers,
  onNew,
  onNewGame,
}: Props) {
  return (
    <nav className="rv-nav">
      <div className="rv-nav-brand">
        <span className="rv-nav-tile">
          <IconPingPong size={20} stroke={2.2} color="#fff" />
        </span>
        <span className="rv-nav-word">
          Tournoi <span className="em">ping-pong</span>
        </span>
      </div>
      <div className="rv-nav-links">
        <span className="rv-nav-link active">Accueil</span>
        <button className="rv-nav-link" onClick={onClassement}>
          Classement
        </button>
        <button className="rv-nav-link" onClick={onStats}>
          Stats
        </button>
        <button className="rv-nav-link" onClick={onPlayers}>
          Joueurs
        </button>
      </div>
      <div className="rv-nav-actions">
        <ThemeToggle />
        <NewMenu onNew={onNew} onNewGame={onNewGame} />
      </div>
    </nav>
  )
}
