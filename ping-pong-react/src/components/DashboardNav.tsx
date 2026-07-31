import { IconPingPong } from '@tabler/icons-react'
import NewMenu from './NewMenu'
import ThemeToggle from './ThemeToggle'

export type DashboardPage = 'home' | 'classement' | 'stats' | 'players'

interface Props {
  /** Highlighted tab; omit on pages reached via links (e.g. /parties) where no tab is current. */
  active?: DashboardPage
  onHome?: () => void
  onClassement?: () => void
  onStats?: () => void
  onPlayers?: () => void
  onNew: () => void
  onNewGame: () => void
}

const TAB_LABELS: Record<DashboardPage, string> = {
  home: 'Accueil',
  classement: 'Classement',
  stats: 'Stats',
  players: 'Joueurs',
}

/** Desktop glass top bar: brand, nav links (current page active), theme toggle, "+ Nouveau" CTA. */
export default function DashboardNav({
  active,
  onHome,
  onClassement,
  onStats,
  onPlayers,
  onNew,
  onNewGame,
}: Props) {
  const tabs: Array<{ id: DashboardPage; onClick?: () => void }> = [
    { id: 'home', onClick: onHome },
    { id: 'classement', onClick: onClassement },
    { id: 'stats', onClick: onStats },
    { id: 'players', onClick: onPlayers },
  ]

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
        {tabs.map((tab) =>
          tab.id === active ? (
            <span key={tab.id} className="rv-nav-link active">
              {TAB_LABELS[tab.id]}
            </span>
          ) : (
            <button key={tab.id} className="rv-nav-link" onClick={tab.onClick}>
              {TAB_LABELS[tab.id]}
            </button>
          ),
        )}
      </div>
      <div className="rv-nav-actions">
        <ThemeToggle />
        <NewMenu onNew={onNew} onNewGame={onNewGame} />
      </div>
    </nav>
  )
}
