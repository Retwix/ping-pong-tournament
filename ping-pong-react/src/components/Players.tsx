import { useEffect, useState, type FormEvent } from 'react'
import { IconArrowLeft, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { createPlayer, deletePlayer, updatePlayer } from '../lib/db'
import { usePlayers } from '../hooks/usePlayers'
import { TEAMS, teamColor, teamLabel, type TeamKey } from '../lib/teams'
import ThemeToggle from './ThemeToggle'
import TopBack from './TopBack'

interface Props {
  onBack: () => void
}

export default function Players({ onBack }: Props) {
  const { players, loading, error, refresh } = usePlayers()

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [dept, setDept] = useState<TeamKey>('tech')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)

  const changeTeam = async (id: string, team: string) => {
    setEditingId(null)
    try {
      await updatePlayer(id, { team })
      refresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    }
  }

  // sort alphabetically (French locale)
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  // Escape closes the modal
  useEffect(() => {
    if (!adding) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAdding(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [adding])

  const openModal = () => {
    setName('')
    setDept('tech')
    setFormError(null)
    setAdding(true)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const nm = name.trim()
    if (!nm || saving) return
    if (players.some((p) => p.name.toLowerCase() === nm.toLowerCase())) {
      setFormError('Ce joueur existe déjà.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await createPlayer(nm, dept)
      setAdding(false)
      refresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: string) => {
    setLeaving((s) => new Set(s).add(id))
    setTimeout(() => {
      deletePlayer(id).catch(() => {
        // restore on failure
        setLeaving((s) => {
          const next = new Set(s)
          next.delete(id)
          return next
        })
      })
    }, 270)
  }

  return (
    <div className="wrap">
      <TopBack onClick={onBack} />
      <header>
        <ThemeToggle className="header-toggle" />
        <div className="eyebrow">Registre des joueurs</div>
        <h1>
          Les <span className="em">joueurs</span>
        </h1>
        <p className="subtitle">
          Ajoute, gère et supprime les joueurs. Supprimer un joueur ne touche pas aux tournois ni
          aux parties déjà jouées.
        </p>
      </header>

      {error && <div className="error-banner">Erreur : {error}</div>}

      <section>
        <div className="home-top">
          <span className="setup-label" style={{ margin: 0 }}>
            {sorted.length} joueur{sorted.length > 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={openModal}>
              <IconPlus size={16} stroke={1.8} />
              Nouveau joueur
            </button>
            <button className="link-btn" onClick={onBack}>
              <IconArrowLeft size={16} stroke={1.8} />
              Accueil
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty">Chargement…</div>
        ) : sorted.length === 0 ? (
          <div className="empty">Aucun joueur pour l'instant. Ajoute le premier membre de l'équipe.</div>
        ) : (
          sorted.map((p, i) => {
            const color = teamColor(p.team)
            const initial = (p.name.trim()[0] ?? '?').toUpperCase()
            const isLeaving = leaving.has(p.id)
            return (
              <div
                key={p.id}
                className={`t-card ${isLeaving ? 'leaving' : 'enter'}`}
                style={{
                  cursor: 'default',
                  animationDelay: isLeaving ? undefined : `${Math.min(i, 12) * 35}ms`,
                }}
              >
                <div className="avatar" style={{ background: `${color}24`, color }}>
                  {initial}
                </div>
                <div className="player-block">
                  <div className="t-name">{p.name}</div>
                  {editingId === p.id ? (
                    <select
                      className="select-input team-edit"
                      value={p.team}
                      autoFocus
                      onChange={(e) => changeTeam(p.id, e.target.value)}
                      onBlur={() => setEditingId(null)}
                    >
                      {TEAMS.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="player-dept">
                      <span className="dept-dot" style={{ background: color }} />
                      {teamLabel(p.team)}
                    </div>
                  )}
                </div>
                <button
                  className="t-del"
                  title="Changer le pôle"
                  onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                >
                  <IconPencil size={17} stroke={1.75} />
                </button>
                <button className="t-del" title="Supprimer" onClick={() => handleDelete(p.id)}>
                  <IconTrash size={17} stroke={1.75} />
                </button>
              </div>
            )
          })
        )}
      </section>

      {adding && (
        <div
          className="scrim"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAdding(false)
          }}
        >
          <form className="modal" onSubmit={submit}>
            <h2>Nouveau joueur</h2>
            <p className="modal-hint">Ajoute un membre de l'équipe au registre.</p>

            <div className="field">
              <label className="field-label">Nom</label>
              <input
                className="name-input"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex. Camille"
                maxLength={20}
              />
            </div>

            <div className="field">
              <label className="field-label">Pôle</label>
              <div className="chip-row">
                {TEAMS.map((t) => (
                  <button
                    type="button"
                    key={t.key}
                    className={`chip ${dept === t.key ? 'selected' : ''}`}
                    style={dept === t.key ? { color: t.color } : undefined}
                    onClick={() => setDept(t.key)}
                  >
                    <span className="dept-dot" style={{ background: t.color }} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {formError && (
              <div className="error-banner" style={{ marginTop: 4, marginBottom: 0 }}>
                {formError}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="link-btn" onClick={() => setAdding(false)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={!name.trim() || saving}>
                <IconPlus size={16} stroke={1.8} />
                {saving ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
