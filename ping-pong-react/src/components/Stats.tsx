import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { IconX } from '@tabler/icons-react'
import { useStats } from '../hooks/useStats'
import {
  computeHeadToHead,
  computePlayerStats,
  computeRivalries,
  computeTeamStats,
  h2hWins,
  rivalryBalance,
  type PlayerStat,
  type Rivalry,
} from '../lib/stats'
import {
  DEFAULT_LEADERBOARD_SORT,
  PERIOD_OPTIONS,
  TYPE_OPTIONS,
  activityDays,
  chartRangeLabel,
  filterPillLabel,
  finalsByPlayer,
  isFiltered,
  leaderboardRows,
  matchRecords,
  playerCard,
  playerRecords,
  remontadasByName,
  scopeLabel,
  scopeMatches,
  sortLeaderboard,
  statsKpis,
  streakLabel,
  titlesByName,
  toggleSort,
  weekdayProfile,
  type LeaderboardSort,
  type LeaderboardSortKey,
  type PlayerTitles,
  type RecordCard as RecordCardData,
  type StatsFilters,
} from '../lib/statsPage'
import { signed } from '../lib/format'
import { teamColor, teamLabel } from '../lib/teams'
import type { Match } from '../types'
import Avatar from './Avatar'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'

const pct = (r: number) => `${Math.round(r * 100)}%`

interface Props {
  filters: StatsFilters
  onFiltersChange: (filters: StatsFilters) => void
  onHome: () => void
  onClassement: () => void
  onPlayers: () => void
  onNew: () => void
  onNewGame: () => void
}

