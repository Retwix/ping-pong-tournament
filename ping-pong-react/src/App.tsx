import { useEffect, useState } from 'react'
import { hasSupabaseConfig } from './lib/supabase'
import Home from './components/Home'
import Setup from './components/Setup'
import Board from './components/Board'

type Route = { name: 'home' } | { name: 'new' } | { name: 'board'; id: string }

function parseRoute(): Route {
  const h = window.location.hash.replace(/^#/, '')
  if (h === '/new') return { name: 'new' }
  const m = h.match(/^\/t\/(.+)$/)
  if (m) return { name: 'board', id: decodeURIComponent(m[1]) }
  return { name: 'home' }
}

function navigate(hash: string) {
  window.location.hash = hash
}

function ConfigError() {
  return (
    <div className="wrap">
      <header>
        <div className="kicker">Configuration requise</div>
        <h1>
          Tournoi <span className="em">ping-pong</span>
        </h1>
      </header>
      <div className="error-banner">
        Les clés Supabase sont manquantes. Copie <code>.env.example</code> vers <code>.env</code> et
        renseigne <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code>, puis relance{' '}
        <code>npm run dev</code>. Vois le README pour les étapes détaillées.
      </div>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute())

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (!hasSupabaseConfig) return <ConfigError />

  switch (route.name) {
    case 'new':
      return <Setup onCreated={(id) => navigate(`/t/${id}`)} onCancel={() => navigate('/')} />
    case 'board':
      return (
        <Board id={route.id} onBack={() => navigate('/')} onNew={() => navigate('/new')} />
      )
    default:
      return <Home onOpen={(id) => navigate(`/t/${id}`)} onNew={() => navigate('/new')} />
  }
}
