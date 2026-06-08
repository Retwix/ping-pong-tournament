import { useState, type MouseEvent } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { createPlayer, deletePlayer } from '../lib/db'
import { usePlayers } from '../hooks/usePlayers'
import { TEAMS, teamLabel, type TeamKey } from '../lib/teams'

interface Props {
  onBack: () => void
}

export default function Players({ onBack }: Props) {
  const { players, loading, error, refresh } = usePlayers()

  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTeam, setNewTeam] = useState<TeamKey>('guests')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const addNew = async () => {
    const nm = newName.trim()
    if (!nm || saving) return
    if (players.some((p) => p.name.toLowerCase() === nm.toLowerCase())) {
      setFormError('Ce joueur existe déjà.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await createPlayer(nm, newTeam)
      setNewName('')
      setNewTeam('guests')
      setShowNew(false)
      refresh()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (e: MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (confirm(`Supprimer « ${name} » du registre ? Les tournois passés ne sont pas affectés.`)) {
      await deletePlayer(id)
    }
  }

  return (
    <div className="wrap">
      <header>
        <div className="kicker">Registre des joueurs</div>
        <h1>
          Les <span className="em">joueurs</span>
        </h1>
        <p className="subtitle">
          Ajoute, gère et supprime les joueurs. Supprimer un joueur ne touche pas aux tournois ni aux
          parties déjà jouées.
        </p>
      </header>

      {error && <div className="error-banner">Erreur : {error}</div>}

      <section>
        <div className="home-top">
          <span className="setup-label" style={{ margin: 0 }}>
            {players.length} joueur{players.length > 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => setShowNew((v) => !v)}>
              + Nouveau joueur
            </button>
            <button className="link-btn" onClick={onBack}>
              ← Accueil
            </button>
          </div>
        </div>

        {formError && <div className="error-banner">{formError}</div>}

        {showNew && (
          <div className="new-player" style={{ marginBottom: 14 }}>
            <div className="np-row">
              <input
                className="name-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom du joueur"
                maxLength={20}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addNew()
                }}
              />
            </div>
            <div className="np-row">
              <select
                className="select-input"
                value={newTeam}
                onChange={(e) => setNewTeam(e.target.value as TeamKey)}
              >
                {TEAMS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="add-player" disabled={!newName.trim() || saving} onClick={addNew}>
              {saving ? 'Ajout…' : 'Enregistrer'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="empty">Chargement…</div>
        ) : players.length === 0 ? (
          <div className="empty">Aucun joueur enregistré. Ajoute le premier !</div>
        ) : (
          players.map((p) => (
            <div className="t-card" key={p.id} style={{ cursor: 'default' }}>
              <div>
                <div className="t-name">{p.name}</div>
                <div className="t-meta">{teamLabel(p.team)}</div>
              </div>
              <button className="t-del" title="Supprimer" onClick={(e) => onDelete(e, p.id, p.name)}>
                <IconTrash size={18} stroke={1.75} />
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