export default function Stats({
  filters,
  onFiltersChange,
  onHome,
  onClassement,
  onPlayers,
  onNew,
  onNewGame,
}: Props) {
  const { matches, players, tournaments, loading, error } = useStats()
  const [sort, setSort] = useState<LeaderboardSort>(DEFAULT_LEADERBOARD_SORT)
  const [selected, setSelected] = useState<string | null>(null)
  const [tip, setTip] = useState<number | null>(null)

  const now = useMemo(() => new Date(), [matches])
  const scoped = useMemo(
    () => scopeMatches(matches, tournaments, filters, now),
    [matches, tournaments, filters, now],
  )

  const playerStats = useMemo(() => computePlayerStats(scoped, players), [scoped, players])
  const teamStats = useMemo(() => computeTeamStats(scoped, players), [scoped, players])
  const h2h = useMemo(() => computeHeadToHead(scoped), [scoped])

  const titles = useMemo(() => titlesByName(tournaments, matches), [tournaments, matches])
  const sortedRows = useMemo(
    () => sortLeaderboard(leaderboardRows(playerStats, titles), sort),
    [playerStats, titles, sort],
  )

  const matrixPlayers = useMemo(
    () => [...playerStats].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name, 'fr')),
    [playerStats],
  )

  const days = useMemo(() => activityDays(scoped), [scoped])
  const weekdays = useMemo(() => weekdayProfile(scoped), [scoped])

  const rivalries = useMemo(() => computeRivalries(scoped, players, 2), [scoped, players])
  const mostPlayed = useMemo(
    () =>
      [...rivalries]
        .sort((a, b) => b.total - a.total || (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? ''))
        .slice(0, 6),
    [rivalries],
  )
  const tightest = useMemo(
    () =>
      [...rivalries]
        .filter((r) => r.total >= 3)
        .sort((a, b) => rivalryBalance(b) - rivalryBalance(a) || b.total - a.total)
        .slice(0, 3),
    [rivalries],
  )

  const kpis = useMemo(() => statsKpis(scoped, filters, now), [scoped, filters, now])
  const recPlayers = useMemo(
    () =>
      playerRecords(
        playerStats,
        titles,
        finalsByPlayer(scoped),
        remontadasByName(tournaments, matches),
      ),
    [playerStats, titles, scoped, tournaments, matches],
  )
  const recMatches = useMemo(() => matchRecords(scoped), [scoped])

  const nav = (
    <DashboardNav
      active="stats"
      onHome={onHome}
      onClassement={onClassement}
      onPlayers={onPlayers}
      onNew={onNew}
      onNewGame={onNewGame}
    />
  )
  const tabbar = (
    <DashboardTabBar
      active="stats"
      onHome={onHome}
      onClassement={onClassement}
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

  const Th = ({
    k,
    children,
    title,
    className,
  }: {
    k: LeaderboardSortKey
    children: ReactNode
    title?: string
    className?: string
  }) => (
    <button
      className={`st-th${sort.key === k ? ' active' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => setSort(toggleSort(sort, k))}
      title={title}
    >
      {children}
      {sort.key === k ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : ''}
    </button>
  )

  const SectionHead = ({ title, hint }: { title: string; hint?: string }) => (
    <div className="st-sec-head">
      <span className="st-sec-title">{title}</span>
      {hint !== undefined && <span className="st-sec-hint">{hint}</span>}
      <span className="st-sec-rule" />
    </div>
  )

  const filtered = isFiltered(filters)
  const resetFilters = () => onFiltersChange({ period: 'tout', type: 'tout' })

  return (
    <div className="rv-page">
      {nav}

      {error && <div className="error-banner">Erreur : {error}</div>}

      <div className="st-head">
        <div className="st-head-text">
          <h1 className="st-title">Les stats</h1>
          <p className="st-sub">
            Toutes les parties terminées, parties rapides et tournois cumulés.
          </p>
        </div>
        <button className="st-elo-link" onClick={onClassement}>
          Voir le classement Elo →
        </button>
      </div>

      <div className="st-filterbar">
        <div className="st-seg-group">
          <span className="st-seg-label">Période</span>
          <div className="st-seg">
            {PERIOD_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={`st-seg-opt${filters.period === o.value ? ' active' : ''}`}
                onClick={() => onFiltersChange({ ...filters, period: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="st-seg-group">
          <span className="st-seg-label">Type</span>
          <div className="st-seg">
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={`st-seg-opt${filters.type === o.value ? ' active' : ''}`}
                onClick={() => onFiltersChange({ ...filters, type: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <span className="st-spacer" />
        {filtered && (
          <button className="st-reset" onClick={resetFilters}>
            <span className="st-reset-dot" />
            {filterPillLabel(filters)}
            <span className="st-reset-x">✕</span>
          </button>
        )}
        <span className="st-scope">{scopeLabel(scoped.length, filters)}</span>
      </div>

      {scoped.length === 0 ? (
        filtered ? (
          <div className="st-empty">
            <div className="st-empty-emoji">🏓</div>
            <div className="st-empty-title">Aucun match sur ce filtre</div>
            <p className="st-empty-sub">
              Essaie une autre période ou un autre type, ou reviens à la vue complète.
            </p>
            <button className="st-empty-reset" onClick={resetFilters}>
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="st-empty">
            <div className="st-empty-emoji">🏓</div>
            <div className="st-empty-title">Aucun match terminé pour l'instant</div>
            <p className="st-empty-sub">Joue une partie pour voir les stats !</p>
          </div>
        )
      ) : (
        <>
          {/* KPI strip */}
          <div className="st-kpis">
            {kpis.map((k) => (
              <div className="st-kpi" key={k.label}>
                <div className="st-kpi-label">{k.label}</div>
                <div className="st-kpi-value">
                  {k.value}
                  {k.unit !== null && <span className="st-kpi-unit"> {k.unit}</span>}
                </div>
                <div className={`st-kpi-sub${k.accent ? ' accent' : ''}`}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Activity over time */}
          {days.length > 1 && (
            <div className="st-activity">
              <div className="st-card st-chart-card">
                <div className="st-card-head">
                  <div className="st-card-title">Activité</div>
                  <div className="st-card-meta">
                    matchs par jour · {chartRangeLabel(days.length)}
                  </div>
                </div>
                <div className="st-plot">
                  {days.map((d, i) => {
                    const maxCount = Math.max(1, ...days.map((x) => x.count))
                    return (
                      <div
                        key={d.date}
                        className="st-col"
                        onMouseEnter={() => setTip(i)}
                        onMouseLeave={() => setTip(null)}
                      >
                        <div
                          className={`st-bar${d.peak || tip === i ? ' peak' : ''}`}
                          style={{ height: `${12 + (d.count / maxCount) * 88}%` }}
                        />
                      </div>
                    )
                  })}
                  {tip !== null && days[tip] !== undefined && (
                    <div
                      className="st-tip"
                      style={{ left: `${((tip + 0.5) / days.length) * 100}%` }}
                    >
                      <div className="st-tip-date">{days[tip].label}</div>
                      <div className="st-tip-count">
                        {days[tip].count} match{days[tip].count > 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </div>
                <div className="st-axis">
                  <span>{days[0].label}</span>
                  <span>{days[Math.floor(days.length / 2)].label}</span>
                  <span>{days[days.length - 1].label}</span>
                </div>
              </div>
              {weekdays.length > 0 && (
                <div className="st-card st-weekdays-card">
                  <div className="st-card-title">Par jour de semaine</div>
                  <div className="st-card-meta">quand on joue vraiment</div>
                  <div className="st-weekdays">
                    {weekdays.map((w) => (
                      <div key={w.label} className="st-wd-row">
                        <span className="st-wd-label">{w.label}</span>
                        <span className="st-wd-track">
                          <span
                            className={`st-wd-fill${w.top ? ' top' : ''}`}
                            style={{ width: `${w.pct}%` }}
                          />
                        </span>
                        <span className="st-wd-count">{w.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Player leaderboard */}
          <div>
            <SectionHead
              title="Classement des joueurs"
              hint="clique une ligne pour la fiche joueur"
            />
            <div className="st-lb">
              <div className="st-lb-inner">
                <div className="st-lbgrid st-lbhead">
                  <span className="st-th-static">#</span>
                  <Th k="name" className="left">
                    Joueur
                  </Th>
                  <Th k="played" title="Matchs joués">
                    J
                  </Th>
                  <Th k="wins" title="Victoires">
                    V
                  </Th>
                  <Th k="losses" title="Défaites" className="st-col-sec">
                    D
                  </Th>
                  <Th k="pct" title="Taux de victoire">
                    %
                  </Th>
                  <Th k="diff" title="Différence de points" className="st-col-sec">
                    Diff
                  </Th>
                  <Th k="streak" title="Série de victoires en cours">
                    Série
                  </Th>
                  <span
                    className="st-th-static right st-col-sec"
                    title="5 derniers résultats, le plus récent à droite"
                  >
                    Forme
                  </span>
                  <Th k="titles" title="Tournois gagnés">
                    🏆
                  </Th>
                  <Th
                    k="mbSaved"
                    title="Balles de match sauvées (un point de la défaite)"
                    className="st-col-sec"
                  >
                    BM ✓
                  </Th>
                  <Th
                    k="mbWasted"
                    title="Balles de match gâchées (point de match non converti)"
                    className="st-col-sec"
                  >
                    BM ✗
                  </Th>
                </div>
                {sortedRows.map((r, i) => (
                  <div
                    key={r.key}
                    className="st-lbgrid st-lbrow"
                    onClick={() => setSelected(r.key)}
                  >
                    <span className={`st-rank${i === 0 ? ' first' : ''}`}>{i + 1}</span>
                    <span className="st-player">
                      <Avatar name={r.name} team={r.team} url={r.avatar_url} className="st-av" />
                      <span className="st-player-text">
                        <span className="st-player-name">{r.name}</span>
                        {r.team !== null && (
                          <span className="st-player-team">
                            <span
                              className="st-team-dot"
                              style={{ background: teamColor(r.team) }}
                            />
                            {teamLabel(r.team)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="st-num">{r.played}</span>
                    <span className="st-num">{r.wins}</span>
                    <span className="st-num st-col-sec">{r.losses}</span>
                    <span className="st-pct">{pct(r.winRate)}</span>
                    <span
                      className={`st-diff st-col-sec${r.diff > 0 ? ' pos' : r.diff < 0 ? ' neg' : ''}`}
                    >
                      {signed(r.diff)}
                    </span>
                    <span className={`st-streak${r.currentStreak > 0 ? ' pos' : ''}`}>
                      {streakLabel(r.currentStreak)}
                    </span>
                    <span className="st-form st-col-sec">
                      {r.form.map((won, j) => (
                        <span
                          key={j}
                          className={`st-dot ${won ? 'w' : 'l'}`}
                          title={won ? 'Victoire' : 'Défaite'}
                        />
                      ))}
                    </span>
                    <span className="st-titles">{r.titles > 0 ? r.titles : ''}</span>
                    <span className="st-num st-mb-s st-col-sec">{r.matchBallsSaved}</span>
                    <span className="st-num st-mb-w st-col-sec">{r.matchBallsWasted}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Team leaderboard */}
          {teamStats.length > 0 && (
            <div>
              <SectionHead title="Classement des pôles" />
              <div className="st-teams">
                <div className="st-teams-table">
                  <div className="st-teamgrid st-lbhead">
                    <span className="st-th-static left">Pôle</span>
                    <span className="st-th-static">Joueurs</span>
                    <span className="st-th-static">J</span>
                    <span className="st-th-static">V</span>
                    <span className="st-th-static">%</span>
                    <span className="st-th-static">Diff</span>
                  </div>
                  {teamStats.map((t) => (
                    <div key={t.team} className="st-teamgrid st-teamrow">
                      <span className="st-team-name">
                        <span
                          className="st-team-dot lg"
                          style={{ background: teamColor(t.team) }}
                        />
                        {teamLabel(t.team)}
                      </span>
                      <span className="st-num st-muted">{t.players}</span>
                      <span className="st-num">{t.played}</span>
                      <span className="st-num">{t.wins}</span>
                      <span className="st-pct">{pct(t.winRate)}</span>
                      <span className={`st-diff${t.diff > 0 ? ' pos' : t.diff < 0 ? ' neg' : ''}`}>
                        {signed(t.diff)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="st-teams-note">
                  <div className="st-pm-sec" style={{ marginTop: 0 }}>
                    À savoir
                  </div>
                  <p>
                    Les matchs entre joueurs d'un même pôle sont exclus de ce classement : seuls les
                    duels inter-pôles comptent pour la victoire collective.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Records */}
          <div>
            <SectionHead title="Records" hint="les moments légendaires" />
            {recPlayers.length > 0 && (
              <>
                <div className="st-rec-group">Joueurs</div>
                <div className="st-rec-grid">
                  {recPlayers.map((r) => (
                    <RecordCard key={r.label} r={r} />
                  ))}
                </div>
              </>
            )}
            {recMatches.length > 0 && (
              <>
                <div className="st-rec-group">Matchs</div>
                <div className="st-rec-grid">
                  {recMatches.map((r) => (
                    <RecordCard key={r.label} r={r} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Head-to-head matrix */}
          {matrixPlayers.length > 1 && (
            <section>
              <div className="section-title">Confrontations directes</div>
              <div className="panel h2h-wrap">
                <table className="h2h">
                  <thead>
                    <tr>
                      <th className="corner" />
                      {matrixPlayers.map((c) => (
                        <th key={c.key} title={c.name}>
                          {(c.name.trim()[0] ?? '?').toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixPlayers.map((row) => (
                      <tr key={row.key}>
                        <th className="rowname" title={row.name}>
                          {row.name}
                        </th>
                        {matrixPlayers.map((col) => {
                          if (row.key === col.key)
                            return (
                              <td key={col.key} className="self">
                                ·
                              </td>
                            )
                          const w = h2hWins(h2h, row.key, col.key)
                          const l = h2hWins(h2h, col.key, row.key)
                          const cls = w > l ? 'pos' : w < l ? 'neg' : ''
                          return (
                            <td
                              key={col.key}
                              className={cls}
                              title={`${row.name} ${w}–${l} ${col.name}`}
                            >
                              {w + l === 0 ? '–' : `${w}-${l}`}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="setup-hint" style={{ textAlign: 'left' }}>
                Chaque case : victoires de la ligne contre la colonne (V-D). Vert = avantage à la
                ligne.
              </p>
            </section>
          )}

          {/* Rivalries */}
          {mostPlayed.length > 0 && (
            <section>
              <div className="section-title">Rivalités</div>
              {tightest.length > 0 && (
                <p className="setup-hint" style={{ textAlign: 'left', marginTop: 0 }}>
                  Les duels les plus serrés :{' '}
                  {tightest.map((r) => `${r.aName} vs ${r.bName}`).join(' · ')}
                </p>
              )}
              <div className="rivalry-grid">
                {mostPlayed.map((r) => (
                  <RivalryCard key={`${r.aKey}|${r.bKey}`} r={r} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {selected !== null && (
        <PlayerCardModal
          playerKey={selected}
          stats={playerStats}
          titles={titles}
          matches={scoped}
          now={now}
          onClose={() => setSelected(null)}
        />
      )}

      {tabbar}
    </div>
  )
}

function RecordCard({ r }: { r: RecordCardData }) {
  return (
    <div className="st-rec-card">
      <div className="st-rec-head">
        <span className="st-rec-icon" aria-hidden>
          {r.icon}
        </span>
        <span className="st-rec-label">{r.label}</span>
      </div>
      <div className="st-rec-value">{r.value}</div>
      <div className="st-rec-sub">{r.sub}</div>
    </div>
  )
}

function RivalryCard({ r }: { r: Rivalry }) {
  const aColor = teamColor(r.aTeam ?? '')
  const bColor = teamColor(r.bTeam ?? '')
  const aPct = r.total ? (r.aWins / r.total) * 100 : 50
  const leader = r.aWins === r.bWins ? null : r.aWins > r.bWins ? r.aName : r.bName
  return (
    <div className="rivalry-card">
      <div className="rv-top">
        <span className="rv-name" style={{ color: aColor }} title={r.aName}>
          {r.aName}
        </span>
        <span className="rv-vs">
          {r.aWins}–{r.bWins}
        </span>
        <span className="rv-name rv-right" style={{ color: bColor }} title={r.bName}>
          {r.bName}
        </span>
      </div>
      <div className="rv-bar">
        <span className="rv-fill" style={{ width: `${aPct}%`, background: aColor }} />
        <span className="rv-fill" style={{ width: `${100 - aPct}%`, background: bColor }} />
      </div>
      <div className="rv-sub">
        {r.total} matchs · {leader ? `${leader} mène` : 'égalité parfaite'}
      </div>
    </div>
  )
}
function PlayerCardModal({
  playerKey,
  stats,
  titles,
  matches,
  now,
  onClose,
}: {
  playerKey: string
  stats: PlayerStat[]
  titles: Map<string, PlayerTitles>
  matches: Match[]
  now: Date
  onClose: () => void
}) {
  const [allOpps, setAllOpps] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const card = useMemo(
    () => playerCard(playerKey, stats, titles, matches, now),
    [playerKey, stats, titles, matches, now],
  )
  if (card === null) return null

  const opponents = allOpps ? card.opponents : card.opponents.slice(0, 4)

  return (
    <div
      className="scrim st-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal st-pm">
        <div className="st-pm-head">
          <Avatar name={card.name} team={card.team} url={card.avatarUrl} className="st-pm-av" />
          <div className="st-pm-id">
            <div className="st-pm-name">{card.name}</div>
            <div className="st-pm-meta">
              {card.team !== null && (
                <span className="st-team-dot" style={{ background: teamColor(card.team) }} />
              )}
              <span>
                {card.team !== null ? teamLabel(card.team) : '—'}
                {card.lastSeen !== null && ` · dernier match ${card.lastSeen}`}
              </span>
            </div>
          </div>
          <button className="st-pm-close" onClick={onClose} aria-label="Fermer">
            <IconX size={17} stroke={2} />
          </button>
        </div>

        <div className="st-pm-body">
          <div className="st-pm-kpis">
            {card.kpis.map((k) => (
              <div className="st-pm-kpi" key={k.label}>
                <div className="st-pm-kpi-label">{k.label}</div>
                <div className={`st-pm-kpi-value ${k.tone}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {card.titles.length > 0 && (
            <>
              <div className="st-pm-sec">Palmarès</div>
              <div className="st-pm-titles">
                {card.titles.map((t) => (
                  <div className="st-pm-title" key={`${t.name}|${t.date}`}>
                    <span aria-hidden>🏆</span>
                    <span className="st-pm-title-name">{t.name}</span>
                    <span className="st-pm-title-date">{t.date}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="st-pm-foes">
            <div className="st-pm-foe">
              <div className="st-pm-foe-label">Bête noire</div>
              <div className="st-pm-foe-row">
                <span className="st-pm-foe-name">{card.nemesis?.name ?? '—'}</span>
                {card.nemesis !== null && (
                  <span className="st-pm-foe-rec neg">{card.nemesis.record}</span>
                )}
              </div>
            </div>
            <div className="st-pm-foe">
              <div className="st-pm-foe-label">Victime favorite</div>
              <div className="st-pm-foe-row">
                <span className="st-pm-foe-name">{card.victim?.name ?? '—'}</span>
                {card.victim !== null && (
                  <span className="st-pm-foe-rec pos">{card.victim.record}</span>
                )}
              </div>
            </div>
          </div>

          <div className="st-pm-sec">Derniers matchs</div>
          <div className="st-pm-recent">
            {card.last8.map((m, i) => (
              <div className="st-pm-match" key={i}>
                <span className={`st-pm-res ${m.win ? 'w' : 'l'}`}>{m.win ? 'V' : 'D'}</span>
                <span className="st-pm-opp">vs {m.opponent}</span>
                <span className="st-pm-score">{m.score}</span>
                <span className="st-pm-date">{m.date}</span>
              </div>
            ))}
          </div>

          <div className="st-pm-sec-row">
            <div className="st-pm-sec">Bilan par adversaire</div>
            {card.opponents.length > 4 && (
              <button className="st-pm-toggle" onClick={() => setAllOpps((v) => !v)}>
                {allOpps ? 'Réduire' : 'Voir tous les adversaires'}
              </button>
            )}
          </div>
          <div className="st-pm-opps">
            {opponents.map((o) => (
              <div className="st-pm-opp-row" key={o.name}>
                <span className="st-pm-opp-name">{o.name}</span>
                <span className={`st-pm-opp-rec ${o.positive ? 'pos' : 'neg'}`}>{o.record}</span>
                <span className="st-pm-opp-track">
                  <span
                    className={`st-pm-opp-fill ${o.positive ? 'pos' : 'neg'}`}
                    style={{ width: `${o.pct}%` }}
                  />
                </span>
                <span className="st-pm-opp-pct">{o.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
