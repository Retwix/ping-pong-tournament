import type { ReactNode } from 'react'
import type { Match } from '../types'
import { afterGame, longestReign, type Rotation } from '../lib/king'
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
  onEnd: (champion: string | null) => void
  scorer: (match: Match, onPatch: Patch) => ReactNode
}

/** A King of the Ping session at the table: the game being played, or « Au suivant » between games. */
export default function KingTable({ rotation, matches, look, onPatch, onRotation, onNext, onEnd, scorer }: Props) {
  const game = matches[matches.length - 1]
  if (!game) return null
  if (game.done) {
    const end = () => onEnd(longestReign(matches)?.player ?? null)
    return <AuSuivant rotation={rotation} matches={matches} look={look} onNext={onNext} onEnd={end} />
  }

  const patchGame: Patch = (patch) => {
    onPatch(game.id, patch)
    if (patch.done) onRotation(afterGame(rotation, winnerLoser(game).winner))
  }
  return scorer(game, patchGame)
}
