import { useEffect, useState } from 'react'
import Board from './components/Board'
import CurrentView from './components/CurrentView'
import Home from './components/Home'
import LiveView from './components/LiveView'
import Parties from './components/Parties'
import Players from './components/Players'
import Ratings from './components/Ratings'
import NouvellePartie from './components/NouvellePartie'
import Stats from './components/Stats'
import { parseFilter, type PartiesFilter } from './lib/parties'
import { parseStatsFilters, statsSearch, type StatsFilters } from './lib/statsPage'
import { currentPath, navigate } from './lib/router'
import { hasSupabaseConfig } from './lib/supabase'

type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'game' }
  | { name: 'parties'; filter: PartiesFilter }
  | { name: 'players' }
  | { name: 'stats'; filters: StatsFilters }
  | { name: 'classement' }
  | { name: 'board'; id: string }
  | { name: 'live'; id: string }
  | { name: 'live-current' }
  | { name: 'ref-current' }

function parseRoute(): Route {
  const p = currentPath()
  if (p === '/new') return { name: 'new' }
  if (p === '/game') return { name: 'game' }
  if (p === '/parties') return { name: 'parties', filter: parseFilter(window.location.search) }
  if (p === '/players') return { name: 'players' }
  if (p === '/stats') return { name: 'stats', filters: parseStatsFilters(window.location.search) }
  if (p === '/classement') return { name: 'classement' }
  // Stable, shareable views that follow the current tournament (no id needed).
  if (p === '/live') return { name: 'live-current' }
  if (p === '/ref') return { name: 'ref-current' }
  const live = p.match(/^\/t\/(.+)\/live$/)
  if (live) return { name: 'live', id: decodeURIComponent(live[1]) }
  const m = p.match(/^\/t\/(.+)$/)
  if (m) return { name: 'board', id: decodeURIComponent(m[1]) }
  return { name: 'home' }
}

function ConfigError() {
  return (
    <div className="wrap">
      <header>
        <div className="kicker">Configuration requise</div>
        <h1>
          Ping-Pong <span className="em">Recovr</span>
        </h1>
      </header>
      <div className="error-banner">
        Les clés Supabase sont manquantes. Copie <code>.env.example</code> vers <code>.env</code> et
        renseigne <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code>, puis
        relance <code>npm run dev</code>. Vois le README pour les étapes détaillées.
      </div>
    </div>
  )
}

function renderRoute(route: Route) {
  if (!hasSupabaseConfig) return <ConfigError />
  switch (route.name) {
    case 'new':
    case 'game':
      return (
        <NouvellePartie
          variant={route.name === 'game' ? 'game' : 'tournament'}
          onCreated={(id) => navigate(`/t/${id}`)}
          onHome={() => navigate('/')}
          onClassement={() => navigate('/classement')}
          onStats={() => navigate('/stats')}
          onPlayers={() => navigate('/players')}
          onNew={() => navigate('/new')}
          onNewGame={() => navigate('/game')}
        />
      )
    case 'parties':
      return (
        <Parties
          filter={route.filter}
          onHome={() => navigate('/')}
          onClassement={() => navigate('/classement')}
          onStats={() => navigate('/stats')}
          onPlayers={() => navigate('/players')}
          onNew={() => navigate('/new')}
          onNewGame={() => navigate('/game')}
          onOpenTournament={(id) => navigate(`/t/${id}`)}
          onFilterChange={(f) => navigate(f === 'all' ? '/parties' : `/parties?f=${f}`)}
          onLive={() => navigate('/live')}
          onRef={() => navigate('/ref')}
        />
      )
    case 'players':
      return (
        <Players
          onHome={() => navigate('/')}
          onClassement={() => navigate('/classement')}
          onStats={() => navigate('/stats')}
          onNew={() => navigate('/new')}
          onNewGame={() => navigate('/game')}
        />
      )
    case 'stats':
      return (
        <Stats
          filters={route.filters}
          onFiltersChange={(f) => navigate(`/stats${statsSearch(f)}`)}
          onHome={() => navigate('/')}
          onClassement={() => navigate('/classement')}
          onPlayers={() => navigate('/players')}
          onNew={() => navigate('/new')}
          onNewGame={() => navigate('/game')}
        />
      )
    case 'classement':
      return (
        <Ratings
          onHome={() => navigate('/')}
          onStats={() => navigate('/stats')}
          onPlayers={() => navigate('/players')}
          onNew={() => navigate('/new')}
          onNewGame={() => navigate('/game')}
        />
      )
    case 'board':
      return (
        <Board
          id={route.id}
          onBack={() => navigate('/')}
          onNew={() => navigate('/new')}
          onOpen={(id) => navigate(`/t/${id}`)}
        />
      )
    case 'live':
      return <LiveView id={route.id} onBack={() => navigate(`/t/${route.id}`)} />
    case 'live-current':
      return <CurrentView readOnly onHome={() => navigate('/')} onRef={() => navigate('/ref')} />
    case 'ref-current':
      return <CurrentView readOnly={false} onHome={() => navigate('/')} />
    default:
      return (
        <Home
          onOpen={(id) => navigate(`/t/${id}`)}
          onNew={() => navigate('/new')}
          onNewGame={() => navigate('/game')}
          onPlayers={() => navigate('/players')}
          onStats={() => navigate('/stats')}
          onClassement={() => navigate('/classement')}
          onParties={(f) => navigate(f === 'match' ? '/parties?f=match' : '/parties')}
          onLive={() => navigate('/live')}
          onRef={() => navigate('/ref')}
        />
      )
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute())

  useEffect(() => {
    const onNavigate = () => setRoute(parseRoute())
    window.addEventListener('popstate', onNavigate)
    return () => window.removeEventListener('popstate', onNavigate)
  }, [])

  return renderRoute(route)
}
