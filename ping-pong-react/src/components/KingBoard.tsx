import { useMemo } from 'react'
import type { useTournament } from '../hooks/useTournament'
import { addKingGame } from '../lib/db'
import { libelleFormat } from '../lib/format'
import { sideBios } from '../lib/playerBio'
import { playerLookup } from '../lib/playerLookup'
import { navigate } from '../lib/router'
import type { SideElos } from '../lib/scorerElo'
import type { Match, Player, Tournament } from '../types'
import KingTable from './KingTable'
import LiveScorer from './LiveScorer'

type Session = Pick<ReturnType<typeof useTournament>, 'patchMatch' | 'setRotation' | 'endSession' | 'abandonGame'>

interface Props {
  tournament: Tournament
  matches: Match[]
  registry: Player[]
  elosFor: (match: Match) => SideElos
  session: Session
  onBack: () => void
  presentTo: string
}

/** A King of the Ping session run from this device: the table, wired to the session's writes. */
export default function KingBoard({ tournament, matches, registry, elosFor, session, onBack, presentTo }: Props) {
  const look = useMemo(() => playerLookup(registry), [registry])
  return (
    <KingTable
      rotation={tournament.players}
      players={registry.map((p) => p.name)}
      matches={matches}
      ended={tournament.status === 'done'}
      look={look}
      onPatch={session.patchMatch}
      onRotation={session.setRotation}
      onNext={() => {
        addKingGame(tournament.id, tournament.players, matches).catch((e) =>
          console.error('addKingGame failed', e),
        )
      }}
      onEnd={session.endSession}
      onClose={onBack}
      onAbandon={session.abandonGame}
      scorer={(match, onPatch) => (
        <LiveScorer
          match={match}
          target={tournament.target}
          onPatch={onPatch}
          onClose={onBack}
          tournamentName={tournament.name}
          subtitle={libelleFormat(tournament)}
          elos={elosFor(match)}
          bios={sideBios(registry, match)}
          onPresent={() => navigate(presentTo)}
        />
      )}
    />
  )
}
