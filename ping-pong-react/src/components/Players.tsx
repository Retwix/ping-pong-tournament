import { IconPencil, IconPlus, IconSearch, IconTrash, IconUpload, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useRatings } from '../hooks/useRatings'
import { processAvatarFile, validateAvatarFile } from '../lib/avatar'
import {
  createPlayer,
  deletePlayer,
  removePlayerAvatar,
  updatePlayer,
  uploadPlayerAvatar,
} from '../lib/db'
import {
  avatarAction,
  avatarZoom,
  dialogTitle,
  filterJoueurs,
  joueurRows,
  joueursSubtitle,
  normalizeJoueurForm,
  photoShown,
  teamChips,
  type AvatarZoom,
  type JoueurForm,
  type JoueurRow,
  type PhotoDraft,
} from '../lib/joueurs'
import { currentSeason, defaultLadderScope, ladderLabel } from '../lib/seasons'
import { TEAMS, teamBadgeStyle, teamLabel } from '../lib/teams'
import Avatar from './Avatar'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'
import { Loader } from './Loader'

interface Props {
  onHome: () => void
  onClassement: () => void
  onStats: () => void
  onNew: () => void
  onNewGame: () => void
}

export default function Players({ onHome, onClassement, onStats, onNew, onNewGame }: Props) {
  // Elo column = the season being played; matchs/victoires = the whole career.
  const { rows, historyEvents, players, loading, error, reload } =
    useRatings(defaultLadderScope(new Date()))
  const [query, setQuery] = useState('')
  const [team, setTeam] = useState('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [form, setForm] = useState<JoueurForm | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null)
  const [photo, setPhoto] = useState<PhotoDraft>({ kind: 'keep' })
  const [leftAt, setLeftAt] = useState<string | null>(null)
  const [zoom, setZoom] = useState<AvatarZoom | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const revokePreview = (draft: PhotoDraft) => {
    if (draft.kind === 'new') URL.revokeObjectURL(draft.previewUrl)
  }

  const openEdit = (r: JoueurRow) => {
    setForm({ name: r.name, team: r.team })
    setOriginalPhoto(r.avatarUrl)
    setPhoto({ kind: 'keep' })
    setLeftAt(r.leftAt)
    setSaveError(null)
    setEditing(r.id)
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const check = validateAvatarFile(file)
    if (!check.ok) {
      setSaveError(check.error)
      return
    }
    setSaveError(null)
    try {
      const blob = await processAvatarFile(file)
      const previewUrl = URL.createObjectURL(blob)
      setPhoto((prev) => {
        revokePreview(prev)
        return { kind: 'new', blob, previewUrl }
      })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  const removePhoto = () => {
    setPhoto((prev) => {
      revokePreview(prev)
      return { kind: 'remove' }
    })
  }

  // Immediate removal, per the handoff. Past matches keep their recorded names.
  const removeJoueur = async (r: JoueurRow) => {
    setSaveError(null)
    try {
      await deletePlayer(r.id)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    }
    reload()
  }

  // The handoff's optimistic create: the row exists before the modal opens
  // (which also gives photo uploads a real player id), and cancelling removes it.
  const addPlayer = async () => {
    if (creating) return
    setCreating(true)
    setSaveError(null)
    try {
      const p = await createPlayer('Nouveau joueur', 'tech')
      reload()
      setForm({ name: '', team: 'tech' })
      setOriginalPhoto(null)
      setPhoto({ kind: 'keep' })
      setLeftAt(null)
      setPending(p.id)
      setEditing(p.id)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  const cancel = async () => {
    const rollback = pending
    revokePreview(photo)
    setPhoto({ kind: 'keep' })
    setEditing(null)
    setPending(null)
    setForm(null)
    if (rollback === null) return
    try {
      await deletePlayer(rollback)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    }
    reload()
  }

  const save = async () => {
    if (editing === null || form === null || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const status: 'active' | 'alumni' = leftAt !== null ? 'alumni' : 'active'
      const patch = { ...normalizeJoueurForm(form), status, left_at: leftAt }
      if (photo.kind === 'new') {
        const url = await uploadPlayerAvatar(editing, photo.blob)
        await updatePlayer(editing, { ...patch, avatar_url: url })
      } else if (avatarAction(originalPhoto, photo) === 'remove') {
        await updatePlayer(editing, patch)
        await removePlayerAvatar(editing)
      } else {
        await updatePlayer(editing, patch)
      }
      revokePreview(photo)
      setPhoto({ kind: 'keep' })
      setEditing(null)
      setPending(null)
      setForm(null)
      reload()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (editing === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  useEffect(() => {
    if (zoom === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

  const annuaire = useMemo(
    () => joueurRows(players, rows, historyEvents),
    [players, rows, historyEvents],
  )
  // Which ladder the Elo column is. A season starts everyone at 1500, and a
  // column of 1500s reads as a bug unless the page names the season it is showing.
  const eloScope = `Elo · ${ladderLabel(currentSeason(new Date()))}`
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
        <Loader />
        {tabbar}
      </div>
    )
  }

  return (
    <div className="rv-page">
      {nav}

      {error && <div className="error-banner">Erreur : {error}</div>}
      {saveError && editing === null && <div className="error-banner">Erreur : {saveError}</div>}

      <div className="pl-head">
        <div className="pl-head-text">
          <h1 className="pl-title">Joueurs</h1>
          <p className="pl-sub">
            {joueursSubtitle(annuaire.length)}
            <span className="pl-sub-scope">{eloScope}</span>
          </p>
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
          <button className="pl-add" onClick={addPlayer} disabled={creating}>
            <IconPlus size={17} stroke={2.4} />
            Ajouter un joueur
          </button>
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
          <div />
        </div>

        {visible.map((r) => {
          const photo = avatarZoom(r)
          const avatar = (
            <Avatar
              name={r.name}
              team={r.team}
              url={r.avatarUrl}
              muted={r.status === 'alumni'}
              className="pl-av"
            />
          )
          return (
            <div
              key={r.id}
              className={`pl-tr pl-row${r.status === 'alumni' ? ' alumnus' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`Modifier ${r.name}`}
              onClick={() => openEdit(r)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                openEdit(r)
              }}
            >
              {photo === null ? (
                avatar
              ) : (
                <button
                  className="pl-av-btn"
                  title="Voir la photo"
                  aria-label={`Agrandir la photo de ${r.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setZoom(photo)
                  }}
                >
                  {avatar}
                </button>
              )}
              <div className="pl-c-name">
                <div className="pl-name">{r.name}</div>
                <div className="pl-meta">{r.meta}</div>
              </div>
              <div className="pl-c-team">
                <span className="pl-badge" style={teamBadgeStyle(r.team)}>
                  {r.team === '' ? '—' : teamLabel(r.team)}
                </span>
              </div>
              <div className="pl-c-elo">{r.elo}</div>
              <div className="pl-c-matchs">{r.matchsLabel}</div>
              <div className={`pl-c-win${r.winrateStrong ? ' strong' : ''}`}>{r.winrate}</div>
              <div className="pl-act">
                <button
                  className="pl-icon-btn edit"
                  title="Modifier"
                  aria-label={`Modifier ${r.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit(r)
                  }}
                >
                  <IconPencil size={15} stroke={2} />
                </button>
                <button
                  className="pl-icon-btn trash"
                  title="Retirer"
                  aria-label={`Retirer ${r.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeJoueur(r)
                  }}
                >
                  <IconTrash size={15} stroke={1.9} />
                </button>
              </div>
            </div>
          )
        })}

        {visible.length === 0 && (
          <div className="pl-empty">
            <div className="pl-empty-title">Aucun joueur trouvé</div>
            <div className="pl-empty-sub">Essaie un autre nom ou une autre équipe.</div>
          </div>
        )}
      </div>

      {editing !== null && form !== null && (
        <div
          className="scrim"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancel()
          }}
        >
          <div className="modal pl-modal">
            <div className="pl-modal-head">
              <div className="pl-modal-head-text">
                <h2 className="pl-modal-title">{dialogTitle(pending !== null, form.name)}</h2>
                <p className="pl-modal-sub">Nom, équipe et photo de profil.</p>
              </div>
              <button className="pl-close" onClick={cancel} aria-label="Fermer">
                <IconX size={16} stroke={2.2} />
              </button>
            </div>

            <div className="pl-photo">
              <button
                className="pl-mava-btn"
                title="Changer la photo"
                onClick={() => fileRef.current?.click()}
              >
                <Avatar
                  name={form.name}
                  team={form.team}
                  url={photoShown(originalPhoto, photo)}
                  className="pl-mava"
                />
              </button>
              <div className="pl-photo-text">
                <div className="pl-photo-title">Photo de profil</div>
                <div className="pl-photo-sub">
                  JPG ou PNG, carré de préférence. Sans photo, les initiales sont utilisées.
                </div>
                <div className="pl-photo-btns">
                  <button className="pl-pbtn" onClick={() => fileRef.current?.click()}>
                    <IconUpload size={14} stroke={2} />
                    {photoShown(originalPhoto, photo) !== null ? 'Remplacer' : 'Téléverser'}
                  </button>
                  {photoShown(originalPhoto, photo) !== null && (
                    <button className="pl-pbtn danger" onClick={removePhoto}>
                      Retirer
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              </div>
            </div>

            <div className="pl-field">
              <div className="pl-flabel">Nom</div>
              <input
                className="pl-finput"
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Prénom ou pseudo"
                maxLength={40}
              />
            </div>

            <div className="pl-field">
              <div className="pl-flabel">Équipe</div>
              <div className="pl-mchips">
                {TEAMS.map((t) => (
                  <button
                    key={t.key}
                    className={`pl-chip${form.team === t.key ? ' active' : ''}`}
                    onClick={() => setForm({ ...form, team: t.key })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <input
                className="pl-finput pl-finput-team"
                value={form.team}
                onChange={(e) => setForm({ ...form, team: e.target.value })}
                placeholder="ou saisis une autre équipe"
                maxLength={40}
              />
            </div>

            <div className="pl-field">
              <label className="pl-archive-toggle">
                <input
                  type="checkbox"
                  checked={leftAt !== null}
                  onChange={(e) =>
                    setLeftAt(e.target.checked ? new Date().toISOString().slice(0, 10) : null)
                  }
                />
                A quitté l'entreprise
              </label>
              {leftAt !== null && (
                <input
                  type="date"
                  className="pl-finput"
                  value={leftAt}
                  onChange={(e) => setLeftAt(e.target.value)}
                />
              )}
            </div>

            {saveError && <div className="error-banner pl-modal-error">{saveError}</div>}

            <div className="pl-modal-foot">
              <button className="pl-btn-ghost" onClick={cancel}>
                Annuler
              </button>
              <button className="pl-btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {zoom !== null && (
        <div className="scrim pl-zoom" onMouseDown={() => setZoom(null)}>
          <img className="pl-zoom-img" src={zoom.url} alt={zoom.alt} />
          <button className="pl-close pl-zoom-close" onClick={() => setZoom(null)} aria-label="Fermer">
            <IconX size={16} stroke={2.2} />
          </button>
        </div>
      )}

      {tabbar}
    </div>
  )
}
