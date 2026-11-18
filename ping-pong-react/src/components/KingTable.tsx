import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Match } from '../types'
import { afterGame, leaveTable, sessionCrown, type Rotation } from '../lib/king'
import type { LookUpPlayer } from '../lib/playerLookup'
import { winnerLoser } from '../lib/stats'
import AuSuivant from './AuSuivant'
import KingCrown from './KingCrown'
import KingFile from './KingFile'

type Patch = (patch: Partial<Match>) => void

interface Props {
  rotation: Rotation
  players: ReadonlyArray<string>
  matches: ReadonlyArray<Match>
  ended: boolean
  look: LookUpPlayer
  onPatch: (matchId: string, patch: Partial<Match>) => void
  onRotation: (rotation: Rotation) => void
  onNext: () => void
  onEnd: (champion: string | null) => void
  onClose: () => void
  onAbandon: (gameId: string, rotation: Rotation) => void
  scorer: (match: Match, onPatch: Patch) => ReactNode
}

/** A King of the Ping session at the table: the game being played, « Au suivant » between games, the crown once it has ended. */
export default function KingTable({
  rotation,
  players,
  matches,
  ended,
  look,
  onPatch,
  onRotation,
  onNext,
  onEnd,
  onClose,
  onAbandon,
  scorer,
}: Props) {
  const [editingFile, setEditingFile] = useState(false)
  const [leaving, setLeaving] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const game = matches[matches.length - 1]
  const crown = sessionCrown(matches)
  const end = () => {
    onEnd(crown?.champion.player ?? null)
    if (!crown) onClose()
  }
  if (ended) return <KingCrown crown={crown} look={look} onClose={onClose} />
  if (rotation.length < 2) return null
  if (!game || game.done)
    return (
      <AuSuivant
        rotation={rotation}
        players={players}
        matches={matches}
        look={look}
        onNext={onNext}
        onEnd={end}
        onRotation={onRotation}
      />
    )

  const patchGame: Patch = (patch) => {
    onPatch(game.id, patch)
    if (patch.done) onRotation(afterGame(rotation, winnerLoser(game).winner))
  }
  return (
    <>
      {scorer(game, patchGame)}
      {createPortal(
        <>
          <button className="kt-file-btn" aria-label="File" onClick={() => setEditingFile(true)}>
            File · {rotation.length - 2}
          </button>
          {editingFile && (
            <div
              className="kt-sheet"
              role="dialog"
              aria-label="File"
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="kt-sheet-panel">
                <div className="ks-label kt-table">
                  {[game.player_a, game.player_b].map((name) => (
                    <span key={name}>
                      {name}
                      <button
                        className="ks-file-leave"
                        aria-label={`Retirer ${name}`}
                        onClick={() => setLeaving(name)}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                {leaving && (
                  <div className="kt-abandon">
                    <p>{leaving} quitte la table : la partie s’arrête, rien n’est compté.</p>
                    <button
                      className="tk-btn"
                      onClick={() => {
                        setEditingFile(false)
                        setLeaving(null)
                        const left = leaveTable(rotation, leaving)
                        onAbandon(game.id, left)
                        if (left.length === 1) end()
                      }}
                    >
                      Abandonner la partie
                    </button>
                  </div>
                )}
                {ending && (
                  <div className="kt-abandon">
                    <p>La partie en cours s’arrête, rien n’en est compté.</p>
                    <button
                      className="tk-btn"
                      onClick={() => {
                        onAbandon(game.id, rotation)
                        end()
                      }}
                    >
                      Terminer la session
                    </button>
                  </div>
                )}
                <KingFile rotation={rotation} players={players} onRotation={onRotation} />
                <button className="tk-btn tk-btn--ghost" onClick={() => setEnding(true)}>
                  Terminer
                </button>
                <button className="tk-btn tk-btn--ghost" onClick={() => setEditingFile(false)}>
                  Fermer
                </button>
              </div>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  )
}
