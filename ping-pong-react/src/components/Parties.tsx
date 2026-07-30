import { useMemo, useState } from 'react'
import { IconChevronRight, IconSearch, IconTrophy } from '@tabler/icons-react'
import { useRatings } from '../hooks/useRatings'
import { signed } from '../lib/format'
import {
  MATCHES_PAGE_INITIAL,
  MATCHES_PAGE_STEP,
  historySubtitle,
  loadMoreLabel,
  matchRows,
  tournamentRows,
  type MatchRow,
  type PartiesFilter,
  type TournamentRow,
} from '../lib/parties'
import { playerLookup, type LookUpPlayer } from '../lib/playerLookup'
import Avatar from './Avatar'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'
import NewMenu from './NewMenu'

const finDate = (at: string): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })

function TournoisTable({
  rows,
  look,
  onOpen,
}: {
  rows: TournamentRow[]
  look: LookUpPlayer
  onOpen: (id: string) => void
}) {
  return (
    <section className="pt-section">
      <div className="pt-sec-title">Tournois</div>
      <div className="pt-table">
        <div className="pt-tourrow pt-thead">
          <span />
          <span>Tournoi</span>
          <span>Vainqueur</span>
          <span>Finaliste</span>
          <span className="pt-th-r">Format</span>
          <span className="pt-th-r">Fin</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div className="pt-empty-row">Aucun tournoi pour l'instant.</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="pt-tourrow pt-row" onClick={() => onOpen(row.id)}>
              <span className="pt-ticon">
                <IconTrophy size={17} stroke={2} />
              </span>
              <div className="pt-tname">
                <div className="pt-tname-main">{row.name}</div>
                <div className="pt-tname-sub">{row.playersCount} joueurs</div>
              </div>
              <div className="pt-winner">
                {row.active ? (
                  <span className="rv-t-status live">
                    <span className="rv-t-dot" /> En cours
                  </span>
                ) : row.champion === null ? (
                  <span className="pt-dash">—</span>
                ) : (
                  <>
                    <Avatar
                      name={row.champion}
                      team={look(row.champion).team}
                      url={look(row.champion).url}
                      className="pt-av"
                    />
                    <div className="pt-winner-text">
                      <div className="pt-winner-name">{row.champion}</div>
                      <div className="pt-winner-lbl">vainqueur</div>
                    </div>
                  </>
                )}
              </div>
              <div className="pt-finalist">{row.finalist ?? '—'}</div>
              <div className="pt-cell-r">{row.formatLabel}</div>
              <div className="pt-cell-r">{row.endedAt === null ? '—' : finDate(row.endedAt)}</div>
              <IconChevronRight size={15} stroke={1.75} className="pt-chevron" />
            </div>
          ))
        )}
      </div>
    </section>
  )
}

interface Props {
  filter: PartiesFilter
  onHome: () => void
  onClassement: () => void
  onStats: () => void
  onPlayers: () => void
  onNew: () => void
  onNewGame: () => void
  onOpenTournament: (id: string) => void
}

/** « Tournois & parties » — the full history page, reached from the Accueil links (not a tab). */
function MatchesTable({
  rows,
  total,
  look,
  onOpen,
  onMore,
}: {
  rows: MatchRow[]
  total: number
  look: LookUpPlayer
  onOpen: (id: string) => void
  onMore: () => void
}) {
  const more = loadMoreLabel(total - rows.length)
  return (
    <section className="pt-section">
      <div className="pt-sec-title">Parties</div>
      <div className="pt-table">
        <div className="pt-matchrow pt-thead">
          <span />
          <span>Match</span>
          <span className="pt-th-c">Score</span>
          <span className="pt-th-r">Elo</span>
          <span className="pt-th-r">Compétition</span>
          <span className="pt-th-r">Date</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div className="pt-empty-row">Aucun match terminé pour l'instant.</div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="pt-matchrow pt-row"
              onClick={() => onOpen(row.tournamentId)}
            >
              <Avatar
                name={row.winner}
                team={look(row.winner).team}
                url={look(row.winner).url}
                className="pt-av-sm"
              />
              <div className="pt-match-phrase">
                <span className="pt-match-winner">{row.winner}</span>
                <span className="pt-match-verb"> bat </span>
                {row.loser}
              </div>
              <div className="pt-score">
                {row.winnerScore}–{row.loserScore}
              </div>
              <div className="pt-delta">
                {row.eloDelta === null ? <span className="pt-dash">—</span> : signed(row.eloDelta)}
              </div>
              <div className="pt-cell-r pt-ellip">{row.competition}</div>
              <div className="pt-cell-r">{row.endedAt === null ? '—' : finDate(row.endedAt)}</div>
              <IconChevronRight size={15} stroke={1.75} className="pt-chevron" />
            </div>
          ))
        )}
      </div>
      {more !== null && (
        <button className="pt-more" onClick={onMore}>
          {more}
        </button>
      )}
    </section>
  )
}

export default function Parties({
  onHome,
  onClassement,
  onStats,
  onPlayers,
  onNew,
  onNewGame,
  onOpenTournament,
}: Props) {
  const { matches, tournaments, players, events, loading, error } = useRatings()
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(MATCHES_PAGE_INITIAL)

  const look = useMemo(() => playerLookup(players), [players])
  const tourRows = useMemo(() => tournamentRows(tournaments, matches), [tournaments, matches])
  const allMatchRows = useMemo(
    () => matchRows(matches, events, tournaments),
    [matches, events, tournaments],
  )

  const nav = (
    <DashboardNav
      onHome={onHome}
      onClassement={onClassement}
      onStats={onStats}
      onPlayers={onPlayers}
      onNew={onNew}
      onNewGame={onNewGame}
    />
  )
  const tabbar = (
    <DashboardTabBar
      onHome={onHome}
      onClassement={onClassement}
      onStats={onStats}
      onPlayers={onPlayers}
      onNew={onNew}
      onNewGame={onNewGame}
    />
  )

  if (loading) {
    return (
      <div className="rv-page">
        {nav}
        <p className="empty">Chargement…</p>
        {tabbar}
      </div>
    )
  }

  return (
    <div className="rv-page">
      {nav}

      {error && <div className="error-banner">Erreur : {error}</div>}

      <button className="pt-crumb" onClick={onHome}>
        ‹ Accueil
      </button>

      <div className="pt-head">
        <div className="pt-head-text">
          <h1 className="pt-title">Tournois &amp; parties</h1>
          <p className="pt-sub">{historySubtitle(matches, tournaments)}</p>
        </div>
        <div className="pt-head-actions">
          <label className="pt-search">
            <IconSearch size={17} stroke={2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Joueur, tournoi…"
              aria-label="Chercher un joueur ou un tournoi"
            />
          </label>
          <NewMenu onNew={onNew} onNewGame={onNewGame} />
        </div>
      </div>

      <TournoisTable rows={tourRows} look={look} onOpen={onOpenTournament} />

      <MatchesTable
        rows={allMatchRows.slice(0, shown)}
        total={allMatchRows.length}
        look={look}
        onOpen={onOpenTournament}
        onMore={() => setShown((s) => s + MATCHES_PAGE_STEP)}
      />

      {tabbar}
    </div>
  )
}
