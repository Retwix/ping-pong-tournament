import { useMemo, useState } from 'react'
import { IconChevronLeft, IconCopy, IconDeviceTv, IconGavel } from '@tabler/icons-react'
import { usePlayers } from '../hooks/usePlayers'
import { useRatingDeltas } from '../hooks/useRatingDeltas'
import { useTournament } from '../hooks/useTournament'
import { createTournament } from '../lib/db'
import { chaosSettingsFromTournament } from '../lib/chaos'
import { libelleFormat } from '../lib/format'
import { playerLookup } from '../lib/playerLookup'
import { navigate } from '../lib/router'
import { isCapot, winnerLoser } from '../lib/stats'
import { enteteTournoi } from '../lib/tournamentBoard'
import type { Match } from '../types'
import CapotScreen from './CapotScreen'
import Champion from './Champion'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'
import GameResult from './GameResult'
import LiveScorer from './LiveScorer'
import MatchList from './MatchList'
import BracketView from './BracketView'
import Standings from './Standings'
import { Loader } from './Loader'

interface Props {
  id: string
  onBack: () => void
  onNew: () => void
  onNewGame: () => void
  onOpen: (id: string) => void
  onClassement: () => void
  onStats: () => void
  onPlayers: () => void
}

export default function Board({
  id,
  onBack,
  onNew,
  onNewGame,
  onOpen,
  onClassement,
  onStats,
  onPlayers,
}: Props) {
  const { tournament, matches, loading, error, patchMatch } = useTournament(id)
  const { players: registry } = usePlayers()
  const {
    forMatch: ratingsForMatch,
    forTournament: ratingsForTournament,
    elosFor,
  } = useRatingDeltas()
  const look = useMemo(() => playerLookup(registry), [registry])
  const [openId, setOpenId] = useState<string | null>(null)
  const [dismissedChampion, setDismissedChampion] = useState(false)
  const [capotMatch, setCapotMatch] = useState<Match | null>(null)

  if (loading) {
    return (
      <div className="wrap">
        <Loader />
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

  // A "game" is a single match: skip standings/champion. Show the scorer while it's
  // being played, then a result screen once the match is validated.
  if (tournament.kind === 'game') {
    const match = matches[0]
    if (!match) {
      return (
        <div className="wrap">
          <Loader />
        </div>
      )
    }
    if (match.done) {
      // Rematch = a brand-new game with the same players, so the finished one
      // stays in history/stats instead of being overwritten.
      // Carry the whole setup over: chaos config, « non classée », and the
      // doubles pairs — a rematch is the same game with fresh scores.
      const rematch = async () => {
        const newId = await createTournament(
          tournament.name,
          tournament.players,
          tournament.target,
          'game',
          'round_robin',
          chaosSettingsFromTournament(tournament),
          tournament.unranked ?? false,
          tournament.teams === null ? null : [tournament.teams[0] ?? [], tournament.teams[1] ?? []],
        )
        onOpen(newId)
      }
      return (
        <GameResult
          match={match}
          onReplay={rematch}
          onHome={onBack}
          ratings={ratingsForMatch(match)}
          look={look}
        />
      )
    }
    return (
      <LiveScorer
        match={match}
        target={tournament.target}
        chaos={chaosSettingsFromTournament(tournament)}
        onPatch={(patch) => patchMatch(match.id, patch)}
        onClose={onBack}
        onFinish={() => {
          /* match.done flips via the patch above, which renders GameResult */
        }}
        tournamentName={tournament.name}
        subtitle={libelleFormat(tournament)}
        elos={elosFor(match)}
        onPresent={() => navigate(`/t/${id}/live`)}
      />
    )
  }

  const isDouble = tournament.format === 'double_elim'
  const entete = enteteTournoi(tournament)
  const openMatch = matches.find((m) => m.id === openId) ?? null
  const capot = capotMatch ? winnerLoser(capotMatch) : null
  // Capot celebration takes precedence over the champion screen, so they don't stack.
  const showChampion = tournament.status === 'done' && !dismissedChampion && !capotMatch

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      /* clipboard unavailable */
    }
  }

  const retour = (
    <button className="tb-crumb" onClick={onBack}>
      <IconChevronLeft size={14} stroke={2.4} />
      Tous les tournois
    </button>
  )

  return (
    <div className="rv-page">
      <DashboardNav
        onHome={onBack}
        onClassement={onClassement}
        onStats={onStats}
        onPlayers={onPlayers}
        onNew={onNew}
        onNewGame={onNewGame}
      />

      {error && <div className="error-banner">{error}</div>}

      {retour}

      <div className="tb-head">
        <div className="tb-head-text">
          <div className="tb-kicker">{entete.kicker}</div>
          <h1 className="tb-title">
            {tournament.name}
            {entete.nonClasse && <span className="tb-badge-nc">Non classé</span>}
          </h1>
          <p className="tb-sub">{entete.sousTitre}</p>
        </div>
        <div className="tb-head-actions">
          <div className="tb-share">
            <span className="tb-share-url">{window.location.href}</span>
            <button className="tb-share-copy" onClick={copyLink}>
              <IconCopy size={15} stroke={2} />
              Copier le lien
            </button>
          </div>
          <button
            className="tb-ghost"
            onClick={() => navigate('/live')}
            title="Affichage spectateur (lien fixe) : suit automatiquement le match en cours"
          >
            <IconDeviceTv size={16} stroke={2} />
            Mode live
          </button>
          <button
            className="tb-ghost"
            onClick={() => navigate('/ref')}
            title="Mode arbitre (lien fixe) : marque le match en cours"
          >
            <IconGavel size={16} stroke={2} />
            Mode arbitre
          </button>
        </div>
      </div>

      {isDouble ? (
        <>
          <BracketView matches={matches} onOpen={setOpenId} />
          <div className="footer-row">
            <span className="hint">
              Tableau à double élimination : il faut perdre 2 fois pour être éliminé.
            </span>
            {retour}
          </div>
        </>
      ) : (
        <>
          <MatchList tournament={tournament} matches={matches} onOpen={setOpenId} />

          <section>
            <div className="section-title">Classement</div>
            <Standings
              players={tournament.players}
              matches={matches}
              ratings={ratingsForTournament(matches)}
            />
            <div className="footer-row">
              <span className="hint">Départage : victoires, puis différence de points.</span>
              {retour}
            </div>
          </section>
        </>
      )}

      {openMatch && (
        <LiveScorer
          match={openMatch}
          target={tournament.target}
          chaos={chaosSettingsFromTournament(tournament)}
          onPatch={(patch) => patchMatch(openMatch.id, patch)}
          onClose={() => setOpenId(null)}
          onFinish={() => {
            if (openMatch && isCapot(openMatch)) setCapotMatch(openMatch)
            setOpenId(null)
          }}
          tournamentName={tournament.name}
          subtitle={libelleFormat(tournament)}
          elos={elosFor(openMatch)}
          onPresent={() => navigate(`/t/${id}/live`)}
        />
      )}

      {capot && (
        <CapotScreen winner={capot.winner} loser={capot.loser} winnerScore={capot.ws} look={look}>
          <button className="tk-btn tk-btn--primary" onClick={() => setCapotMatch(null)}>
            Continuer
          </button>
        </CapotScreen>
      )}

      {showChampion && (
        <Champion
          tournament={tournament}
          matches={matches}
          ratings={ratingsForTournament(matches)}
          look={look}
          onClose={() => setDismissedChampion(true)}
          onNew={onNew}
        />
      )}

      <DashboardTabBar
        onHome={onBack}
        onClassement={onClassement}
        onStats={onStats}
        onPlayers={onPlayers}
        onNew={onNew}
        onNewGame={onNewGame}
      />
    </div>
  )
}
