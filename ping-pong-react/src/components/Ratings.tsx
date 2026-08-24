import { useEffect, useMemo, useRef, useState } from 'react'
import { IconArrowLeft, IconInfoCircle, IconRefresh, IconSearch } from '@tabler/icons-react'
import { useRatings, type RatingEvent } from '../hooks/useRatings'
import { RATING, rankRatings, ratedMatches, replayRatings } from '../lib/rating'
import {
  STREAK_BADGE_MIN,
  filterRatingRows,
  lastFive,
  lastRatedAt,
  latestRatingExample,
  podium,
  recordOf,
  tightestGaps,
  topProgressions,
  weeklyDelta,
  winStreak,
} from '../lib/classement'
import { relativeTime } from '../lib/format'
import DashboardNav from './DashboardNav'
import DashboardTabBar from './DashboardTabBar'
import EloModal from './EloModal'
import { playerHistory } from '../lib/playerHistory'
import Avatar from './Avatar'
import PlayerModal from './PlayerModal'
import SeasonScope from './SeasonScope'
import {
  ladderIdentity,
  matchesInSeason,
  isClosed,
  seasonChampion,
  seasonsUpTo,
  type LadderScope,
} from '../lib/seasons'
import { Loader } from './Loader'

function Trend({ delta }: { delta: number }) {
  const v = Math.round(delta)
  if (v === 0) return <span className="rt-trend flat">–</span>
  const up = v > 0
  return (
    <span className={`rt-trend ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {Math.abs(v)}
    </span>
  )
}

const STAKES_LABEL: Record<RatingEvent['stakes'], string | null> = {
  normal: null,
  final: 'Finale',
  grand_final: 'Grande finale 🏆',
}

/** « ▲12 » / « ▼5 » / « ±0 » — the leader card's weekly move, white-on-violet. */
function weekLabel(delta: number): string {
  const v = Math.round(delta)
  if (v === 0) return '±0'
  return v > 0 ? `▲${v}` : `▼${Math.abs(v)}`
}

function fmtDate(at: string | null): string {
  if (!at) return '—'
  const d = new Date(at)
  return (
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  )
}

/** One line of a log entry: a player's score and rating move for that match. */
function LogLine({ e, win }: { e: RatingEvent; win: boolean }) {
  return (
    <div className={`rt-log-line${win ? ' win' : ''}`}>
      <span className="rt-log-name">{e.name}</span>
      <span className="rt-log-score">
        {e.scoreFor}–{e.scoreAgainst}
      </span>
      <span className="rt-log-move">
        {Math.round(e.ratingBefore)} → <b>{Math.round(e.ratingAfter)}</b>
      </span>
      <Trend delta={e.delta} />
    </div>
  )
}

interface Props {
  /** Owned by the router, not the page: the scope lives in the URL. */
  scope: LadderScope
  onScopeChange: (scope: LadderScope) => void
  onHome: () => void
  onStats: () => void
  onPlayers: () => void
  onNew: () => void
  onNewGame: () => void
}

export default function Ratings({
  scope,
  onScopeChange,
  onHome,
  onStats,
  onPlayers,
  onNew,
  onNewGame,
}: Props) {
  const { rows, events, matches, players, tournaments, matchCount, loading, error, recompute } =
    useRatings(scope)
  const [mode, setMode] = useState<'board' | 'log'>('board')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [eloOpen, setEloOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const now = useMemo(() => new Date(), [])
  const seasons = useMemo(() => seasonsUpTo(now), [now])

  // One replay per season. Each match belongs to exactly one window, so the total
  // work is roughly a single full replay however many seasons have been played.
  const championById = useMemo(() => {
    const targetByTournament = new Map(tournaments.map((t) => [t.id, t.target]))
    return new Map(
      seasons.map((s) => {
        const scoped = ratedMatches(matchesInSeason(matches, s.id), tournaments)
        const seasonRows = rankRatings(
          replayRatings(scoped, players, { targetByTournament }),
          players,
        )
        return [s.id, seasonChampion(seasonRows)?.name ?? null]
      }),
    )
  }, [matches, players, tournaments, seasons])

  const scopedMatchCount = useMemo(
    () =>
      scope.kind === 'all'
        ? ratedMatches(matches, tournaments).length
        : ratedMatches(matchesInSeason(matches, scope.id), tournaments).length,
    [matches, tournaments, scope],
  )

  const identity = ladderIdentity({
    scope,
    now,
    matchCount: scopedMatchCount,
    champion: scope.kind === 'season' ? (championById.get(scope.id) ?? null) : null,
    eligibilityGames: RATING.provisionalGames,
  })

  const scopedSeason =
    scope.kind === 'season' ? (seasons.find((s) => s.id === scope.id) ?? null) : null
  const archived = scopedSeason !== null && isClosed(scopedSeason, now)

  const leader = rows.find((r) => !r.provisional) ?? rows[0]
  const ranked = rows.filter((r) => !r.provisional)
  const updatedAt = lastRatedAt(events)

  const tableRows = useMemo(() => {
    const now = new Date()
    return filterRatingRows(rows, query).map((r) => ({
      ...r,
      record: recordOf(events, r.key),
      form: lastFive(events, r.key),
      streak: winStreak(events, r.key),
      delta7: weeklyDelta(events, r.key, now),
    }))
  }, [rows, events, query])

  const pod = useMemo(() => podium(rows, events, new Date()), [rows, events])
  const gaps = useMemo(() => tightestGaps(rows), [rows])
  const progs = useMemo(() => topProgressions(events, rows, new Date()), [events, rows])
  const example = useMemo(() => latestRatingExample(events), [events])

  // Group the two events of each match into one log entry, newest first.
  const logEntries = useMemo(() => {
    const byMatch = new Map<
      string,
      {
        at: string | null
        stakes: RatingEvent['stakes']
        weight: number
        winner?: RatingEvent
        loser?: RatingEvent
      }
    >()
    const order: string[] = []
    for (const e of events) {
      let g = byMatch.get(e.matchId)
      if (!g) {
        g = { at: e.at, stakes: e.stakes, weight: e.weight }
        byMatch.set(e.matchId, g)
        order.push(e.matchId)
      }
      if (e.won) g.winner = e
      else g.loser = e
    }
    return order
      .map((id) => ({ matchId: id, ...byMatch.get(id)! }))
      .filter((g) => g.winner && g.loser)
      .reverse()
  }, [events])

  const nav = (
    <DashboardNav
      active="classement"
      onHome={onHome}
      onStats={onStats}
      onPlayers={onPlayers}
      onNew={onNew}
      onNewGame={onNewGame}
    />
  )
  const tabbar = (
    <DashboardTabBar
      active="classement"
      onHome={onHome}
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
        <Loader />
        {tabbar}
      </div>
    )
  }

  return (
    <div className="rv-page">
      {nav}

      {error && <div className="error-banner">Erreur : {error}</div>}

      <div className="cl-head">
        <div className="cl-head-text">
          <h1 className="cl-title">Classement Elo</h1>
          <p className="cl-sub">
            Classement général
            {updatedAt && ` · dernière mise à jour ${relativeTime(updatedAt, new Date())}`}
          </p>
          <SeasonScope
            value={scope}
            seasons={seasons}
            championById={championById}
            now={now}
            onChange={onScopeChange}
          />
          <p className="sn-identity">{identity}</p>
        </div>
        {rows.length > 0 && (
          <label className="cl-search">
            <IconSearch size={17} stroke={2} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un joueur…"
              aria-label="Chercher un joueur"
            />
            <kbd>⌘K</kbd>
          </label>
        )}
      </div>

      {rows.length === 0 ? (
        <section>
          <div className="empty">
            {archived
              ? 'Aucune partie classée pendant cette saison.'
              : 'Pas encore de classement. Joue quelques matchs pour démarrer les notes Elo !'}
          </div>
          <div className="footer-row">
            <span />
            <button className="link-btn" onClick={onHome}>
              <IconArrowLeft size={16} stroke={1.8} /> Accueil
            </button>
          </div>
        </section>
      ) : mode === 'log' ? (
        <>
          <section>
            <div className="section-title with-toggle">
              Journal des calculs
              <button className="link-btn" onClick={() => setMode('board')}>
                <IconArrowLeft size={15} stroke={1.8} /> Classement
              </button>
            </div>
            <p className="setup-hint" style={{ textAlign: 'left', marginTop: 0 }}>
              Chaque match, du plus récent au plus ancien : la note <b>avant → après</b> de chaque
              joueur, et le <b>poids</b> appliqué (marge au score × enjeu).
            </p>
            <div className="rt-log-list">
              {logEntries.map((g) => {
                const label = STAKES_LABEL[g.stakes]
                return (
                  <div className="panel rt-log" key={g.matchId}>
                    <div className="rt-log-head">
                      <span className="rt-log-date">{fmtDate(g.at)}</span>
                      {label && <span className={`rt-stakes ${g.stakes}`}>{label}</span>}
                      <span
                        className="rt-log-weight"
                        title="Poids du match : marge au score × enjeu"
                      >
                        poids ×{g.weight.toFixed(2)}
                      </span>
                    </div>
                    <LogLine e={g.winner!} win />
                    <LogLine e={g.loser!} win={false} />
                  </div>
                )
              })}
            </div>
          </section>

          <div className="footer-row">
            <span className="hint">{logEntries.length} matchs notés.</span>
            <button className="link-btn" onClick={() => setMode('board')}>
              <IconArrowLeft size={16} stroke={1.8} /> Classement
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="cl-tiles">
            <div className="cl-tile">
              <div className="cl-tile-num">{ranked.length}</div>
              <div className="cl-tile-lbl">Joueurs classés</div>
            </div>
            <div className="cl-tile">
              <div className="cl-tile-num">{matchCount}</div>
              <div className="cl-tile-lbl">Matchs notés</div>
            </div>
            <div className="cl-tile">
              <div className="cl-tile-num">{leader ? Math.round(leader.rating) : '—'}</div>
              <div className="cl-tile-lbl">{leader ? `Meneur · ${leader.name}` : 'Meneur'}</div>
            </div>
          </div>

          {pod && (
            <div className="cl-podium">
              <div className="cl-pod-1">
                <div className="cl-pod-1-top">
                  <Avatar
                    name={pod.first.row.name}
                    team={pod.first.row.team}
                    url={pod.first.row.avatar_url}
                    className="cl-ava-60"
                    fill="hero"
                  />
                  <span className="cl-pod-badge1">1er · Leader</span>
                </div>
                <div className="cl-pod-1-name">{pod.first.row.name}</div>
                <div className="cl-pod-1-elo">
                  {Math.round(pod.first.row.rating)}
                  <span className="cl-pod-1-week">{weekLabel(pod.first.delta7)} cette semaine</span>
                </div>
                <div className="cl-pod-1-tiles">
                  <div className="cl-pod-1-tile">
                    <b>
                      {pod.first.record.wins}–{pod.first.record.losses}
                    </b>
                    <span>bilan total</span>
                  </div>
                  <div className="cl-pod-1-tile">
                    <b>{pod.first.row.games}</b>
                    <span>matchs joués</span>
                  </div>
                </div>
              </div>
              {[pod.second, pod.third].map((p, i) => (
                <div className="cl-pod-r" key={p.row.key}>
                  <div className="cl-pod-r-top">
                    <Avatar name={p.row.name} team={p.row.team} url={p.row.avatar_url} />
                    <span className={`cl-pod-rank cl-pod-rank-${i + 2}`}>{i + 2}e</span>
                  </div>
                  <div className="cl-pod-r-name">{p.row.name}</div>
                  <div className="cl-pod-r-elo">
                    {Math.round(p.row.rating)} <Trend delta={p.delta7} />
                  </div>
                  <div className="cl-pod-r-note">{p.note}</div>
                </div>
              ))}
            </div>
          )}

          <div className="cl-body">
            <div className="cl-main">
              <section>
                <div className="cl-sec-head">
                  <div className="cl-sec-title">
                    Tous les joueurs
                    <button
                      className="cl-refresh"
                      onClick={recompute}
                      title="Recalculer et enregistrer les notes"
                      aria-label="Recalculer les notes"
                    >
                      <IconRefresh size={15} stroke={2} />
                    </button>
                  </div>
                </div>
                <div className="cl-table">
                  <div className="cl-tr cl-thead">
                    <span className="cl-c-rank">#</span>
                    <span className="cl-c-avatar" />
                    <span className="cl-c-name">Joueur</span>
                    <span className="cl-c-form">Forme</span>
                    <span className="cl-c-rec">V–D</span>
                    <span className="cl-c-games">Matchs</span>
                    <span className="cl-c-elo">Elo</span>
                    <span className="cl-c-delta">7 j</span>
                  </div>
                  {tableRows.map((r) => (
                    <div
                      key={r.key}
                      className="cl-tr cl-row"
                      onClick={() => setSelectedKey(r.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedKey(r.key)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Voir l'historique de ${r.name}`}
                    >
                      <span
                        className={`cl-c-rank${
                          r.provisional ? ' prov' : r.rank <= 3 ? ` p${r.rank}` : ''
                        }`}
                      >
                        {r.provisional ? '—' : r.rank}
                      </span>
                      <span className="cl-c-avatar">
                        <Avatar name={r.name} team={r.team} url={r.avatar_url} className="sm" />
                      </span>
                      <span className="cl-c-name">
                        <span className="cl-name-text">{r.name}</span>
                        {!r.provisional && r.streak >= STREAK_BADGE_MIN && (
                          <span className="cl-badge cl-badge-streak">{r.streak} victoires</span>
                        )}
                        {r.provisional && (
                          <span className="cl-badge cl-badge-prov">Provisoire</span>
                        )}
                      </span>
                      <span className="cl-c-form">
                        {r.provisional ? (
                          <span className="cl-form-count">
                            {r.games} / {RATING.provisionalGames} matchs
                          </span>
                        ) : (
                          r.form.map((won, i) => (
                            <i key={i} className={`cl-dot ${won ? 'w' : 'l'}`} />
                          ))
                        )}
                      </span>
                      <span className="cl-c-rec">
                        {r.record.wins}–{r.record.losses}
                      </span>
                      <span className="cl-c-games">{r.games}</span>
                      <span
                        className={`cl-c-elo${
                          r.provisional ? ' prov' : r.key === leader?.key ? ' lead' : ''
                        }`}
                      >
                        {r.provisional ? `~${Math.round(r.rating)}` : Math.round(r.rating)}
                      </span>
                      <span className="cl-c-delta">
                        <Trend delta={r.delta7} />
                      </span>
                    </div>
                  ))}
                  {tableRows.length === 0 && (
                    <div className="cl-empty-row">
                      Aucun joueur trouvé. Essaie un autre nom ou une autre équipe.
                    </div>
                  )}
                </div>
                <p className="cl-note">
                  Un joueur apparaît au classement dès son premier match. En dessous de{' '}
                  {RATING.provisionalGames} parties son Elo est « provisoire » et s'affiche en gris
                  — et il faut {RATING.provisionalGames} parties dans la saison pour pouvoir être
                  sacré champion.
                </p>
              </section>
            </div>

            <aside className="cl-rail">
              {gaps.length > 0 && (
                <div className="cl-rail-card">
                  <div className="cl-rail-title">Écarts les plus serrés</div>
                  <p className="cl-rail-explain">
                    Les places qui peuvent basculer au prochain match.
                  </p>
                  {gaps.map((g) => (
                    <div className="cl-gap-row" key={`${g.above.key}·${g.below.key}`}>
                      <span className="cl-gap-name">{g.above.name}</span>
                      <span className="cl-gap-pill">{g.gap} pts</span>
                      <span className="cl-gap-name right">{g.below.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {progs.length > 0 && (
                <div className="cl-rail-card">
                  <div className="cl-rail-head">
                    <span className="cl-rail-title">Plus fortes progressions</span>
                    <span className="cl-rail-tag">7 jours</span>
                  </div>
                  {progs.map((p) => (
                    <div className="cl-prog-row" key={p.row.key}>
                      <span className="cl-prog-rank">{p.row.rank}</span>
                      <Avatar
                        name={p.row.name}
                        team={p.row.team}
                        url={p.row.avatar_url}
                        className="sm"
                      />
                      <span className="cl-prog-name">{p.row.name}</span>
                      <span className="cl-prog-delta">▲ {Math.round(p.delta7)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="cl-rail-card">
                <div className="cl-explain-head">
                  <span className="cl-explain-ico">
                    <IconInfoCircle size={17} stroke={2} />
                  </span>
                  <span className="cl-rail-title">Comment marche l'Elo</span>
                </div>
                <p className="cl-rail-explain">
                  Le vainqueur prend des points au perdant. L'écart au score, l'enjeu et la
                  fiabilité « ± » de chaque note font varier le transfert — c'est le système
                  Glicko-2.
                </p>
                <div className="cl-explain-row">
                  <b>×{RATING.marginCap}</b>
                  <span>poids maximal d'une grosse victoire</span>
                </div>
                <div className="cl-explain-row">
                  <b>×{RATING.wGrandFinal}</b>
                  <span>poids d'une grande finale</span>
                </div>
                <button className="cl-explain-link" onClick={() => setEloOpen(true)}>
                  Voir le détail du calcul →
                </button>
                <button className="cl-explain-link sub" onClick={() => setMode('log')}>
                  Journal des calculs →
                </button>
              </div>
            </aside>
          </div>

          <div className="footer-row">
            <span className="hint">Notes Glicko-2 · parties rapides et tournois confondus.</span>
          </div>
        </>
      )}

      {eloOpen && <EloModal example={example} onClose={() => setEloOpen(false)} />}

      {(() => {
        const selected = selectedKey ? rows.find((r) => r.key === selectedKey) : undefined
        if (!selected) return null
        return (
          <PlayerModal
            row={selected}
            history={playerHistory(events, rows, selected.key)}
            onClose={() => setSelectedKey(null)}
          />
        )
      })()}
      {tabbar}
    </div>
  )
}
