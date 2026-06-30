import { IconTrash } from '@tabler/icons-react'
import { type MouseEvent, useState } from 'react'
import { useMatchHistory } from '../hooks/useMatchHistory'
import { deleteTournament } from '../lib/db'
import MatchRow from './MatchRow'
import ThemeToggle from './ThemeToggle'
import TopBack from './TopBack'

interface Props {
  onBack: () => void
  onOpen: (id: string) => void
}

type Tab = 'matches' | 'tournaments'

export default function History({ onBack, onOpen }: Props) {
  const { matches, liveMatches, tournaments, tournamentName, loading, error } = useMatchHistory()
  const [tab, setTab] = useState<Tab>('matches')

  const onDelete = async (e: MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (confirm(`Supprimer « ${name} » ? Cette action est définitive.`)) {
      await deleteTournament(id)
    }
  }

  const matchRow = (m: (typeof matches)[number], live = false) => {
    const name = tournamentName(m.tournament_id)
    return (
      <div className="hist-row" key={m.id}>
        <MatchRow match={m} context={name} onOpen={() => onOpen(m.tournament_id)} live={live} />
        <button
          className="hist-del"
          title="Supprimer la partie"
          aria-label="Supprimer la partie"
          onClick={(e) => onDelete(e, m.tournament_id, name || 'cette partie')}
        >
          <IconTrash size={18} stroke={1.75} />
        </button>
      </div>
    )
  }

  const matchCount = matches.length + liveMatches.length

  return (
    <div className="wrap">
      <TopBack onClick={onBack} label="Accueil" />
      <header>
        <ThemeToggle className="header-toggle" />
        <div className="eyebrow">Historique</div>
        <h1>
          Tout l'<span className="em">historique</span>
        </h1>
        <p className="subtitle">
          Tous les matchs joués et tous les tournois, du plus récent au plus ancien.
        </p>
      </header>

      {error && <div className="error-banner">Erreur : {error}</div>}

      <div className="hist-tabs">
        <button
          className={tab === 'matches' ? 'active' : ''}
          onClick={() => setTab('matches')}
        >
          Matchs{matchCount ? ` (${matchCount})` : ''}
        </button>
        <button
          className={tab === 'tournaments' ? 'active' : ''}
          onClick={() => setTab('tournaments')}
        >
          Tournois{tournaments.length ? ` (${tournaments.length})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="empty">Chargement…</div>
      ) : tab === 'matches' ? (
        matchCount === 0 ? (
          <div className="empty">Aucun match joué pour l'instant.</div>
        ) : (
          <section style={{ marginTop: 0 }}>
            {liveMatches.map((m) => matchRow(m, true))}
            {matches.map((m) => matchRow(m))}
          </section>
        )
      ) : tournaments.length === 0 ? (
        <div className="empty">Aucun tournoi pour l'instant.</div>
      ) : (
        <section style={{ marginTop: 0 }}>
          {tournaments.map((t) => (
            <div className="t-card" key={t.id} onClick={() => onOpen(t.id)}>
              <div>
                <div className="t-name">{t.name}</div>
                <div className="t-meta">
                  {t.kind === 'game' ? 'Partie' : `Tournoi · ${t.players.length} joueurs`} · jeu en{' '}
                  {t.target} · {new Date(t.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`t-badge${t.status === 'done' ? ' done' : ''}`}>
                  {t.status === 'done' ? 'Terminé' : 'En cours'}
                </span>
                <button className="t-del" title="Supprimer" onClick={(e) => onDelete(e, t.id, t.name)}>
                  <IconTrash size={18} stroke={1.75} />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
