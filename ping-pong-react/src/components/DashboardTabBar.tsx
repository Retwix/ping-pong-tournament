import { IconChartBar, IconHome, IconTrophy, IconUsers } from '@tabler/icons-react'
import NewMenu from './NewMenu'

interface Props {
  onClassement: () => void
  onStats: () => void
  onPlayers: () => void
  onNew: () => void
  onNewGame: () => void
}

/** Mobile fixed bottom tab bar: Accueil · Classement · (+) · Stats · Joueurs. Pronos folds into Classement. */
export default function DashboardTabBar({
  onClassement,
  onStats,
  onPlayers,
  onNew,
  onNewGame,
}: Props) {
  return (
    <nav className="rv-tabbar">
      <button className="rv-tab active" aria-current="page">
        <IconHome size={22} stroke={1.8} />
        <span>Accueil</span>
      </button>
      <button className="rv-tab" onClick={onClassement}>
        <IconTrophy size={22} stroke={1.8} />
        <span>Classement</span>
      </button>
      <div className="rv-tab-plus">
        <NewMenu compact onNew={onNew} onNewGame={onNewGame} />
      </div>
      <button className="rv-tab" onClick={onStats}>
        <IconChartBar size={22} stroke={1.8} />
        <span>Stats</span>
      </button>
      <button className="rv-tab" onClick={onPlayers}>
        <IconUsers size={22} stroke={1.8} />
        <span>Joueurs</span>
      </button>
    </nav>
  )
}
