import { IconChartBar, IconHome, IconTrophy, IconUsers } from '@tabler/icons-react'
import type { DashboardPage } from './DashboardNav'
import NewMenu from './NewMenu'

interface Props {
  active: DashboardPage
  onHome?: () => void
  onClassement?: () => void
  onStats?: () => void
  onPlayers?: () => void
  onNew: () => void
  onNewGame: () => void
}

/** Mobile fixed bottom tab bar: Accueil · Classement · (+) · Stats · Joueurs. */
export default function DashboardTabBar({
  active,
  onHome,
  onClassement,
  onStats,
  onPlayers,
  onNew,
  onNewGame,
}: Props) {
  const tab = (id: DashboardPage, label: string, icon: JSX.Element, onClick?: () => void) => {
    const isActive = id === active
    return (
      <button
        className={`rv-tab${isActive ? ' active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
        onClick={isActive ? undefined : onClick}
      >
        {icon}
        <span>{label}</span>
      </button>
    )
  }

  return (
    <nav className="rv-tabbar">
      {tab('home', 'Accueil', <IconHome size={22} stroke={1.8} />, onHome)}
      {tab('classement', 'Classement', <IconTrophy size={22} stroke={1.8} />, onClassement)}
      <div className="rv-tab-plus">
        <NewMenu compact onNew={onNew} onNewGame={onNewGame} />
      </div>
      {tab('stats', 'Stats', <IconChartBar size={22} stroke={1.8} />, onStats)}
      {tab('players', 'Joueurs', <IconUsers size={22} stroke={1.8} />, onPlayers)}
    </nav>
  )
}
