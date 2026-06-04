import { useState } from 'react'
import { createPlayer, createTournament } from '../lib/db'
import { matchCount, roundCount } from '../lib/roundRobin'
import { TEAMS, teamLabel, type TeamKey } from '../lib/teams'
import { usePlayers } from '../hooks/usePlayers'
import type { Player } from '../types'

interface Props {
  onCreated: (id: string) => void
  onCancel: () => void
}

const PRESETS = [11, 21, 15]

export default function Setup({ onCreated, onCancel }: Props) {
  const { players, loading: playersLoading } = usePlayers()

  const [name, setName] = useState('')
  const [target, setTarget] = useState(11)
  const [selected, setSelected] = useState<Player[]>([])

  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTeam, setNewTeam] = useState<TeamKey>('guests')
  const [savingPlayer, setSavingPlayer] = useState(false)

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const available = players.filter((p) => !selected.some((s) => s.id === p.id))

  const valid = selected.length >= 2
  const hint = valid
    ? (() => {
        const n = selected.length
        const odd = n % 2 !== 0
        return `${n} joueurs · ${matchCount(n)} matchs · ${roundCount(n)} tours${
          odd ? ' (avec exempts)' : ''
        }`
      })()
    : 'Sélectionne au moins 2 joueurs.'

  const addFromSelect = (id: string) => {
    const p = players.find((pl) => pl.id === id)
    if (p) setSelected((s) => [...s, p])
  }
  const removeSelected = (id: string) => setSelected((s) => s.filter((p) => p.id !== id))

  const addNewPlayer = async () => {
    const nm = newName.trim()
    if (!nm || savingPlayer) return
    if (players.some((p) => p.name.toLowerCase() === nm.toLowerCase())) {
      setError('Ce joueur existe déjà — choisis-le dans la liste.')
      return
    }
    setSavingPlayer(true)
    setError(null)
    try {
      const player = await createPlayer(nm, newTeam)
      setSelected((s) => [...s, player])
      setNewName('')
      setNewTeam('guests')
      setShowNew(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingPlayer(false)
    }
  }

  const generate = async () => {
    if (!valid || creating) return
    setCreating(true)
    setError(null)
    try {
      const id = await createTournament(
        name.trim() || 'Tournoi',
        selected.map((p) => p.name),
        target || 11
      )
      onCreated(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setCreating(false)
    }
  }

  const isPreset = PRESETS.includes(target)

  return (
    <div className="wrap">
      <header>
        <div className="kicker">Round-robin · nouveau tournoi</div>
        <h1>
          Tournoi <span className="em">ping-pong</span>
        </h1>
        <p className="subtitle">
          Choisis les joueurs, le format, puis génère les matchs. Les joueurs sont enregistrés (nom +
          équipe) pour les futures stats.
        </p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <section>
        <div className="section-title">Configuration</div>
        <div className="setup">
          <div className="setup-label">Nom du tournoi</div>
          <input
            className="name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tournoi du bureau"
            maxLength={40}
          />

          <div className="setup-divider" />

          <div className="setup-label">Joueurs</div>

          {selected.length > 0 && (
            <div className="players-edit">
              {selected.map((p, i) => (
                <div className="player-row" key={p.id}>
                  <span className="idx">{i + 1}</span>
                  <span className="pname">{p.name}</span>
                  <span className="team-tag">{teamLabel(p.team)}</span>
                  <button className="icon-btn" onClick={() => removeSelected(p.id)} title="Retirer">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* pick an existing player */}
          <div className="player-row" style={{ marginTop: selected.length ? 10 : 0 }}>
            <select
              className="select-input"
              value=""
              disabled={playersLoading || available.length === 0}
              onChange={(e) => {
                if (e.target.value) addFromSelect(e.target.value)
              }}
            >
              <option value="">
                {playersLoading
                  ? 'Chargement…'
                  : available.length === 0
                    ? 'Aucun joueur disponible — ajoute-en un'
                    : '— Ajouter un joueur —'}
              </option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {teamLabel(p.team)}
                </option>
              ))}
            </select>
          </div>

          {/* create a brand-new player */}
          {showNew ? (
            <div className="new-player">
              <div className="np-row">
                <input
                  className="name-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nom du joueur"
                  maxLength={20}
                  autoFocus
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
                <button className="icon-btn" onClick={() => setShowNew(false)} title="Annuler">
                  ✕
                </button>
              </div>
              <button className="add-player" disabled={!newName.trim() || savingPlayer} onClick={addNewPlayer}>
                {savingPlayer ? 'Ajout…' : 'Enregistrer et ajouter'}
              </button>
            </div>
          ) : (
            <button className="add-player" onClick={() => setShowNew(true)}>
              + Nouveau joueur
            </button>
          )}

          <div className="setup-divider" />

          <div className="setup-label">Points par jeu</div>
          <div className="target">
            {PRESETS.map((v) => (
              <button key={v} className={target === v ? 'active' : ''} onClick={() => setTarget(v)}>
                {v}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={99}
              inputMode="numeric"
              placeholder="autre"
              value={isPreset ? '' : target}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (v >= 1 && v <= 99) setTarget(v)
              }}
            />
          </div>

          <button className="generate" disabled={!valid || creating} onClick={generate}>
            {creating ? 'Création…' : 'Générer le tournoi'}
          </button>
          <p className="setup-hint">{hint}</p>
        </div>

        <div className="footer-row">
          <span className="hint">Départage : victoires, puis différence de points.</span>
          <button className="link-btn" onClick={onCancel}>
            ← Retour
          </button>
        </div>
      </section>
    </div>
  )
}
