import { IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRatings } from '../hooks/useRatings'
import { filterJoueurs, joueurRows, joueursSubtitle, teamChips } from '../lib/joueurs'
import { teamColor, teamLabel } from '../lib/teams'
import Avatar from './Avatar'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'

/** 12 %-alpha tint of the team color behind its full-strength label. */
const badgeStyle = (team: string) => {
  const color = teamColor(team)
  return { background: `${color}1F`, color }
}

interface Props {
  onHome: () => void
  onClassement: () => void
  onStats: () => void
  onNew: () => void
  onNewGame: () => void
}

export default function Players({ onHome, onClassement, onStats, onNew, onNewGame }: Props) {
  const { rows, events, players, loading, error } = useRatings()
  const [query, setQuery] = useState('')
  const [team, setTeam] = useState('all')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const annuaire = useMemo(() => joueurRows(players, rows, events), [players, rows, events])
  const visible = useMemo(() => filterJoueurs(annuaire, query, team), [annuaire, query, team])
  const chips = useMemo(() => teamChips(annuaire), [annuaire])

  const nav = (
    <DashboardNav
      active="players"
      onHome={onHome}
      onClassement={onClassement}
      onStats={onStats}
      onNew={onNew}
      onNewGame={onNewGame}
    />
  )
  const tabbar = (
    <DashboardTabBar
      active="players"
      onHome={onHome}
      onClassement={onClassement}
      onStats={onStats}
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

      <div className="pl-head">
        <div className="pl-head-text">
          <h1 className="pl-title">Joueurs</h1>
          <p className="pl-sub">{joueursSubtitle(annuaire.length)}</p>
        </div>
        <div className="pl-head-actions">
          <label className="pl-search">
            <IconSearch size={17} stroke={2} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un joueur"
              aria-label="Rechercher un joueur"
            />
            <kbd>⌘K</kbd>
          </label>
        </div>
      </div>

      <div className="pl-chips">
        {chips.map((c) => (
          <button
            key={c.key}
            className={`pl-chip${team === c.key ? ' active' : ''}`}
            onClick={() => setTeam(c.key)}
          >
            {c.label} · {c.count}
          </button>
        ))}
      </div>

      <div className="pl-table">
        <div className="pl-tr pl-thead">
          <div />
          <div>Joueur</div>
          <div>Équipe</div>
          <div className="pl-th-r">Elo</div>
          <div className="pl-th-r">Matchs</div>
          <div className="pl-th-r">Victoires</div>
        </div>

        {visible.map((r) => (
          <div key={r.id} className="pl-tr pl-row">
            <Avatar name={r.name} team={r.team} url={r.avatarUrl} className="pl-av" />
            <div className="pl-c-name">
              <div className="pl-name">{r.name}</div>
              <div className="pl-meta">{r.meta}</div>
            </div>
            <div>
              <span className="pl-badge" style={badgeStyle(r.team)}>
                {r.team === '' ? '—' : teamLabel(r.team)}
              </span>
            </div>
            <div className="pl-c-elo">{r.elo}</div>
            <div className="pl-c-matchs">{r.matchsLabel}</div>
            <div className={`pl-c-win${r.winrateStrong ? ' strong' : ''}`}>{r.winrate}</div>
          </div>
        ))}

        {visible.length === 0 && (
          <div className="pl-empty">
            <div className="pl-empty-title">Aucun joueur trouvé</div>
            <div className="pl-empty-sub">Essaie un autre nom ou une autre équipe.</div>
          </div>
        )}
      </div>

      {tabbar}
    </div>
  )
}
