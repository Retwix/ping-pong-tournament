import { useMemo, useState, type ReactNode } from 'react'
import { useStats } from '../hooks/useStats'
import {
  computeHeadToHead,
  computePlayerStats,
  computeRivalries,
  computeSuperlatives,
  computeTeamStats,
  h2hWins,
  opponentRecords,
  recentMatchesFor,
  rivalryBalance,
  sideKey,
  winnerLoser,
  type MatchHighlight,
  type PlayerStat,
  type Rivalry,
} from '../lib/stats'
import {
  PERIOD_OPTIONS,
  TYPE_OPTIONS,
  activityDays,
  chartRangeLabel,
  filterPillLabel,
  isFiltered,
  scopeLabel,
  scopeMatches,
  statsKpis,
  weekdayProfile,
  type StatsFilters,
} from '../lib/statsPage'
import { formatDuration } from '../lib/pingpong'
import { teamColor, teamLabel } from '../lib/teams'
import type { Match } from '../types'
import Avatar from './Avatar'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'

type SortKey = 'wins' | 'winRate' | 'diff' | 'played' | 'mbSaved' | 'mbWasted'

const pct = (r: number) => `${Math.round(r * 100)}%`

function matchLabel(m: MatchHighlight['match']) {
  const { winner, loser, ws, ls } = winnerLoser(m)
  return `${winner} ${ws}–${ls} ${loser}`
}

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
  const [sortKey, setSortKey] = useState<SortKey>('wins')
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
  const supers = useMemo(() => computeSuperlatives(scoped), [scoped])

  const sortedPlayers = useMemo(() => {
    const cmp: Record<SortKey, (a: PlayerStat, b: PlayerStat) => number> = {
      wins: (a, b) => b.wins - a.wins || b.diff - a.diff,
      winRate: (a, b) => b.winRate - a.winRate || b.wins - a.wins,
      diff: (a, b) => b.diff - a.diff || b.wins - a.wins,
      played: (a, b) => b.played - a.played || b.wins - a.wins,
      mbSaved: (a, b) => b.matchBallsSaved - a.matchBallsSaved || b.wins - a.wins,
      mbWasted: (a, b) => b.matchBallsWasted - a.matchBallsWasted || b.wins - a.wins,
    }
    return [...playerStats].sort(cmp[sortKey])
  }, [playerStats, sortKey])

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
  const mostActive = playerStats.reduce<PlayerStat | null>(
    (best, s) => (!best || s.played > best.played ? s : best),
    null,
  )
  const streakHolder = playerStats.reduce<PlayerStat | null>(
    (best, s) => (!best || s.longestStreak > best.longestStreak ? s : best),
    null,
  )
  const bourreau = playerStats.reduce<PlayerStat | null>(
    (best, s) => (!best || s.capotsDealt > best.capotsDealt ? s : best),
    null,
  )
  const roiTable = playerStats.reduce<PlayerStat | null>(
    (best, s) => (!best || s.capotsTaken > best.capotsTaken ? s : best),
    null,
  )
  const clutch = playerStats.reduce<PlayerStat | null>(
    (best, s) => (!best || s.matchBallsSaved > best.matchBallsSaved ? s : best),
    null,
  )
  const cardiaque = playerStats.reduce<PlayerStat | null>(
    (best, s) => (!best || s.matchBallsWasted > best.matchBallsWasted ? s : best),
    null,
  )

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

  const Th = ({ k, children, title }: { k: SortKey; children: ReactNode; title?: string }) => (
    <th
      className={`sortable${sortKey === k ? ' active' : ''}`}
      onClick={() => setSortKey(k)}
      title={title}
    >
      {children}
      {sortKey === k ? ' ↓' : ''}
    </th>
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
          <section>
            <div className="section-title">Classement des joueurs</div>
            <div className="panel">
              <table className="leaderboard">
                <thead>
                  <tr>
                    <th className="left">Joueur</th>
                    <Th k="played">J</Th>
                    <Th k="wins">V</Th>
                    <th>D</th>
                    <Th k="winRate">%</Th>
                    <Th k="diff">Diff</Th>
                    <th>Série</th>
                    <Th k="mbSaved" title="Balles de match sauvées (un point de la défaite)">
                      BM ✓
                    </Th>
                    <Th k="mbWasted" title="Balles de match gâchées (point de match non converti)">
                      BM ✗
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((s, i) => (
                    <tr key={s.key} className={`r${i + 1}`} onClick={() => setSelected(s.key)}>
                      <td className="left">
                        <span className="rank">{i + 1}</span>
                        <span className="lb-player">
                          <Avatar name={s.name} team={s.team} url={s.avatar_url} className="sm" />
                          {s.name}
                        </span>
                      </td>
                      <td>{s.played}</td>
                      <td className="wins">{s.wins}</td>
                      <td>{s.losses}</td>
                      <td>{pct(s.winRate)}</td>
                      <td className={`diff ${s.diff > 0 ? 'pos' : s.diff < 0 ? 'neg' : ''}`}>
                        {s.diff > 0 ? '+' : ''}
                        {s.diff}
                      </td>
                      <td>{s.currentStreak >= 2 ? `🔥${s.currentStreak}` : s.currentStreak}</td>
                      <td>{s.matchBallsSaved}</td>
                      <td>{s.matchBallsWasted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="setup-hint" style={{ textAlign: 'left' }}>
              Clique sur une colonne pour trier. La série compte les victoires consécutives en
              cours.
            </p>
          </section>

          {/* Team leaderboard */}
          {teamStats.length > 0 && (
            <section>
              <div className="section-title">Classement des pôles</div>
              <div className="panel">
                <table>
                  <thead>
                    <tr>
                      <th className="left">Pôle</th>
                      <th>Joueurs</th>
                      <th>J</th>
                      <th>V</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamStats.map((t, i) => (
                      <tr key={t.team} className={`r${i + 1}`}>
                        <td className="left">
                          <span className="rank">{i + 1}</span>
                          <span className="lb-player">
                            <span className="dept-dot" style={{ background: teamColor(t.team) }} />
                            {teamLabel(t.team)}
                          </span>
                        </td>
                        <td>{t.players}</td>
                        <td>{t.played}</td>
                        <td className="wins">{t.wins}</td>
                        <td>{pct(t.winRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Superlatives */}
          <section>
            <div className="section-title">Records</div>
            <div className="super-grid">
              {supers.longestMatch && (
                <SuperCard
                  label="Plus long match"
                  value={formatDuration(supers.longestMatch.value)}
                  sub={matchLabel(supers.longestMatch.match)}
                />
              )}
              {supers.shortestMatch && (
                <SuperCard
                  label="Plus court match"
                  value={formatDuration(supers.shortestMatch.value)}
                  sub={matchLabel(supers.shortestMatch.match)}
                />
              )}
              {supers.biggestBlowout && (
                <SuperCard
                  label="Plus gros écart"
                  value={`+${supers.biggestBlowout.value}`}
                  sub={matchLabel(supers.biggestBlowout.match)}
                />
              )}
              {supers.closestGame && (
                <SuperCard
                  label="Match le plus serré"
                  value={`${Math.max(supers.closestGame.match.score_a, supers.closestGame.match.score_b)}–${Math.min(supers.closestGame.match.score_a, supers.closestGame.match.score_b)}`}
                  sub={matchLabel(supers.closestGame.match)}
                />
              )}
              {mostActive && mostActive.played > 0 && (
                <SuperCard
                  label="Plus actif"
                  value={mostActive.name}
                  sub={`${mostActive.played} matchs`}
                />
              )}
              {streakHolder && streakHolder.longestStreak >= 2 && (
                <SuperCard
                  label="Plus longue série"
                  value={streakHolder.name}
                  sub={`${streakHolder.longestStreak} victoires d'affilée`}
                />
              )}
              {bourreau && bourreau.capotsDealt > 0 && (
                <SuperCard
                  label="Bourreau 🪑"
                  value={bourreau.name}
                  sub={`${bourreau.capotsDealt} capot${bourreau.capotsDealt > 1 ? 's' : ''} infligé${bourreau.capotsDealt > 1 ? 's' : ''}`}
                />
              )}
              {roiTable && roiTable.capotsTaken > 0 && (
                <SuperCard
                  label="Roi de la table 🙈"
                  value={roiTable.name}
                  sub={`${roiTable.capotsTaken} passage${roiTable.capotsTaken > 1 ? 's' : ''} sous la table`}
                />
              )}
              {clutch && clutch.matchBallsSaved > 0 && (
                <SuperCard
                  label="Sang-froid 🧊"
                  value={clutch.name}
                  sub={`${clutch.matchBallsSaved} balle${clutch.matchBallsSaved > 1 ? 's' : ''} de match sauvée${clutch.matchBallsSaved > 1 ? 's' : ''}`}
                />
              )}
              {cardiaque && cardiaque.matchBallsWasted > 0 && (
                <SuperCard
                  label="Cardiaque 😰"
                  value={cardiaque.name}
                  sub={`${cardiaque.matchBallsWasted} balle${cardiaque.matchBallsWasted > 1 ? 's' : ''} de match gâchée${cardiaque.matchBallsWasted > 1 ? 's' : ''}`}
                />
              )}
            </div>
          </section>

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

      {selected && (
        <PlayerDetail
          playerKey={selected}
          stats={playerStats}
          matches={scoped}
          onClose={() => setSelected(null)}
        />
      )}

      {tabbar}
    </div>
  )
}

function SuperCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="super-card">
      <div className="sc-label">{label}</div>
      <div className="sc-value">{value}</div>
      <div className="sc-sub">{sub}</div>
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

function PlayerDetail({
  playerKey,
  stats,
  matches,
  onClose,
}: {
  playerKey: string
  stats: PlayerStat[]
  matches: Match[]
  onClose: () => void
}) {
  const s = stats.find((p) => p.key === playerKey)
  if (!s) return null

  const opps = opponentRecords(playerKey, matches)
  const nemesis = opps
    .filter((o) => o.losses > 0)
    .sort((a, b) => b.losses - a.losses || a.wins - a.losses - (b.wins - b.losses))[0]
  const victim = opps
    .filter((o) => o.wins > 0)
    .sort((a, b) => b.wins - a.wins || b.wins - b.losses - (a.wins - a.losses))[0]
  const recent = recentMatchesFor(playerKey, matches, 8)

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal pd">
        <div className="pd-head">
          <Avatar name={s.name} team={s.team} url={s.avatar_url} />
          <div>
            <h2 style={{ marginBottom: 2 }}>{s.name}</h2>
            <div className="modal-hint" style={{ marginBottom: 0 }}>
              {s.team ? teamLabel(s.team) : '—'}
            </div>
          </div>
        </div>

        <div className="pd-kpis">
          <div className="pd-kpi">
            <div className="n">{s.played}</div>
            <div className="l">Matchs</div>
          </div>
          <div className="pd-kpi">
            <div className="n">{pct(s.winRate)}</div>
            <div className="l">Victoires</div>
          </div>
          <div className="pd-kpi">
            <div className="n">
              {s.wins}-{s.losses}
            </div>
            <div className="l">V-D</div>
          </div>
          <div className="pd-kpi">
            <div className="n">
              {s.diff > 0 ? '+' : ''}
              {s.diff}
            </div>
            <div className="l">Diff</div>
          </div>
          <div className="pd-kpi">
            <div className="n">
              {s.currentStreak >= 2 ? `🔥${s.currentStreak}` : s.currentStreak}
            </div>
            <div className="l">Série</div>
          </div>
          <div className="pd-kpi">
            <div className="n">{s.longestStreak}</div>
            <div className="l">Meilleure série</div>
          </div>
          <div className="pd-kpi">
            <div className="n">{s.capotsDealt}</div>
            <div className="l">Capots infligés</div>
          </div>
          <div className="pd-kpi">
            <div className="n">{s.capotsTaken}</div>
            <div className="l">Sous la table</div>
          </div>
          <div className="pd-kpi">
            <div className="n">{s.matchBallsSaved}</div>
            <div className="l">Balles de match sauvées</div>
          </div>
          <div className="pd-kpi">
            <div className="n">{s.matchBallsWasted}</div>
            <div className="l">Balles de match gâchées</div>
          </div>
        </div>

        <div className="pd-foes">
          <div className="pd-foe">
            <div className="sc-label">Bête noire</div>
            {nemesis ? (
              <div className="pd-foe-v">
                {nemesis.name}{' '}
                <span className="muted">
                  ({nemesis.wins}-{nemesis.losses})
                </span>
              </div>
            ) : (
              <div className="pd-foe-v muted">—</div>
            )}
          </div>
          <div className="pd-foe">
            <div className="sc-label">Victime favorite</div>
            {victim ? (
              <div className="pd-foe-v">
                {victim.name}{' '}
                <span className="muted">
                  ({victim.wins}-{victim.losses})
                </span>
              </div>
            ) : (
              <div className="pd-foe-v muted">—</div>
            )}
          </div>
        </div>

        <div className="sc-label" style={{ marginBottom: 8 }}>
          Derniers matchs
        </div>
        <div className="pd-recent">
          {recent.map((m) => {
            const isA = sideKey(m.player_a_id, m.player_a) === playerKey
            const my = isA ? m.score_a : m.score_b
            const their = isA ? m.score_b : m.score_a
            const opp = isA ? m.player_b : m.player_a
            const win = my > their
            const date = m.ended_at ? new Date(m.ended_at).toLocaleDateString('fr-FR') : ''
            return (
              <div className="pd-row" key={m.id}>
                <span className={`pd-res ${win ? 'w' : 'l'}`}>{win ? 'V' : 'D'}</span>
                <span className="pd-opp">{opp}</span>
                <span className="pd-score">
                  {my}–{their}
                </span>
                <span className="pd-date">{date}</span>
              </div>
            )
          })}
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
