import { useState } from 'react'
import { createTournament } from '../lib/db'
import { matchCount, roundCount } from '../lib/roundRobin'

interface Props {
  onCreated: (id: string) => void
  onCancel: () => void
}

const PRESETS = [11, 21, 15]
const MAX_PLAYERS = 16

export default function Setup({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('')
  const [players, setPlayers] = useState<string[]>(['', '', '', ''])
  const [target, setTarget] = useState(11)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = players.map((p) => p.trim())
  const filled = trimmed.filter((p) => p.length > 0)
  const lower = filled.map((p) => p.toLowerCase())
  const hasDupes = new Set(lower).size !== lower.length

  let valid = true
  let hint = ''
  if (filled.length < 2) {
    valid = false
    hint = 'Il faut au moins 2 joueurs nommés.'
  } else if (filled.length !== trimmed.length) {
    valid = false
    hint = "Certains joueurs n'ont pas de nom."
  } else if (hasDupes) {
    valid = false
    hint = 'Deux joueurs portent le même nom.'
  } else {
    const n = filled.length
    const odd = n % 2 !== 0
    hint = `${n} joueurs · ${matchCount(n)} matchs · ${roundCount(n)} tours${odd ? ' (avec exempts)' : ''}`
  }

  const setPlayer = (i: number, v: string) =>
    setPlayers((ps) => ps.map((p, idx) => (idx === i ? v : p)))
  const addPlayer = () => setPlayers((ps) => (ps.length >= MAX_PLAYERS ? ps : [...ps, '']))
  const removePlayer = (i: number) =>
    setPlayers((ps) => (ps.length <= 2 ? ps : ps.filter((_, idx) => idx !== i)))

  const generate = async () => {
    if (!valid || creating) return
    setCreating(true)
    setError(null)
    try {
      const id = await createTournament(name.trim() || 'Tournoi', filled, target || 11)
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
        <p className="subtitle">Ajoute tes joueurs, choisis le format, puis génère les matchs.</p>
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
          <div className="players-edit">
            {players.map((p, i) => (
              <div className="player-row" key={i}>
                <span className="idx">{i + 1}</span>
                <input
                  type="text"
                  value={p}
                  placeholder={`Joueur ${i + 1}`}
                  maxLength={20}
                  onChange={(e) => setPlayer(i, e.target.value)}
                />
                <button
                  className="icon-btn"
                  disabled={players.length <= 2}
                  onClick={() => removePlayer(i)}
                  title="Retirer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button className="add-player" disabled={players.length >= MAX_PLAYERS} onClick={addPlayer}>
            + Ajouter un joueur
          </button>

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
