import type { ReactNode } from 'react'
import type { Match } from '../types'
import { afterGame, type Rotation } from '../lib/king'
import type { LookUpPlayer } from '../lib/playerLookup'
import { winnerLoser } from '../lib/stats'
import AuSuivant from './AuSuivant'

type Patch = (patch: Partial<Match>) => void

interface Props {
  rotation: Rotation
  matches: ReadonlyArray<Match>
  look: LookUpPlayer
  onPatch: (matchId: string, patch: Partial<Match>) => void
  onRotation: (rotation: Rotation) => void
  onNext: () => void
  scorer: (match: Match, onPatch: Patch) => ReactNode
}

/** A King of the Ping session at the table: the game being played, or « Au suivant » between games. */
export default function KingTable({ rotation, matches, look, onPatch, onRotation, onNext, scorer }: Props) {
  const game = matches[matches.length - 1]
  if (!game) return null
  if (game.done) return <AuSuivant rotation={rotation} matches={matches} look={look} onNext={onNext} />

  const patchGame: Patch = (patch) => {
    onPatch(game.id, patch)
    if (patch.done) onRotation(afterGame(rotation, winnerLoser(game).winner))
  }
  return scorer(game, patchGame)
}
