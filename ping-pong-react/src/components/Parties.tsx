import { useEffect, useMemo, useState } from 'react'
import { IconChevronRight, IconPlayerPlay, IconSearch, IconTrophy } from '@tabler/icons-react'
import { useCurrentTournament } from '../hooks/useCurrentTournament'
import { useRatings } from '../hooks/useRatings'
import { useTournament } from '../hooks/useTournament'
import { pickLiveMatch } from '../lib/liveHero'
import { signed } from '../lib/format'
import {
  MATCHES_PAGE_INITIAL,
  MATCHES_PAGE_STEP,
  applySort,
  filterMatchRows,
  filterTournamentRows,
  historySubtitle,
  loadMoreLabel,
  matchRows,
  showLiveBlock,
  sortLabel,
  tournamentRows,
  visibleBlocks,
  type MatchRow,
  type PartiesFilter,
  type SortDir,
  type TournamentRow,
} from '../lib/parties'
import { playerLookup, type LookUpPlayer } from '../lib/playerLookup'
import type { Match } from '../types'
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
  empty,
}: {
  rows: TournamentRow[]
  look: LookUpPlayer
  onOpen: (id: string) => void
  empty: string
}) {
  return (
    <section className="pt-section">
      <div className="pt-sec-title">Tournois</div>
      <div className="pt-table">
        <div className="pt-tourrow pt-thead">
          <span />
          <span>Tournoi</span>
          <span>Vainqueur</span>
          <span className="pt-col-sec">Finaliste</span>
          <span className="pt-th-r pt-col-sec">Format</span>
          <span className="pt-th-r pt-col-sec">Fin</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div className="pt-empty-row">{empty}</div>
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
              <div className="pt-finalist pt-col-sec">{row.finalist ?? '—'}</div>
              <div className="pt-cell-r pt-col-sec">{row.formatLabel}</div>
              <div className="pt-cell-r pt-col-sec">
                {row.endedAt === null ? '—' : finDate(row.endedAt)}
              </div>
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
  onFilterChange: (filter: PartiesFilter) => void
  onLive: () => void
  onRef: () => void
}

function LiveCard({
  live,
  target,
  look,
  onWatch,
  onRef,
}: {
  live: Match
  target: number
  look: LookUpPlayer
  onWatch: () => void
  onRef: () => void
}) {
  return (
    <section className="pt-section">
      <div className="pt-sec-title">
        En direct
        <span className="pt-live-pill">1 table occupée</span>
      </div>
      <div className="pt-live-card">
        <div className="pt-live-meta">
          <div className="pt-live-badge">
            <span className="rv-t-dot" /> EN DIRECT
          </div>
          <div className="pt-live-target">Jeu en {target}</div>
        </div>
        <div className="pt-live-matchup">
          <div className="pt-live-player">
            <Avatar
              name={live.player_a}
              team={look(live.player_a).team}
              url={look(live.player_a).url}
              className="pt-live-av"
            />
            <span className="pt-live-name">{live.player_a}</span>
          </div>
          <div className="pt-live-score">
            {live.score_a} <span className="pt-live-dash">–</span> {live.score_b}
          </div>
          <div className="pt-live-player">
            <span className="pt-live-name">{live.player_b}</span>
            <Avatar
              name={live.player_b}
              team={look(live.player_b).team}
              url={look(live.player_b).url}
              className="pt-live-av"
            />
          </div>
        </div>
        <div className="pt-live-actions">
          <button className="pt-live-watch" onClick={onWatch}>
            <IconPlayerPlay size={15} stroke={2} /> Regarder
          </button>
          <button className="pt-live-ref" onClick={onRef}>
            Arbitrer
          </button>
        </div>
      </div>
    </section>
  )
}

/** « Tournois & parties » — the full history page, reached from the Accueil links (not a tab). */
function MatchesTable({
  rows,
  total,
  look,
  onOpen,
  onMore,
  empty,
}: {
  rows: MatchRow[]
  total: number
  look: LookUpPlayer
  onOpen: (id: string) => void
  onMore: () => void
  empty: string
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
          <span className="pt-th-r pt-col-sec">Compétition</span>
          <span className="pt-th-r pt-col-sec">Date</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div className="pt-empty-row">{empty}</div>
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
              <div className="pt-cell-r pt-ellip pt-col-sec">{row.competition}</div>
              <div className="pt-cell-r pt-col-sec">
                {row.endedAt === null ? '—' : finDate(row.endedAt)}
              </div>
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
  filter,
  onHome,
  onClassement,
  onStats,
  onPlayers,
  onNew,
  onNewGame,
  onOpenTournament,
  onFilterChange,
  onLive,
  onRef,
}: Props) {
  const { matches, tournaments, players, events, loading, error } = useRatings()
  const { id: currentId } = useCurrentTournament()
  const { tournament: currentTournament, matches: currentMatches } = useTournament(currentId)
  const live = pickLiveMatch(currentMatches)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(MATCHES_PAGE_INITIAL)
  const [dir, setDir] = useState<SortDir>('recent')

  useEffect(() => {
    setShown(MATCHES_PAGE_INITIAL)
  }, [query, filter])

  const look = useMemo(() => playerLookup(players), [players])
  const tourRows = useMemo(() => tournamentRows(tournaments, matches), [tournaments, matches])
  const allMatchRows = useMemo(
    () => matchRows(matches, events, tournaments),
    [matches, events, tournaments],
  )
  const shownTourRows = useMemo(
    () => applySort(filterTournamentRows(tourRows, query), dir),
    [tourRows, query, dir],
  )
  const filteredMatchRows = useMemo(
    () => applySort(filterMatchRows(allMatchRows, query), dir),
    [allMatchRows, query, dir],
  )

  const blocks = visibleBlocks(filter)
  const searching = query.trim() !== ''

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

      <div className="pt-filters">
        <div className="pt-chips">
          <button
            className={`pt-chip${filter === 'all' ? ' active' : ''}`}
            onClick={() => onFilterChange('all')}
          >
            Tout
          </button>
          <button
            className={`pt-chip${filter === 'match' ? ' active' : ''}`}
            onClick={() => onFilterChange('match')}
          >
            Parties · {allMatchRows.length}
          </button>
          <button
            className={`pt-chip${filter === 'tour' ? ' active' : ''}`}
            onClick={() => onFilterChange('tour')}
          >
            Tournois · {tourRows.length}
          </button>
        </div>
        <button
          className="pt-chip"
          onClick={() => setDir((d) => (d === 'recent' ? 'oldest' : 'recent'))}
        >
          {sortLabel(dir)}
        </button>
      </div>

      {currentTournament !== null && live !== null && showLiveBlock(filter, live) && (
        <LiveCard
          live={live}
          target={currentTournament.target}
          look={look}
          onWatch={onLive}
          onRef={onRef}
        />
      )}

      {blocks.tournois && (
        <TournoisTable
          rows={shownTourRows}
          look={look}
          onOpen={onOpenTournament}
          empty={
            searching
              ? 'Aucun tournoi ne correspond à cette recherche.'
              : "Aucun tournoi pour l'instant."
          }
        />
      )}

      {blocks.parties && (
        <MatchesTable
          rows={filteredMatchRows.slice(0, shown)}
          total={filteredMatchRows.length}
          look={look}
          onOpen={onOpenTournament}
          onMore={() => setShown((s) => s + MATCHES_PAGE_STEP)}
          empty={
            searching
              ? 'Aucun match ne correspond à cette recherche.'
              : "Aucun match terminé pour l'instant."
          }
        />
      )}

      {tabbar}
    </div>
  )
}
