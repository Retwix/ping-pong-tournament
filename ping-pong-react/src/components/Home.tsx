import type { MouseEvent } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { deleteTournament } from '../lib/db'
import { useTournaments } from '../hooks/useTournaments'
import ThemeToggle from './ThemeToggle'

interface Props {
  onOpen: (id: string) => void
  onNew: () => void
  onNewGame: () => void
  onPlayers: () => void
}

export default function Home({ onOpen, onNew, onNewGame, onPlayers }: Props) {
  const { tournaments, loading, error } = useTournaments()

  const onDelete = async (e: MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (confirm(`Supprimer « ${name} » ? Cette action est définitive.`)) {
      await deleteTournament(id)
    }
  }

  return (
    <div className="wrap">
      <header>
        <ThemeToggle className="header-toggle" />
        <div className="kicker">Round-robin · live</div>
        <h1>
          Tournoi <span className="em">ping-pong</span>
        </h1>
        <p className="subtitle">
          Crée un tournoi ou reprends-en un. Les scores se synchronisent en direct sur tous les écrans.
        </p>
      </header>

      {error && <div className="error-banner">Erreur : {error}</div>}

      <section>
        <div className="home-top">
          <span className="setup-label" style={{ margin: 0 }}>
            Tes parties &amp; tournois
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="link-btn" onClick={onPlayers}>
              Joueurs
            </button>
            <button className="link-btn" onClick={onNewGame}>
              + Partie rapide
            </button>
            <button className="btn-primary" onClick={onNew}>
              + Nouveau tournoi
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty">Chargement…</div>
        ) : tournaments.length === 0 ? (
          <div className="empty">Aucun tournoi pour l'instant. Crée le premier !</div>
        ) : (
          tournaments.map((t) => (
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
          ))
        )}
      </section>
    </div>
  )
}
