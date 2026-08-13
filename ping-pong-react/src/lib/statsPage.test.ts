import { describe, expect, it } from 'vitest'
import type { Match, Tournament } from '../types'
import { computePlayerStats, computeTeamStats } from './stats'
import type { Player } from '../types'
import {
  DEFAULT_LEADERBOARD_SORT,
  PERIOD_OPTIONS,
  isPeriodAvailable,
  TYPE_OPTIONS,
  abbrev,
  activityDays,
  chartRangeLabel,
  filterPillLabel,
  finalsByPlayer,
  fmtPlayTime,
  isFiltered,
  matchRecords,
  leaderboardRows,
  parseStatsFilters,
  playerCard,
  playerRecords,
  remontadasByName,
  scopeLabel,
  scopeMatches,
  sortLeaderboard,
  statsKpis,
  statsSearch,
  streakLabel,
  tightestHint,
  titlesByName,
  toggleSort,
  weekdayProfile,
  type LeaderboardRow,
  type StatsFilters,
} from './statsPage'

const getMockMatch = (overrides?: Partial<Match>): Match => ({
  id: 'm1',
  tournament_id: 't1',
  round: 0,
  idx: 0,
  player_a: 'Léo',
  player_b: 'Thibault',
  player_a_id: 'pa',
  player_b_id: 'pb',
  score_a: 11,
  score_b: 9,
  done: true,
  serve_start: 'a',
  started_at: null,
  ended_at: '2026-07-15T10:00:00.000Z',
  bracket: null,
  match_key: null,
  win_to: null,
  win_slot: null,
  lose_to: null,
  lose_slot: null,
  bye: false,
  mb_saved_a: 0,
  mb_saved_b: 0,
  ...overrides,
})

const getMockTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  created_at: '2026-07-01T09:00:00.000Z',
  name: 'Tournoi de juillet',
  target: 11,
  players: ['Léo', 'Thibault'],
  status: 'done',
  kind: 'tournament',
  format: 'round_robin',
  champion: 'Léo',
  is_active: false,
  slack_channel: null,
  slack_thread_ts: null,
  result_notified: false,
  unranked: false,
  doubles: false,
  teams: null,
  chaos_enabled: false,
  chaos_interval: 5,
  chaos_intensity: 'mild',
  chaos_legendary: false,
  ...overrides,
})

const getFilters = (overrides?: Partial<StatsFilters>): StatsFilters => ({
  period: 'tout',
  type: 'tout',
  ...overrides,
})

// Wednesday 15 July 2026, mid-day UTC (timezone-safe for ±2h offsets).
const NOW = new Date('2026-07-15T12:00:00.000Z')

describe('stats filters in the URL', () => {
  it('reads period and type from the query string', () => {
    expect(parseStatsFilters('?p=mois&t=tournois')).toEqual({ period: 'mois', type: 'tournois' })
    expect(parseStatsFilters('?p=semaine')).toEqual({ period: 'semaine', type: 'tout' })
    expect(parseStatsFilters('?t=rapides')).toEqual({ period: 'tout', type: 'rapides' })
  })

  it('falls back to « tout » on missing or unknown values', () => {
    expect(parseStatsFilters('')).toEqual({ period: 'tout', type: 'tout' })
    expect(parseStatsFilters('?p=annee&t=bizarre')).toEqual({ period: 'tout', type: 'tout' })
  })

  it('writes only the non-default filters back to the query string', () => {
    expect(statsSearch(getFilters())).toBe('')
    expect(statsSearch(getFilters({ period: 'mois' }))).toBe('?p=mois')
    expect(statsSearch(getFilters({ type: 'rapides' }))).toBe('?t=rapides')
    expect(statsSearch(getFilters({ period: 'semaine', type: 'tournois' }))).toBe(
      '?p=semaine&t=tournois',
    )
  })

  it('round-trips through parse', () => {
    const filters = getFilters({ period: 'semaine', type: 'rapides' })
    expect(parseStatsFilters(statsSearch(filters))).toEqual(filters)
  })
})

describe('scoping matches by period', () => {
  const july = getMockMatch({ id: 'july', ended_at: '2026-07-02T10:00:00.000Z' })
  const june = getMockMatch({ id: 'june', ended_at: '2026-06-30T10:00:00.000Z' })
  const julyLastYear = getMockMatch({ id: 'old', ended_at: '2025-07-15T10:00:00.000Z' })

  it('keeps everything on « tout »', () => {
    const scoped = scopeMatches([july, june, julyLastYear], [], getFilters(), NOW)
    expect(scoped.map((m) => m.id)).toEqual(['july', 'june', 'old'])
  })

  it('keeps only the current calendar month on « mois » (same month AND year)', () => {
    const scoped = scopeMatches([july, june, julyLastYear], [], getFilters({ period: 'mois' }), NOW)
    expect(scoped.map((m) => m.id)).toEqual(['july'])
  })

  it('keeps Monday through Sunday of the current week on « semaine »', () => {
    const monday = getMockMatch({ id: 'mon', ended_at: '2026-07-13T10:00:00.000Z' })
    const sunday = getMockMatch({ id: 'sun', ended_at: '2026-07-19T10:00:00.000Z' })
    const sundayBefore = getMockMatch({ id: 'prev', ended_at: '2026-07-12T10:00:00.000Z' })
    const mondayAfter = getMockMatch({ id: 'next', ended_at: '2026-07-20T10:00:00.000Z' })
    const scoped = scopeMatches(
      [monday, sunday, sundayBefore, mondayAfter],
      [],
      getFilters({ period: 'semaine' }),
      NOW,
    )
    expect(scoped.map((m) => m.id)).toEqual(['mon', 'sun'])
  })

  it('still finds the current week when « now » is a Sunday', () => {
    const sundayNow = new Date('2026-07-19T12:00:00.000Z')
    const monday = getMockMatch({ id: 'mon', ended_at: '2026-07-13T10:00:00.000Z' })
    const scoped = scopeMatches([monday], [], getFilters({ period: 'semaine' }), sundayNow)
    expect(scoped.map((m) => m.id)).toEqual(['mon'])
  })

  it('falls back to started_at when ended_at is missing, and drops untimed matches', () => {
    const startedOnly = getMockMatch({
      id: 'started',
      ended_at: null,
      started_at: '2026-07-14T10:00:00.000Z',
    })
    const untimed = getMockMatch({ id: 'untimed', ended_at: null, started_at: null })
    const scoped = scopeMatches([startedOnly, untimed], [], getFilters({ period: 'mois' }), NOW)
    expect(scoped.map((m) => m.id)).toEqual(['started'])
    expect(scopeMatches([startedOnly, untimed], [], getFilters(), NOW).map((m) => m.id)).toEqual([
      'started',
      'untimed',
    ])
  })
})

