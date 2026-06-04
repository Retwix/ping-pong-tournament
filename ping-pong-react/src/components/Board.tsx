import { useState } from 'react'
import { useTournament } from '../hooks/useTournament'
import { resetTournament } from '../lib/db'
import MatchList from './MatchList'
import Standings from './Standings'
import LiveScorer from './LiveScorer'
import Champion from './Champion'

interface Props {
  id: string
  onBack: () => void
  onNew: () => void
}

export default function Board({ id, onBack, onNew }: Props) {
  const { tournament, matches, loading, error, patchMatch } = useTournament(id)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dismissedChampion, setDismissedChampion] = useState(false)

  if (loading) {
    return (
      <div className="wrap">
        <p className="empty">Chargement…</p>
      </div>
    )
  }
  if (!tournament) {
    return (
      <div className="wrap">
        <div className="error-banner">Tournoi introuvable.</div>
        <button className="link-btn" onClick={onBack}>
          ← Tous les tournois
        </button>
      </div>
    )
  }

  const openMatch = matches.find((m) => m.id === openId) ?? null
  const showChampion = tournament.status === 'done' && !dismissedChampion

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      /* clipboard unavailable */
    }
  }
  const reset = async () => {
    if (confirm('Réinitialiser tous les scores de ce tournoi ?')) {
      setDismissedChampion(false)
      await resetTournament(id)
    }
  }

  return (
    <div className="wrap">
      <header>
        <div className="kicker">
          Round-robin · {tournament.players.length} joueurs · {matches.length} matchs · jeu en{' '}
          {tournament.target}
        </div>
        <h1>{tournament.name}</h1>
        <p className="subtitle">Tape un match pour ouvrir le marqueur. Tout se synchronise en direct.</p>
        <div className="share-bar">
          <span className="url">{window.location.href}</span>
          <button className="link-btn" onClick={copyLink}>
            Copier le lien
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <MatchList tournament={tournament} matches={matches} onOpen={setOpenId} />

      <section>
        <div className="section-title">Classement</div>
        <Standings players={tournament.players} matches={matches} />
        <div className="footer-row">
          <span className="hint">Départage : victoires, puis différence de points.</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="reset" onClick={reset}>
              Réinitialiser
            </button>
            <button className="link-btn" onClick={onBack}>
              ← Tous les tournois
            </button>
          </div>
        </div>
      </section>

      {openMatch && (
        <LiveScorer
          match={openMatch}
          target={tournament.target}
          onPatch={(patch) => patchMatch(openMatch.id, patch)}
          onClose={() => setOpenId(null)}
          onFinish={() => setOpenId(null)}
        />
      )}

      {showChampion && (
        <Champion
          tournament={tournament}
          matches={matches}
          onClose={() => setDismissedChampion(true)}
          onNew={onNew}
        />
      )}
    </div>
  )
}