describe('scoping matches by type', () => {
  const tour = getMockTournament({ id: 'tt', kind: 'tournament' })
  const game = getMockTournament({ id: 'tg', kind: 'game' })
  const inTour = getMockMatch({ id: 'a', tournament_id: 'tt' })
  const inGame = getMockMatch({ id: 'b', tournament_id: 'tg' })
  const orphan = getMockMatch({ id: 'c', tournament_id: 'gone' })

  it('« tournois » keeps only matches from real tournaments', () => {
    const scoped = scopeMatches(
      [inTour, inGame, orphan],
      [tour, game],
      getFilters({ type: 'tournois' }),
      NOW,
    )
    expect(scoped.map((m) => m.id)).toEqual(['a'])
  })

  it('« rapides » keeps only quick games', () => {
    const scoped = scopeMatches(
      [inTour, inGame, orphan],
      [tour, game],
      getFilters({ type: 'rapides' }),
      NOW,
    )
    expect(scoped.map((m) => m.id)).toEqual(['b'])
  })

  it('« tout » keeps matches whose tournament is unknown', () => {
    const scoped = scopeMatches([inTour, inGame, orphan], [tour, game], getFilters(), NOW)
    expect(scoped.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('excludes doubles matches from every scope — pair names are no individuals', () => {
    const dbl = getMockTournament({ id: 'td', kind: 'game', doubles: true })
    const inDouble = getMockMatch({ id: 'd', tournament_id: 'td' })
    expect(
      scopeMatches([inGame, inDouble], [game, dbl], getFilters(), NOW).map((m) => m.id),
    ).toEqual(['b'])
    expect(
      scopeMatches([inGame, inDouble], [game, dbl], getFilters({ type: 'rapides' }), NOW).map(
        (m) => m.id,
      ),
    ).toEqual(['b'])
  })

  it('combines period and type', () => {
    const juneTour = getMockMatch({
      id: 'jt',
      tournament_id: 'tt',
      ended_at: '2026-06-10T10:00:00.000Z',
    })
    const julyGame = getMockMatch({ id: 'jg', tournament_id: 'tg' })
    const julyTour = getMockMatch({ id: 'jj', tournament_id: 'tt' })
    const scoped = scopeMatches(
      [juneTour, julyGame, julyTour],
      [tour, game],
      getFilters({ period: 'mois', type: 'tournois' }),
      NOW,
    )
    expect(scoped.map((m) => m.id)).toEqual(['jj'])
  })
})

describe('play time formatting', () => {
  it('shows hours and zero-padded minutes past the first hour', () => {
    expect(fmtPlayTime(872 * 60_000)).toBe('14 h 32')
    expect(fmtPlayTime(60 * 60_000)).toBe('1 h 00')
  })

  it('stays in minutes under an hour', () => {
    expect(fmtPlayTime(45 * 60_000)).toBe('45 min')
    expect(fmtPlayTime(0)).toBe('0 min')
  })
})

describe('KPI strip', () => {
  const timed = (id: string, endedAt: string, minutes: number, overrides?: Partial<Match>) =>
    getMockMatch({
      id,
      ended_at: endedAt,
      started_at: new Date(new Date(endedAt).getTime() - minutes * 60_000).toISOString(),
      ...overrides,
    })

  it('counts matches, distinct players, points and play time', () => {
    const matches = [
      timed('a', '2026-07-14T10:00:00.000Z', 20, { score_a: 11, score_b: 9 }),
      timed('b', '2026-07-02T10:00:00.000Z', 40, {
        player_a: 'Candice',
        player_a_id: 'pc',
        score_a: 11,
        score_b: 5,
      }),
    ]
    const kpis = statsKpis(matches, getFilters(), NOW)
    expect(kpis.map((k) => k.label)).toEqual([
      'Matchs joués',
      'Joueurs',
      'Points marqués',
      'Temps de jeu',
    ])
    expect(kpis[0].value).toBe('2')
    expect(kpis[1].value).toBe('3')
    expect(kpis[1].sub).toBe('ayant joué au moins un match')
    expect(kpis[2].value).toBe('36')
    expect(kpis[2].unit).toBe('pts')
    expect(kpis[3].value).toBe('1 h 00')
    expect(kpis[3].sub).toBe('≈ 30 min par match')
  })

  it('groups thousands with a narrow space in the points KPI', () => {
    const matches = Array.from({ length: 241 }, (_, i) =>
      getMockMatch({ id: `m${i}`, score_a: 11, score_b: 9 }),
    )
    const kpis = statsKpis(matches, getFilters(), NOW)
    expect(kpis[2].value).toBe('4\u202f820')
  })

  it('highlights this week when unfiltered, names the filtered period otherwise', () => {
    const thisWeek = timed('w', '2026-07-14T10:00:00.000Z', 20)
    const older = timed('o', '2026-07-02T10:00:00.000Z', 20)
    const open = statsKpis([thisWeek, older], getFilters(), NOW)
    expect(open[0].sub).toBe('+1 cette semaine')
    expect(open[0].accent).toBe(true)

    const filtered = statsKpis([thisWeek, older], getFilters({ period: 'mois' }), NOW)
    expect(filtered[0].sub).toBe('sur la période filtrée')
    expect(filtered[0].accent).toBe(false)

    const quiet = statsKpis([older], getFilters(), NOW)
    expect(quiet[0].sub).toBe('aucun match cette semaine')
    expect(quiet[0].accent).toBe(false)
  })

  it('admits when durations are missing', () => {
    const untimed = getMockMatch({ id: 'u', started_at: null })
    const kpis = statsKpis([untimed], getFilters(), NOW)
    expect(kpis[3].value).toBe('—')
    expect(kpis[3].sub).toBe('durées non enregistrées')
  })
})

describe('activity chart days', () => {
  const on = (id: string, endedAt: string) => getMockMatch({ id, ended_at: endedAt })

  it('buckets matches per day, oldest first, with French labels', () => {
    const days = activityDays([
      on('a', '2026-07-02T10:00:00.000Z'),
      on('b', '2026-07-01T10:00:00.000Z'),
      on('c', '2026-07-02T14:00:00.000Z'),
    ])
    expect(days.map((d) => ({ date: d.date, label: d.label, count: d.count }))).toEqual([
      { date: '2026-07-01', label: '1 juil.', count: 1 },
      { date: '2026-07-02', label: '2 juil.', count: 2 },
    ])
  })

  it('flags days at 75% of the peak or more', () => {
    const days = activityDays([
      on('a', '2026-07-01T10:00:00.000Z'),
      on('b', '2026-07-02T10:00:00.000Z'),
      on('c', '2026-07-02T11:00:00.000Z'),
      on('d', '2026-07-02T12:00:00.000Z'),
      on('e', '2026-07-02T13:00:00.000Z'),
      on('f', '2026-07-03T10:00:00.000Z'),
      on('g', '2026-07-03T11:00:00.000Z'),
      on('h', '2026-07-03T12:00:00.000Z'),
    ])
    expect(days.map((d) => [d.date, d.peak])).toEqual([
      ['2026-07-01', false],
      ['2026-07-02', true],
      ['2026-07-03', true],
    ])
  })

  it('keeps only the 30 most recent days', () => {
    const firstOfJune = Date.UTC(2026, 5, 1, 10)
    const many = Array.from({ length: 35 }, (_, i) =>
      on(`m${i}`, new Date(firstOfJune + i * 86_400_000).toISOString()),
    )
    const days = activityDays(many)
    expect(days).toHaveLength(30)
    expect(days[0].date).toBe('2026-06-06')
    expect(days[days.length - 1].date).toBe('2026-07-05')
  })
})

describe('weekday profile', () => {
  const on = (id: string, endedAt: string) => getMockMatch({ id, ended_at: endedAt })

  it('always shows Monday to Friday, scaled to the busiest day', () => {
    // 2026-07-13 = Monday, 14 = Tuesday.
    const profile = weekdayProfile([
      on('a', '2026-07-13T10:00:00.000Z'),
      on('b', '2026-07-14T10:00:00.000Z'),
      on('c', '2026-07-14T11:00:00.000Z'),
    ])
    expect(
      profile.map((w) => ({ label: w.label, count: w.count, pct: w.pct, top: w.top })),
    ).toEqual([
      { label: 'Lun', count: 1, pct: 50, top: false },
      { label: 'Mar', count: 2, pct: 100, top: true },
      { label: 'Mer', count: 0, pct: 0, top: false },
      { label: 'Jeu', count: 0, pct: 0, top: false },
      { label: 'Ven', count: 0, pct: 0, top: false },
    ])
  })

  it('adds weekend rows only when someone actually played', () => {
    // 2026-07-18 = Saturday.
    const profile = weekdayProfile([
      on('a', '2026-07-13T10:00:00.000Z'),
      on('b', '2026-07-18T10:00:00.000Z'),
    ])
    expect(profile.map((w) => w.label)).toEqual(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'])
  })

  it('is empty when no match has a timestamp', () => {
    expect(weekdayProfile([getMockMatch({ id: 'u', ended_at: null, started_at: null })])).toEqual(
      [],
    )
  })
})

describe('chart range label', () => {
  it('counts the days of activity shown', () => {
    expect(chartRangeLabel(22)).toBe("22 jours d'activité")
    expect(chartRangeLabel(1)).toBe("1 jour d'activité")
  })
})

describe('player form, play time and last-seen (computePlayerStats extensions)', () => {
  const vs = (
    id: string,
    endedAt: string,
    scoreA: number,
    scoreB: number,
    minutes?: number,
  ): Match =>
    getMockMatch({
      id,
      ended_at: endedAt,
      started_at:
        minutes === undefined
          ? null
          : new Date(new Date(endedAt).getTime() - minutes * 60_000).toISOString(),
      score_a: scoreA,
      score_b: scoreB,
    })

  it('records the last five results, most recent last, whatever the input order', () => {
    const matches = [
      vs('m6', '2026-07-06T10:00:00.000Z', 11, 8),
      vs('m1', '2026-07-01T10:00:00.000Z', 11, 3),
      vs('m4', '2026-07-04T10:00:00.000Z', 11, 9),
      vs('m2', '2026-07-02T10:00:00.000Z', 5, 11),
      vs('m5', '2026-07-05T10:00:00.000Z', 2, 11),
      vs('m3', '2026-07-03T10:00:00.000Z', 11, 7),
    ]
    const leo = computePlayerStats(matches, []).find((s) => s.name === 'Léo')
    expect(leo?.form).toEqual([false, true, true, false, true])
  })

  it('keeps a short history short', () => {
    const matches = [vs('m1', '2026-07-01T10:00:00.000Z', 11, 3)]
    const thibault = computePlayerStats(matches, []).find((s) => s.name === 'Thibault')
    expect(thibault?.form).toEqual([false])
  })

  it('sums each player’s recorded play time and remembers the last outing, both sides', () => {
    const matches = [
      vs('m1', '2026-07-01T10:00:00.000Z', 11, 3, 20),
      vs('m2', '2026-07-04T10:00:00.000Z', 5, 11, 30),
      vs('m3', '2026-07-02T10:00:00.000Z', 11, 7),
    ]
    const stats = computePlayerStats(matches, [])
    const leo = stats.find((s) => s.name === 'Léo')
    const thibault = stats.find((s) => s.name === 'Thibault')
    expect(leo?.playTimeMs).toBe(50 * 60_000)
    expect(leo?.timedMatches).toBe(2)
    expect(leo?.lastPlayedAt).toBe('2026-07-04T10:00:00.000Z')
    expect(thibault?.playTimeMs).toBe(50 * 60_000)
    expect(thibault?.timedMatches).toBe(2)
    expect(thibault?.lastPlayedAt).toBe('2026-07-04T10:00:00.000Z')
  })

  it('ignores live and zero-length durations', () => {
    const live = getMockMatch({
      id: 'live',
      started_at: '2026-07-05T10:00:00.000Z',
      ended_at: null,
      score_a: 11,
      score_b: 4,
    })
    const instant = getMockMatch({
      id: 'zero',
      started_at: '2026-07-06T10:00:00.000Z',
      ended_at: '2026-07-06T10:00:00.000Z',
      score_a: 11,
      score_b: 4,
    })
    const leo = computePlayerStats([live, instant], []).find((s) => s.name === 'Léo')
    expect(leo?.playTimeMs).toBe(0)
    expect(leo?.timedMatches).toBe(0)
  })

  it('splits match balls between both sides', () => {
    const matches = [vs('m1', '2026-07-01T10:00:00.000Z', 11, 9)].map((m) => ({
      ...m,
      mb_saved_a: 2,
      mb_saved_b: 1,
    }))
    const stats = computePlayerStats(matches, [])
    const leo = stats.find((s) => s.name === 'Léo')
    const thibault = stats.find((s) => s.name === 'Thibault')
    expect(leo).toMatchObject({ matchBallsSaved: 2, matchBallsWasted: 1, wins: 1, losses: 0 })
    expect(thibault).toMatchObject({ matchBallsSaved: 1, matchBallsWasted: 2, wins: 0, losses: 1 })
  })
})

describe('tournament titles', () => {
  const doneTournament = (
    id: string,
    name: string,
    champion: string,
    overrides?: Partial<Tournament>,
  ) => getMockTournament({ id, name, champion, ...overrides })

  it('counts titles per champion with the tournament name and month', () => {
    const tournaments = [
      doneTournament('t1', 'Tournoi de printemps', 'Léo'),
      doneTournament('t2', 'Coupe du vendredi', 'Léo'),
      doneTournament('t3', 'Open de juillet', 'Candice'),
    ]
    const matches = [
      getMockMatch({ id: 'a', tournament_id: 't1', ended_at: '2026-04-10T10:00:00.000Z' }),
      getMockMatch({ id: 'b', tournament_id: 't1', ended_at: '2026-04-12T10:00:00.000Z' }),
      getMockMatch({ id: 'c', tournament_id: 't2', ended_at: '2026-06-05T10:00:00.000Z' }),
    ]
    const titles = titlesByName(tournaments, matches)
    expect(titles.get('Léo')?.count).toBe(2)
    expect(titles.get('Léo')?.titles).toEqual([
      { name: 'Tournoi de printemps', date: 'avr. 2026' },
      { name: 'Coupe du vendredi', date: 'juin 2026' },
    ])
    expect(titles.get('Candice')?.count).toBe(1)
  })

  it('falls back to the creation month when no match is timed', () => {
    const tournaments = [
      doneTournament('t1', 'Coupe éclair', 'Léo', { created_at: '2026-03-02T09:00:00.000Z' }),
    ]
    expect(titlesByName(tournaments, []).get('Léo')?.titles).toEqual([
      { name: 'Coupe éclair', date: 'mars 2026' },
    ])
  })

  it('ignores quick games, running tournaments and missing champions', () => {
    const tournaments = [
      doneTournament('t1', 'Partie', 'Léo', { kind: 'game' }),
      doneTournament('t2', 'En cours', 'Léo', { status: 'active' }),
      doneTournament('t3', 'Sans vainqueur', 'x', { champion: null }),
    ]
    expect(titlesByName(tournaments, []).size).toBe(0)
  })
})

const row = (overrides: Partial<LeaderboardRow>): LeaderboardRow => ({
  key: 'k',
  name: 'X',
  team: null,
  avatar_url: null,
  played: 10,
  wins: 5,
  losses: 5,
  pointsFor: 100,
  pointsAgainst: 100,
  diff: 0,
  winRate: 0.5,
  currentStreak: 0,
  longestStreak: 2,
  capotsDealt: 0,
  capotsTaken: 0,
  matchBallsSaved: 0,
  matchBallsWasted: 0,
  form: [true],
  playTimeMs: 0,
  timedMatches: 0,
  lastPlayedAt: null,
  titles: 0,
  ...overrides,
})

describe('leaderboard rows and sorting', () => {
  it('joins titles onto player stats by name', () => {
    const matches = [
      getMockMatch({ id: 'a', score_a: 11, score_b: 4, ended_at: '2026-07-01T10:00:00.000Z' }),
    ]
    const stats = computePlayerStats(matches, [])
    const titles = titlesByName(
      [getMockTournament({ id: 't9', champion: 'Léo', name: 'Open' })],
      [],
    )
    const rows = leaderboardRows(stats, titles)
    expect(rows.find((r) => r.name === 'Léo')?.titles).toBe(1)
    expect(rows.find((r) => r.name === 'Thibault')?.titles).toBe(0)
  })

  it('sorts by wins descending by default, diff as tie-break', () => {
    const rows = [
      row({ key: 'a', name: 'A', wins: 3, diff: 5 }),
      row({ key: 'b', name: 'B', wins: 8 }),
      row({ key: 'c', name: 'C', wins: 3, diff: 9 }),
    ]
    expect(sortLeaderboard(rows, DEFAULT_LEADERBOARD_SORT).map((r) => r.key)).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('sorts names alphabetically ascending and flips on demand', () => {
    const rows = [
      row({ key: 'z', name: 'Zoé' }),
      row({ key: 'e', name: 'Émile' }),
      row({ key: 'a', name: 'Anna' }),
    ]
    const asc = sortLeaderboard(rows, { key: 'name', dir: 'asc' })
    expect(asc.map((r) => r.key)).toEqual(['a', 'e', 'z'])
    const desc = sortLeaderboard(rows, { key: 'name', dir: 'desc' })
    expect(desc.map((r) => r.key)).toEqual(['z', 'e', 'a'])
  })

  it('sorts every numeric column, wins then name breaking ties', () => {
    const rows = [
      row({ key: 'a', name: 'A', titles: 1, wins: 2 }),
      row({ key: 'b', name: 'B', titles: 3, wins: 1 }),
      row({ key: 'c', name: 'C', titles: 1, wins: 2 }),
    ]
    expect(sortLeaderboard(rows, { key: 'titles', dir: 'desc' }).map((r) => r.key)).toEqual([
      'b',
      'a',
      'c',
    ])
    const byPct = [row({ key: 'lo', winRate: 0.2 }), row({ key: 'hi', winRate: 0.9 })]
    expect(sortLeaderboard(byPct, { key: 'pct', dir: 'asc' }).map((r) => r.key)).toEqual([
      'lo',
      'hi',
    ])
  })

  it('toggles direction on the active column, resets to descending elsewhere', () => {
    expect(toggleSort({ key: 'wins', dir: 'desc' }, 'wins')).toEqual({ key: 'wins', dir: 'asc' })
    expect(toggleSort({ key: 'wins', dir: 'asc' }, 'wins')).toEqual({ key: 'wins', dir: 'desc' })
    expect(toggleSort({ key: 'wins', dir: 'asc' }, 'diff')).toEqual({ key: 'diff', dir: 'desc' })
    expect(toggleSort({ key: 'diff', dir: 'desc' }, 'name')).toEqual({ key: 'name', dir: 'asc' })
  })

  it('labels the current streak', () => {
    expect(streakLabel(0)).toBe('—')
    expect(streakLabel(1)).toBe('1V')
    expect(streakLabel(4)).toBe('🔥 4V')
  })
})

describe('player card (fiche joueur)', () => {
  const duel = (
    id: string,
    opponent: { name: string; pid: string },
    endedAt: string,
    scoreA: number,
    scoreB: number,
    minutes?: number,
  ): Match =>
    getMockMatch({
      id,
      player_b: opponent.name,
      player_b_id: opponent.pid,
      ended_at: endedAt,
      started_at:
        minutes === undefined
          ? null
          : new Date(new Date(endedAt).getTime() - minutes * 60_000).toISOString(),
      score_a: scoreA,
      score_b: scoreB,
    })

  const thibault = { name: 'Thibault', pid: 'pb' }
  const candice = { name: 'Candice', pid: 'pc' }
  const matches = [
    duel('m1', thibault, '2026-07-10T10:00:00.000Z', 11, 3, 20),
    duel('m2', thibault, '2026-07-12T10:00:00.000Z', 5, 11),
    duel('m3', candice, '2026-07-14T10:00:00.000Z', 11, 7, 30),
  ]
  const card = () => {
    const stats = computePlayerStats(matches, [])
    const titles = titlesByName(
      [getMockTournament({ id: 't1', name: 'Open de juillet', champion: 'Léo' })],
      [],
    )
    return playerCard('pa', stats, titles, matches, NOW)
  }

  it('is null for an unknown player', () => {
    expect(playerCard('nope', computePlayerStats(matches, []), new Map(), matches, NOW)).toBeNull()
  })

  it('builds the identity header with the last outing', () => {
    const c = card()
    expect(c?.name).toBe('Léo')
    expect(c?.lastSeen).toBe('il y a 1 j')
  })

  it('lays out the twelve KPIs with averages, play time and tones', () => {
    const kpis = card()?.kpis ?? []
    expect(kpis.map((k) => k.label)).toEqual([
      'Matchs',
      '% victoires',
      'V — D',
      'Diff',
      'Série',
      'Meilleure série',
      'Pts pour / contre',
      'Temps de jeu',
      'Durée moyenne',
      'Capots · sous la table',
      'BM sauvées',
      'BM gâchées',
    ])
    const byLabel = new Map(kpis.map((k) => [k.label, k]))
    expect(byLabel.get('Matchs')?.value).toBe('3')
    expect(byLabel.get('% victoires')?.value).toBe('67%')
    expect(byLabel.get('V — D')?.value).toBe('2 — 1')
    expect(byLabel.get('Diff')).toMatchObject({ value: '+6', tone: 'pos' })
    expect(byLabel.get('Série')).toMatchObject({ value: '1V', tone: 'pos' })
    expect(byLabel.get('Pts pour / contre')?.value).toBe('9,0 / 7,0')
    expect(byLabel.get('Temps de jeu')?.value).toBe('50 min')
    expect(byLabel.get('Durée moyenne')?.value).toBe('25 min')
    expect(byLabel.get('Capots · sous la table')?.value).toBe('0 · 0')
    expect(byLabel.get('BM sauvées')?.tone).toBe('pos')
    expect(byLabel.get('BM gâchées')?.tone).toBe('neg')
  })

  it('shows the palmarès only when the player owns titles', () => {
    expect(card()?.titles).toEqual([{ name: 'Open de juillet', date: 'juil. 2026' }])
    const stats = computePlayerStats(matches, [])
    expect(playerCard('pb', stats, new Map(), matches, NOW)?.titles).toEqual([])
  })

  it('finds the worst and best matchups by win rate', () => {
    const c = card()
    expect(c?.nemesis).toEqual({ name: 'Thibault', record: '1-1' })
    expect(c?.victim).toEqual({ name: 'Candice', record: '1-0' })
  })

  it('never names a nemesis without a loss, nor a victim without a win', () => {
    const clean = [duel('w1', thibault, '2026-07-10T10:00:00.000Z', 11, 3)]
    const c = playerCard('pa', computePlayerStats(clean, []), new Map(), clean, NOW)
    expect(c?.nemesis).toBeNull()
    expect(c?.victim).toEqual({ name: 'Thibault', record: '1-0' })
  })

  it('lists the recent matches newest first with relative dates', () => {
    const last = card()?.last8 ?? []
    expect(last.map((m) => [m.win, m.opponent, m.score, m.date])).toEqual([
      [true, 'Candice', '11-7', 'il y a 1 j'],
      [false, 'Thibault', '5-11', 'il y a 3 j'],
      [true, 'Thibault', '11-3', 'il y a 5 j'],
    ])
  })

  it('ranks the full opponent balance by win rate', () => {
    expect(card()?.opponents).toEqual([
      { name: 'Candice', record: '1-0', pct: 100, positive: true },
      { name: 'Thibault', record: '1-1', pct: 50, positive: true },
    ])
  })
})

describe('team standings point diff', () => {
  const getMockPlayer = (overrides?: Partial<Player>): Player => ({
    id: 'p1',
    created_at: '2026-01-01T09:00:00.000Z',
    name: 'Léo',
    team: 'tech',
    slack_user_id: null,
    avatar_url: null,
    ...overrides,
  })

  it('accumulates the point diff of inter-team matches only, ranked by win rate', () => {
    const players = [
      getMockPlayer({ id: 'pa', name: 'Léo', team: 'tech' }),
      getMockPlayer({ id: 'pb', name: 'Thibault', team: 'sales' }),
      getMockPlayer({ id: 'pc', name: 'Candice', team: 'tech' }),
    ]
    // Sales appears first so the ranking has to reorder, and each side wins once.
    const salesWin = getMockMatch({
      id: 'm0',
      player_a: 'Thibault',
      player_a_id: 'pb',
      player_b: 'Léo',
      player_b_id: 'pa',
      score_a: 11,
      score_b: 7,
    })
    const techWin = getMockMatch({ id: 'm1', score_a: 11, score_b: 3 })
    const techWin2 = getMockMatch({
      id: 'm2',
      player_a: 'Candice',
      player_a_id: 'pc',
      score_a: 11,
      score_b: 5,
    })
    const intra = getMockMatch({
      id: 'm3',
      player_b: 'Candice',
      player_b_id: 'pc',
      score_a: 11,
      score_b: 9,
    })
    const teams = computeTeamStats([salesWin, techWin, techWin2, intra], players)
    expect(teams.map((t) => t.team)).toEqual(['tech', 'sales'])
    expect(teams[0]).toMatchObject({
      players: 2,
      played: 3,
      wins: 2,
      diff: 8 + 6 - 4,
    })
    expect(teams[0].winRate).toBeCloseTo(2 / 3)
    expect(teams[1]).toMatchObject({ players: 1, played: 3, wins: 1, diff: -10 })
  })
})

describe('finals record', () => {
  it('counts grand finals and the two feeding finals, with wins', () => {
    const grandFinal = getMockMatch({
      id: 'gf',
      match_key: 'GF',
      bracket: 'GF',
      score_a: 11,
      score_b: 7,
    })
    const winnersFinal = getMockMatch({
      id: 'wf',
      match_key: 'W3-0',
      win_to: 'GF',
      bracket: 'W',
      score_a: 9,
      score_b: 11,
    })
    const regular = getMockMatch({ id: 'rr' })
    const finals = finalsByPlayer([grandFinal, winnersFinal, regular])
    expect(finals.get('pa')).toEqual({ name: 'Léo', played: 2, won: 1 })
    expect(finals.get('pb')).toEqual({ name: 'Thibault', played: 2, won: 1 })
  })

  it('is empty without bracket finals', () => {
    expect(finalsByPlayer([getMockMatch()]).size).toBe(0)
  })
})

describe('remontadas', () => {
  const doubleElim = (overrides?: Partial<Tournament>) =>
    getMockTournament({ id: 'de', format: 'double_elim', champion: 'Léo', ...overrides })

  it('spots a double-elim champion who passed through the loser bracket', () => {
    const loserBracketWin = getMockMatch({ id: 'lb', tournament_id: 'de', bracket: 'L' })
    expect(remontadasByName([doubleElim()], [loserBracketWin]).get('Léo')).toBe(1)
  })

  it('ignores champions who never dropped, other formats and running tournaments', () => {
    const winnersOnly = getMockMatch({ id: 'w', tournament_id: 'de', bracket: 'W' })
    expect(remontadasByName([doubleElim()], [winnersOnly]).size).toBe(0)
    const lb = getMockMatch({ id: 'lb', tournament_id: 'de', bracket: 'L' })
    expect(remontadasByName([doubleElim({ format: 'round_robin' })], [lb]).size).toBe(0)
    expect(remontadasByName([doubleElim({ status: 'active' })], [lb]).size).toBe(0)
    const lbOther = getMockMatch({
      id: 'lb2',
      tournament_id: 'de',
      bracket: 'L',
      player_a: 'Maxime',
      player_b: 'Sarah',
    })
    expect(remontadasByName([doubleElim()], [lbOther]).size).toBe(0)
  })
})

describe('records assembly', () => {
  it('shows nothing for an empty scope', () => {
    expect(playerRecords([], new Map(), new Map(), new Map())).toEqual([])
    expect(matchRecords([])).toEqual([])
  })

  it('crowns the serial winner, marathonien and homme des finales', () => {
    const matches = [
      getMockMatch({
        id: 'm1',
        ended_at: '2026-07-10T10:00:00.000Z',
        started_at: '2026-07-10T09:20:00.000Z',
        score_a: 11,
        score_b: 5,
      }),
    ]
    const stats = computePlayerStats(matches, [])
    const titles = titlesByName(
      [
        getMockTournament({ id: 't1', name: 'A', champion: 'Léo' }),
        getMockTournament({ id: 't2', name: 'B', champion: 'Léo' }),
      ],
      [],
    )
    const finals = finalsByPlayer([
      getMockMatch({ id: 'gf', match_key: 'GF', score_a: 11, score_b: 7 }),
    ])
    const remontadas = remontadasByName(
      [getMockTournament({ id: 'de', format: 'double_elim', champion: 'Léo' })],
      [getMockMatch({ id: 'lb', tournament_id: 'de', bracket: 'L' })],
    )
    const cards = playerRecords(stats, titles, finals, remontadas)
    const byLabel = new Map(cards.map((c) => [c.label, c]))
    expect(byLabel.get('Serial winner')).toMatchObject({
      icon: '🏆',
      value: 'Léo',
      sub: '2 tournois gagnés',
    })
    expect(byLabel.get('Marathonien')).toMatchObject({
      value: 'Léo',
      sub: '40 min de jeu cumulées',
    })
    expect(byLabel.get('Homme des finales')).toMatchObject({
      value: 'Léo',
      sub: '1 finale jouée · 1 gagnée',
    })
    expect(byLabel.get('Remontada')).toMatchObject({
      value: 'Léo',
      sub: 'titre décroché depuis le loser bracket',
    })
    expect(byLabel.get('Plus actif')).toMatchObject({ value: 'Léo', sub: '1 match joué' })
  })

  it('hides player records whose condition never happened', () => {
    const matches = [getMockMatch({ id: 'm1', score_a: 11, score_b: 5 })]
    const stats = computePlayerStats(matches, [])
    const labels = playerRecords(stats, new Map(), new Map(), new Map()).map((c) => c.label)
    expect(labels).toContain('Plus actif')
    expect(labels).not.toContain('Serial winner')
    expect(labels).not.toContain('Marathonien')
    expect(labels).not.toContain('Homme des finales')
    expect(labels).not.toContain('Remontada')
    expect(labels).not.toContain('Bourreau')
    expect(labels).not.toContain('Plus longue série')
  })

  it('summarises the four match records without « Plus de points »', () => {
    const long = getMockMatch({
      id: 'long',
      started_at: '2026-07-10T09:00:00.000Z',
      ended_at: '2026-07-10T09:38:00.000Z',
      score_a: 16,
      score_b: 14,
    })
    const short = getMockMatch({
      id: 'short',
      started_at: '2026-07-11T09:00:00.000Z',
      ended_at: '2026-07-11T09:04:00.000Z',
      score_a: 11,
      score_b: 0,
    })
    const cards = matchRecords([long, short])
    expect(cards.map((c) => c.label)).toEqual([
      'Plus long match',
      'Plus court match',
      'Plus gros écart',
      'Match le plus serré',
    ])
    const byLabel = new Map(cards.map((c) => [c.label, c]))
    expect(byLabel.get('Plus long match')).toMatchObject({
      value: '38 min',
      sub: 'Léo 16 — 14 Thibault',
    })
    expect(byLabel.get('Plus court match')?.value).toBe('4 min')
    expect(byLabel.get('Plus gros écart')?.value).toBe('+11')
    expect(byLabel.get('Match le plus serré')?.value).toBe('16 — 14')
  })

  it('skips duration records when no match is timed', () => {
    const cards = matchRecords([getMockMatch({ id: 'a', score_a: 11, score_b: 8 })])
    expect(cards.map((c) => c.label)).toEqual(['Plus gros écart', 'Match le plus serré'])
  })
})

describe('head-to-head abbreviations', () => {
  it('takes the first three letters, uppercased and unaccented', () => {
    expect(abbrev('Léo')).toBe('LEO')
    expect(abbrev('Émilie')).toBe('EMI')
    expect(abbrev('Thibault')).toBe('THI')
  })

  it('survives short and padded names', () => {
    expect(abbrev('Al')).toBe('AL')
    expect(abbrev('  Zoé ')).toBe('ZOE')
    expect(abbrev('')).toBe('?')
  })
})

describe('tightest rivalries hint', () => {
  const rivalry = (aName: string, bName: string, aWins: number, bWins: number) => ({
    aKey: aName,
    aName,
    aTeam: null,
    bKey: bName,
    bName,
    bTeam: null,
    total: aWins + bWins,
    aWins,
    bWins,
    lastPlayed: null,
  })

  it('names the duels with their scores, French-joined', () => {
    expect(tightestHint([rivalry('Maxime', 'Nicolas', 5, 5)])).toBe(
      'Les duels les plus serrés : Maxime — Nicolas (5–5).',
    )
    expect(
      tightestHint([rivalry('Maxime', 'Nicolas', 5, 5), rivalry('Émilie', 'Julien', 4, 4)]),
    ).toBe('Les duels les plus serrés : Maxime — Nicolas (5–5) et Émilie — Julien (4–4).')
    expect(
      tightestHint([rivalry('A', 'B', 3, 3), rivalry('C', 'D', 2, 2), rivalry('E', 'F', 1, 1)]),
    ).toBe('Les duels les plus serrés : A — B (3–3), C — D (2–2) et E — F (1–1).')
  })

  it('is null without tight duels', () => {
    expect(tightestHint([])).toBeNull()
  })
})

describe('mutation hardening', () => {
  it('exposes the exact segmented-control options', () => {
    expect(PERIOD_OPTIONS).toEqual([
      { value: 'tout', label: 'Tout' },
      { value: 'saison', label: 'Cette saison' },
      { value: 'mois', label: 'Ce mois-ci' },
      { value: 'semaine', label: 'Cette semaine' },
    ])
    expect(TYPE_OPTIONS).toEqual([
      { value: 'tout', label: 'Tout' },
      { value: 'tournois', label: 'Tournois' },
      { value: 'rapides', label: 'Parties rapides' },
    ])
  })

  it('accents only the weekly highlight of the first KPI', () => {
    const thisWeek = getMockMatch({ id: 'w', ended_at: '2026-07-14T10:00:00.000Z' })
    const older = getMockMatch({ id: 'o', ended_at: '2026-07-02T10:00:00.000Z' })
    expect(statsKpis([thisWeek, older], getFilters(), NOW).map((k) => k.accent)).toEqual([
      true,
      false,
      false,
      false,
    ])
    expect(
      statsKpis([thisWeek, older], getFilters({ period: 'mois' }), NOW).map((k) => k.accent),
    ).toEqual([false, false, false, false])
  })

  it('dates a title from its latest match even when matches arrive out of order', () => {
    const tournaments = [getMockTournament({ id: 't1', name: 'Long', champion: 'Léo' })]
    const matches = [
      getMockMatch({ id: 'late', tournament_id: 't1', ended_at: '2026-05-20T10:00:00.000Z' }),
      getMockMatch({ id: 'early', tournament_id: 't1', ended_at: '2026-04-01T10:00:00.000Z' }),
    ]
    expect(titlesByName(tournaments, matches).get('Léo')?.titles).toEqual([
      { name: 'Long', date: 'mai 2026' },
    ])
  })

  it('crowns the serial winner even when a lesser champion registered first', () => {
    const titles = titlesByName(
      [
        getMockTournament({ id: 't1', name: 'A', champion: 'Candice' }),
        getMockTournament({ id: 't2', name: 'B', champion: 'Léo' }),
        getMockTournament({ id: 't3', name: 'C', champion: 'Léo' }),
      ],
      [],
    )
    const serial = playerRecords([], titles, new Map(), new Map()).find(
      (c) => c.label === 'Serial winner',
    )
    expect(serial).toMatchObject({ value: 'Léo', sub: '2 tournois gagnés' })
  })

  it('crowns the finalist with most finals even when registered later', () => {
    const finals = finalsByPlayer([
      getMockMatch({ id: 'gf', match_key: 'GF', score_a: 9, score_b: 11 }),
      getMockMatch({
        id: 'wf',
        match_key: 'W3-0',
        win_to: 'GF',
        player_a: 'Candice',
        player_a_id: 'pc',
        score_a: 8,
        score_b: 11,
      }),
    ])
    const card = playerRecords([], new Map(), finals, new Map()).find(
      (c) => c.label === 'Homme des finales',
    )
    expect(card).toMatchObject({ value: 'Thibault', sub: '2 finales jouées · 2 gagnées' })
  })

  it('pluralises repeated remontadas', () => {
    const remontadas = remontadasByName(
      [
        getMockTournament({ id: 'd1', format: 'double_elim', champion: 'Léo' }),
        getMockTournament({ id: 'd2', format: 'double_elim', champion: 'Léo' }),
      ],
      [
        getMockMatch({ id: 'l1', tournament_id: 'd1', bracket: 'L' }),
        getMockMatch({ id: 'l2', tournament_id: 'd2', bracket: 'L' }),
      ],
    )
    const card = playerRecords([], new Map(), new Map(), remontadas).find(
      (c) => c.label === 'Remontada',
    )
    expect(card).toMatchObject({
      value: 'Léo',
      sub: '2 titres décrochés depuis le loser bracket',
    })
  })

  it('fills the capot, match-ball and streak record cards', () => {
    const matches = [
      getMockMatch({
        id: 'm1',
        ended_at: '2026-07-01T10:00:00.000Z',
        score_a: 11,
        score_b: 0,
        mb_saved_a: 2,
      }),
      getMockMatch({
        id: 'm2',
        ended_at: '2026-07-02T10:00:00.000Z',
        score_a: 11,
        score_b: 9,
        mb_saved_b: 1,
      }),
    ]
    const cards = playerRecords(computePlayerStats(matches, []), new Map(), new Map(), new Map())
    const byLabel = new Map(cards.map((c) => [c.label, c]))
    expect(byLabel.get('Plus longue série')).toMatchObject({
      icon: '🔥',
      value: 'Léo',
      sub: "2 victoires d'affilée",
    })
    expect(byLabel.get('Plus actif')).toMatchObject({ value: 'Léo', sub: '2 matchs joués' })
    expect(byLabel.get('Bourreau')).toMatchObject({
      icon: '🪑',
      value: 'Léo',
      sub: '1 capot infligé',
    })
    expect(byLabel.get('Roi de la table')).toMatchObject({
      icon: '🙈',
      value: 'Thibault',
      sub: '1 passage sous la table',
    })
    expect(byLabel.get('Sang-froid')).toMatchObject({
      icon: '🧊',
      value: 'Léo',
      sub: '2 balles de match sauvées',
    })
    expect(byLabel.get('Cardiaque')).toMatchObject({
      icon: '😰',
      value: 'Thibault',
      sub: '2 balles de match gâchées',
    })
  })

  it('stamps every match-record icon', () => {
    const long = getMockMatch({
      id: 'long',
      started_at: '2026-07-10T09:00:00.000Z',
      ended_at: '2026-07-10T09:38:00.000Z',
      score_a: 16,
      score_b: 14,
    })
    const short = getMockMatch({
      id: 'short',
      started_at: '2026-07-11T09:00:00.000Z',
      ended_at: '2026-07-11T09:04:00.000Z',
      score_a: 11,
      score_b: 0,
    })
    expect(matchRecords([long, short]).map((c) => c.icon)).toEqual(['⌛', '⚡', '📏', '😬'])
  })

  it('ranks opponents by rate then volume, flags the losing balances', () => {
    const duel = (id: string, name: string, pid: string, scoreA: number, scoreB: number) =>
      getMockMatch({
        id,
        player_b: name,
        player_b_id: pid,
        score_a: scoreA,
        score_b: scoreB,
        ended_at: `2026-07-0${Number(id.slice(1)) % 9 || 1}T10:00:00.000Z`,
      })
    const matches = [
      duel('d1', 'Xavier', 'px', 3, 11),
      duel('d2', 'Xavier', 'px', 5, 11),
      duel('d3', 'Yann', 'py', 11, 9),
      duel('d4', 'Yann', 'py', 9, 11),
      duel('d5', 'Zoé', 'pz', 11, 4),
      duel('d6', 'Willy', 'pw', 11, 4),
      duel('d7', 'Willy', 'pw', 11, 6),
    ]
    const card = playerCard('pa', computePlayerStats(matches, []), new Map(), matches, NOW)
    expect(card?.opponents).toEqual([
      { name: 'Willy', record: '2-0', pct: 100, positive: true },
      { name: 'Zoé', record: '1-0', pct: 100, positive: true },
      { name: 'Yann', record: '1-1', pct: 50, positive: true },
      { name: 'Xavier', record: '0-2', pct: 0, positive: false },
    ])
    expect(card?.nemesis).toEqual({ name: 'Xavier', record: '0-2' })
    expect(card?.victim).toEqual({ name: 'Willy', record: '2-0' })
  })

  it('shows the losing side of the fiche without inventing feats', () => {
    const loss = getMockMatch({
      id: 'l1',
      ended_at: '2026-07-14T10:00:00.000Z',
      score_a: 11,
      score_b: 6,
    })
    const card = playerCard('pb', computePlayerStats([loss], []), new Map(), [loss], NOW)
    const byLabel = new Map(card?.kpis.map((k) => [k.label, k]))
    expect(byLabel.get('Matchs')?.value).toBe('1')
    expect(byLabel.get('% victoires')?.value).toBe('0%')
    expect(byLabel.get('V — D')?.value).toBe('0 — 1')
    expect(byLabel.get('Diff')).toMatchObject({ value: '−5', tone: 'neg' })
    expect(byLabel.get('Série')).toMatchObject({ value: '—', tone: 'ink' })
    expect(byLabel.get('Meilleure série')?.value).toBe('—')
    expect(byLabel.get('Temps de jeu')?.value).toBe('—')
    expect(byLabel.get('Durée moyenne')?.value).toBe('—')
    expect(card?.victim).toBeNull()
    expect(card?.last8[0]).toEqual({
      win: false,
      opponent: 'Léo',
      score: '6-11',
      date: 'il y a 1 j',
    })
  })

  it('keeps a neutral tone on a perfectly balanced diff', () => {
    const matches = [
      getMockMatch({ id: 'a', score_a: 11, score_b: 9, ended_at: '2026-07-01T10:00:00.000Z' }),
      getMockMatch({ id: 'b', score_a: 9, score_b: 11, ended_at: '2026-07-02T10:00:00.000Z' }),
    ]
    const card = playerCard('pa', computePlayerStats(matches, []), new Map(), matches, NOW)
    expect(card?.kpis.find((k) => k.label === 'Diff')).toMatchObject({
      value: '±0',
      tone: 'ink',
    })
  })

  it('reads matches from the b side of the table too', () => {
    const asB = getMockMatch({
      id: 'b1',
      player_a: 'Maxime',
      player_a_id: 'pm',
      player_b: 'Léo',
      player_b_id: 'pa',
      score_a: 7,
      score_b: 11,
      ended_at: '2026-07-14T10:00:00.000Z',
    })
    const card = playerCard('pa', computePlayerStats([asB], []), new Map(), [asB], NOW)
    expect(card?.last8[0]).toMatchObject({ win: true, opponent: 'Maxime', score: '11-7' })
  })

  it('counts Sunday play in the weekday profile', () => {
    // 2026-07-19 is a Sunday.
    const profile = weekdayProfile([getMockMatch({ ended_at: '2026-07-19T10:00:00.000Z' })])
    expect(profile.map((w) => w.label)).toEqual(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Dim'])
  })

  it('sorts the leaderboard on every numeric column', () => {
    const rows = [
      row({
        key: 'a',
        name: 'A',
        played: 1,
        losses: 5,
        diff: -2,
        currentStreak: 3,
        matchBallsSaved: 1,
        matchBallsWasted: 9,
      }),
      row({
        key: 'b',
        name: 'B',
        played: 9,
        losses: 1,
        diff: 4,
        currentStreak: 0,
        matchBallsSaved: 6,
        matchBallsWasted: 2,
      }),
    ]
    expect(sortLeaderboard(rows, { key: 'played', dir: 'desc' })[0].key).toBe('b')
    expect(sortLeaderboard(rows, { key: 'losses', dir: 'desc' })[0].key).toBe('a')
    expect(sortLeaderboard(rows, { key: 'diff', dir: 'desc' })[0].key).toBe('b')
    expect(sortLeaderboard(rows, { key: 'streak', dir: 'desc' })[0].key).toBe('a')
    expect(sortLeaderboard(rows, { key: 'mbSaved', dir: 'desc' })[0].key).toBe('b')
    expect(sortLeaderboard(rows, { key: 'mbWasted', dir: 'desc' })[0].key).toBe('a')
  })

  it('handles the smallest plural boundaries', () => {
    expect(streakLabel(2)).toBe('🔥 2V')
    expect(chartRangeLabel(2)).toBe("2 jours d'activité")
    expect(scopeLabel(2, getFilters())).toBe('2 matchs · tout · tout')
  })

  it('labels every month of the year', () => {
    const months = [
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
      '2026-08-15',
      '2026-09-15',
      '2026-10-15',
      '2026-11-15',
      '2026-12-15',
    ]
    const days = activityDays(
      months.map((d, i) => getMockMatch({ id: `m${i}`, ended_at: `${d}T10:00:00.000Z` })),
    )
    expect(days.map((d) => d.label)).toEqual([
      '15 janv.',
      '15 févr.',
      '15 mars',
      '15 août',
      '15 sept.',
      '15 oct.',
      '15 nov.',
      '15 déc.',
    ])
  })

  it('keeps the neutral KPI tones neutral', () => {
    const matches = [
      getMockMatch({ id: 'm1', score_a: 11, score_b: 9, ended_at: '2026-07-01T10:00:00.000Z' }),
    ]
    const card = playerCard('pa', computePlayerStats(matches, []), new Map(), matches, NOW)
    const tones = new Map(card?.kpis.map((k) => [k.label, k.tone]))
    expect(tones.get('Matchs')).toBe('ink')
    expect(tones.get('% victoires')).toBe('ink')
    expect(tones.get('V — D')).toBe('ink')
    expect(tones.get('Capots · sous la table')).toBe('ink')
    expect(tones.get('Pts pour / contre')).toBe('ink')
  })

  it('leaves the last outing blank for an undated history', () => {
    const untimed = getMockMatch({ id: 'u', ended_at: null, started_at: null })
    const card = playerCard('pa', computePlayerStats([untimed], []), new Map(), [untimed], NOW)
    expect(card?.lastSeen).toBeNull()
  })
})

describe('filter labels', () => {
  it('knows when a non-default filter is active', () => {
    expect(isFiltered(getFilters())).toBe(false)
    expect(isFiltered(getFilters({ period: 'mois' }))).toBe(true)
    expect(isFiltered(getFilters({ type: 'tournois' }))).toBe(true)
  })

  it('names only the active filters in the pill', () => {
    expect(filterPillLabel(getFilters({ period: 'mois' }))).toBe('Filtré · Ce mois-ci')
    expect(filterPillLabel(getFilters({ type: 'rapides' }))).toBe('Filtré · Parties rapides')
    expect(filterPillLabel(getFilters({ period: 'semaine', type: 'tournois' }))).toBe(
      'Filtré · Cette semaine · Tournois',
    )
  })

  it('describes the scope with count and lowercased filters', () => {
    expect(scopeLabel(156, getFilters())).toBe('156 matchs · tout · tout')
    expect(scopeLabel(1, getFilters({ period: 'mois', type: 'tournois' }))).toBe(
      '1 match · ce mois-ci · tournois',
    )
    expect(scopeLabel(0, getFilters({ type: 'rapides' }))).toBe('0 match · tout · parties rapides')
  })
})

describe('« Cette saison » period', () => {
  it('offers the periods widest to narrowest, season second', () => {
    expect(PERIOD_OPTIONS.map((o) => o.value)).toEqual(['tout', 'saison', 'mois', 'semaine'])
  })

  it('round-trips through the URL', () => {
    expect(parseStatsFilters('?p=saison').period).toBe('saison')
    expect(statsSearch({ period: 'saison', type: 'tout' })).toBe('?p=saison')
  })

  it('rejects an unknown period', () => {
    expect(parseStatsFilters('?p=nawak').period).toBe('tout')
  })

  it('filters to the season window, not a rolling ninety days', () => {
    const now = new Date(2026, 9, 15)
    const inside = getMockMatch({ id: 'in', ended_at: new Date(2026, 8, 2).toISOString() })
    const recentButPreSeason = getMockMatch({
      id: 'out',
      ended_at: new Date(2026, 7, 20).toISOString(),
    })
    const kept = scopeMatches(
      [inside, recentButPreSeason],
      [getMockTournament()],
      { period: 'saison', type: 'tout' },
      now,
    )
    expect(kept.map((m) => m.id)).toEqual(['in'])
  })

  it('stops at the season boundary rather than running on into the next one', () => {
    const now = new Date(2026, 9, 15)
    const nextSeason = getMockMatch({ id: 'next', ended_at: new Date(2026, 11, 2).toISOString() })
    expect(
      scopeMatches([nextSeason], [getMockTournament()], { period: 'saison', type: 'tout' }, now),
    ).toEqual([])
  })

  it('keeps nothing before the first season starts', () => {
    const now = new Date(2026, 7, 15)
    const m = getMockMatch({ ended_at: new Date(2026, 7, 1).toISOString() })
    expect(
      scopeMatches([m], [getMockTournament()], { period: 'saison', type: 'tout' }, now),
    ).toEqual([])
  })
})

describe('« Cette saison » window boundaries', () => {
  const now = new Date(2026, 9, 15)
  const saison = { period: 'saison', type: 'tout' } as const

  it('keeps a match played at the opening midnight', () => {
    const opener = getMockMatch({ id: 'opener', ended_at: new Date(2026, 8, 1).toISOString() })
    expect(scopeMatches([opener], [getMockTournament()], saison, now).map((m) => m.id)).toEqual([
      'opener',
    ])
  })

  it('drops a match played at the closing midnight — that one belongs to winter', () => {
    const closer = getMockMatch({ id: 'closer', ended_at: new Date(2026, 11, 1).toISOString() })
    expect(scopeMatches([closer], [getMockTournament()], saison, now)).toEqual([])
  })
})

describe('« Cette semaine » window boundaries', () => {
  // NOW is Wednesday 15 July 2026, so the week runs Monday 13th → Monday 20th.
  const semaine = { period: 'semaine', type: 'tout' } as const

  it('keeps a match played at Monday midnight', () => {
    const monday = getMockMatch({ id: 'monday', ended_at: new Date(2026, 6, 13).toISOString() })
    expect(scopeMatches([monday], [getMockTournament()], semaine, NOW).map((m) => m.id)).toEqual([
      'monday',
    ])
  })

  it('drops a match played at the next Monday midnight', () => {
    const next = getMockMatch({ id: 'next', ended_at: new Date(2026, 6, 20).toISOString() })
    expect(scopeMatches([next], [getMockTournament()], semaine, NOW)).toEqual([])
  })
})

describe('isPeriodAvailable', () => {
  it('offers « Cette saison » only once a season is running', () => {
    expect(isPeriodAvailable('saison', new Date(2026, 9, 15))).toBe(true)
    expect(isPeriodAvailable('saison', new Date(2026, 7, 15))).toBe(false)
  })

  it('is true on the very first day of the very first season', () => {
    expect(isPeriodAvailable('saison', new Date(2026, 8, 1))).toBe(true)
  })

  it('never withholds the periods that do not depend on a season', () => {
    const before = new Date(2026, 7, 15)
    expect(isPeriodAvailable('tout', before)).toBe(true)
    expect(isPeriodAvailable('mois', before)).toBe(true)
    expect(isPeriodAvailable('semaine', before)).toBe(true)
  })
})
