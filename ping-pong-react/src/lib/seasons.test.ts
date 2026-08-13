import { describe, expect, it } from 'vitest'
import {
  currentSeason,
  daysLeft,
  isClosed,
  nextSeason,
  SEASONS_START,
  seasonById,
  seasonOf,
  matchesInSeason,
  seasonBannerState,
  seasonChampion,
  seasonWindowLabel,
  seasonsUpTo,
  ladderIdentity,
  ladderScopeSearch,
  parseLadderScope,
  type LadderIdentityInput,
  type LadderScope,
  type SeasonBannerInput,
} from './seasons'
import { rankRatings, ratedMatches, replayRatings, RATING } from './rating'
import type { Match, Player, Tournament } from '../types'
import type { RatingRow } from './rating'

const at = (y: number, m: number, d: number, h = 12): string =>
  new Date(y, m, d, h).toISOString()

describe('seasonOf', () => {
  it('maps September, October and November to autumn of that year', () => {
    expect(seasonOf(at(2026, 8, 1))).toBe('automne-2026')
    expect(seasonOf(at(2026, 9, 15))).toBe('automne-2026')
    expect(seasonOf(at(2026, 10, 30))).toBe('automne-2026')
  })

  it('maps December to the winter starting that year', () => {
    expect(seasonOf(at(2026, 11, 1))).toBe('hiver-2026')
  })

  it('maps January and February to the winter that started the previous December', () => {
    expect(seasonOf(at(2027, 0, 15))).toBe('hiver-2026')
    expect(seasonOf(at(2027, 1, 28))).toBe('hiver-2026')
  })

  it('maps March, April and May to the spring of that year', () => {
    expect(seasonOf(at(2027, 2, 10))).toBe('printemps-2027')
    expect(seasonOf(at(2027, 3, 10))).toBe('printemps-2027')
    expect(seasonOf(at(2027, 4, 10))).toBe('printemps-2027')
  })

  it('maps June, July and August to the summer of that year', () => {
    expect(seasonOf(at(2027, 5, 10))).toBe('ete-2027')
    expect(seasonOf(at(2027, 6, 10))).toBe('ete-2027')
    expect(seasonOf(at(2027, 7, 10))).toBe('ete-2027')
  })

  it('returns null before seasons began', () => {
    expect(seasonOf(at(2026, 7, 31))).toBeNull()
  })

  it('returns null for an undated match', () => {
    expect(seasonOf(null)).toBeNull()
  })

  it('returns null for a timestamp that will not parse', () => {
    expect(seasonOf('pas une date')).toBeNull()
  })

  it('begins exactly at local midnight on 1 September 2026', () => {
    expect(SEASONS_START.getTime()).toBe(new Date(2026, 8, 1).getTime())
    expect(seasonOf(new Date(2026, 8, 1, 0, 0, 0).toISOString())).toBe('automne-2026')
    expect(seasonOf(new Date(2026, 7, 31, 23, 59, 59).toISOString())).toBeNull()
  })
})

describe('seasonById', () => {
  it('labels winter across two years', () => {
    expect(seasonById('hiver-2026')?.label).toBe('Saison Hiver 2026-27')
  })

  it('labels the other three with a single year', () => {
    expect(seasonById('automne-2026')?.label).toBe('Saison Automne 2026')
    expect(seasonById('printemps-2027')?.label).toBe('Saison Printemps 2027')
    expect(seasonById('ete-2027')?.label).toBe('Saison Été 2027')
  })

  it('ends winter at the start of March, so leap years need no special case', () => {
    expect(seasonById('hiver-2027')?.end.getTime()).toBe(new Date(2028, 2, 1).getTime())
  })

  it('returns null for a malformed id', () => {
    expect(seasonById('nawak-2026')).toBeNull()
    expect(seasonById('automne')).toBeNull()
    expect(seasonById('automne-abcd')).toBeNull()
  })
})

describe('currentSeason', () => {
  it('is null before the first season starts', () => {
    expect(currentSeason(new Date(2026, 7, 31))).toBeNull()
  })

  it('is the containing season once seasons have begun', () => {
    expect(currentSeason(new Date(2026, 9, 5))?.id).toBe('automne-2026')
  })
})

describe('currentSeason boundary', () => {
  it('is already running at the very first midnight', () => {
    expect(currentSeason(SEASONS_START)?.id).toBe('automne-2026')
  })
})

describe('seasonsUpTo', () => {
  it('is empty before the first season starts', () => {
    expect(seasonsUpTo(new Date(2026, 7, 31))).toEqual([])
  })

  it('lists started seasons newest first', () => {
    expect(seasonsUpTo(new Date(2027, 3, 10)).map((s) => s.id)).toEqual([
      'printemps-2027',
      'hiver-2026',
      'automne-2026',
    ])
  })

  it('excludes a season that has not started yet', () => {
    expect(seasonsUpTo(new Date(2026, 10, 30)).map((s) => s.id)).toEqual(['automne-2026'])
  })
})

describe('seasonsUpTo boundary', () => {
  it('counts a season from the day it opens, not the day after', () => {
    expect(seasonsUpTo(new Date(2026, 11, 1)).map((s) => s.id)).toEqual([
      'hiver-2026',
      'automne-2026',
    ])
  })
})

describe('nextSeason', () => {
  it('follows the cycle and rolls the year at the turn', () => {
    expect(nextSeason(seasonById('automne-2026')!).id).toBe('hiver-2026')
    expect(nextSeason(seasonById('hiver-2026')!).id).toBe('printemps-2027')
    expect(nextSeason(seasonById('printemps-2027')!).id).toBe('ete-2027')
    expect(nextSeason(seasonById('ete-2027')!).id).toBe('automne-2027')
  })
})

describe('daysLeft', () => {
  it('counts whole days to the end of the window', () => {
    expect(daysLeft(seasonById('automne-2026')!, new Date(2026, 10, 29, 12))).toBe(2)
  })

  it('is zero once the season is over, never negative', () => {
    expect(daysLeft(seasonById('automne-2026')!, new Date(2027, 0, 1))).toBe(0)
  })
})

describe('isClosed', () => {
  it('is false on the last day and true at the boundary', () => {
    const s = seasonById('automne-2026')!
    expect(isClosed(s, new Date(2026, 10, 30, 23, 59))).toBe(false)
    expect(isClosed(s, new Date(2026, 11, 1, 0, 0))).toBe(true)
  })
})

describe('seasonWindowLabel', () => {
  it('reads from the first day to the last day inclusive', () => {
    expect(seasonWindowLabel(seasonById('automne-2026')!)).toBe('1 septembre → 30 novembre 2026')
  })

  it('spans the new year for winter', () => {
    expect(seasonWindowLabel(seasonById('hiver-2026')!)).toBe('1 décembre → 28 février 2027')
  })
})

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
  ended_at: at(2026, 9, 10),
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

const getMockRow = (overrides?: Partial<RatingRow>): RatingRow => ({
  key: 'pa',
  playerId: 'pa',
  name: 'Léo',
  rating: 1600,
  rd: 80,
  vol: 0.06,
  games: 20,
  peak: 1620,
  lastPlayedAt: at(2026, 9, 10),
  rank: 1,
  provisional: false,
  team: 'tech',
  avatar_url: null,
  trend: 4,
  ...overrides,
})

describe('matchesInSeason', () => {
  it('keeps matches inside the window and drops those outside', () => {
    const inside = getMockMatch({ id: 'in', ended_at: at(2026, 9, 10) })
    const before = getMockMatch({ id: 'before', ended_at: at(2026, 7, 20) })
    const after = getMockMatch({ id: 'after', ended_at: at(2026, 11, 2) })
    expect(matchesInSeason([inside, before, after], 'automne-2026').map((m) => m.id)).toEqual(['in'])
  })

  it('falls back to started_at when the match never ended', () => {
    const m = getMockMatch({ id: 'live', ended_at: null, started_at: at(2026, 9, 3) })
    expect(matchesInSeason([m], 'automne-2026').map((x) => x.id)).toEqual(['live'])
  })

  it('drops undated matches from every season', () => {
    const m = getMockMatch({ ended_at: null, started_at: null })
    expect(matchesInSeason([m], 'automne-2026')).toEqual([])
  })

  it('counts a match by when it ended, so one straddling midnight joins the new season', () => {
    const m = getMockMatch({
      id: 'straddle',
      started_at: at(2026, 10, 30, 23),
      ended_at: new Date(2026, 11, 1, 0, 5).toISOString(),
    })
    expect(matchesInSeason([m], 'automne-2026')).toEqual([])
    expect(matchesInSeason([m], 'hiver-2026').map((x) => x.id)).toEqual(['straddle'])
  })

  it('opens the window at midnight and closes it the instant the next season starts', () => {
    const opener = getMockMatch({ id: 'opener', ended_at: new Date(2026, 8, 1).toISOString() })
    const closer = getMockMatch({ id: 'closer', ended_at: new Date(2026, 11, 1).toISOString() })
    expect(matchesInSeason([opener, closer], 'automne-2026').map((m) => m.id)).toEqual(['opener'])
  })

  it('returns nothing for an unknown season id', () => {
    expect(matchesInSeason([getMockMatch()], 'nawak-2026')).toEqual([])
  })
})

describe('seasonChampion', () => {
  it('crowns the highest-rated eligible player', () => {
    const rows = [getMockRow({ key: 'a', rating: 1600 }), getMockRow({ key: 'b', rating: 1550 })]
    expect(seasonChampion(rows)?.key).toBe('a')
  })

  it('skips a provisional player sitting at the top of the table', () => {
    const rows = [
      getMockRow({ key: 'hot', rating: 1650, games: 4, provisional: true }),
      getMockRow({ key: 'regular', rating: 1580, games: 32, provisional: false }),
    ]
    expect(seasonChampion(rows)?.key).toBe('regular')
  })

  it('crowns nobody when every player is provisional', () => {
    expect(seasonChampion([getMockRow({ games: 3, provisional: true })])).toBeNull()
  })

  it('crowns nobody on an empty ladder', () => {
    expect(seasonChampion([])).toBeNull()
  })
})

const getMockBannerInput = (overrides?: Partial<SeasonBannerInput>): SeasonBannerInput => ({
  season: seasonById('automne-2026'),
  now: new Date(2026, 9, 15),
  ratedCount: 40,
  leader: getMockRow({ games: 20, provisional: false }),
  ...overrides,
})

describe('seasonBannerState', () => {
  it('is pre-season when no season has started', () => {
    expect(seasonBannerState(getMockBannerInput({ season: null }))).toBe('pre')
  })

  it('is empty when the window holds no rated match', () => {
    expect(seasonBannerState(getMockBannerInput({ ratedCount: 0, leader: null }))).toBe('empty')
  })

  it('is empty when every match in the window was unranked, leaving no leader', () => {
    // Guarding on the RAW match count here would dereference a null leader:
    // « non classée » games and doubles are filtered out before the ladder is built.
    expect(seasonBannerState(getMockBannerInput({ ratedCount: 0, leader: null }))).toBe('empty')
  })

  it('is empty when the ladder is bare even though the window holds rated matches', () => {
    expect(seasonBannerState(getMockBannerInput({ ratedCount: 12, leader: null }))).toBe('empty')
  })

  it('is empty when no rated match was played, whatever the ladder says', () => {
    expect(seasonBannerState(getMockBannerInput({ ratedCount: 0 }))).toBe('empty')
  })

  it('is noleader while the leader has not cleared the gate', () => {
    const leader = getMockRow({ games: 6, provisional: true })
    expect(seasonBannerState(getMockBannerInput({ leader }))).toBe('noleader')
  })

  it('is final in the last week when someone is eligible', () => {
    expect(seasonBannerState(getMockBannerInput({ now: new Date(2026, 10, 28) }))).toBe('final')
  })

  it('stays noleader in the last week when nobody is eligible', () => {
    const leader = getMockRow({ games: 6, provisional: true })
    expect(seasonBannerState(getMockBannerInput({ now: new Date(2026, 10, 28), leader }))).toBe(
      'noleader',
    )
  })

  it('turns final exactly FINAL_DAYS out, not a day later', () => {
    expect(seasonBannerState(getMockBannerInput({ now: new Date(2026, 10, 24) }))).toBe('final')
    expect(seasonBannerState(getMockBannerInput({ now: new Date(2026, 10, 23) }))).toBe('running')
  })

  it('is running in the ordinary middle of a season', () => {
    expect(seasonBannerState(getMockBannerInput())).toBe('running')
  })

  it('is champion once closed with an eligible winner', () => {
    expect(seasonBannerState(getMockBannerInput({ now: new Date(2026, 11, 5) }))).toBe('champion')
  })

  it('is nochamp once closed with nobody eligible', () => {
    const leader = getMockRow({ games: 4, provisional: true })
    expect(seasonBannerState(getMockBannerInput({ now: new Date(2026, 11, 5), leader }))).toBe(
      'nochamp',
    )
  })
})

const getMockPlayer = (overrides?: Partial<Player>): Player => ({
  id: 'pa',
  created_at: at(2026, 0, 1),
  name: 'Léo',
  team: 'tech',
  slack_user_id: null,
  avatar_url: null,
  ...overrides,
})

const getMockTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  created_at: at(2026, 8, 1),
  name: 'Tournoi',
  target: 11,
  players: ['Léo', 'Thibault'],
  status: 'done',
  kind: 'tournament',
  format: 'round_robin',
  champion: null,
  is_active: false,
  slack_channel: null,
  slack_thread_ts: null,
  result_notified: false,
  unranked: false,
  doubles: false,
  teams: null,
  chaos_enabled: false,
  chaos_interval: 2,
  chaos_intensity: 'full',
  chaos_legendary: true,
  ...overrides,
})

describe('scoped replay', () => {
  const players = [
    getMockPlayer({ id: 'pa', name: 'Léo' }),
    getMockPlayer({ id: 'pb', name: 'Thibault' }),
  ]

  it('starts everyone at 1500 with maximum RD in a new season, ignoring earlier form', () => {
    const autumn = Array.from({ length: 8 }, (_, i) =>
      getMockMatch({ id: `a${i}`, ended_at: at(2026, 9, 1 + i) }),
    )
    const winterOpener = getMockMatch({ id: 'w0', ended_at: at(2026, 11, 3) })
    const winter = replayRatings(matchesInSeason([...autumn, winterOpener], 'hiver-2026'), players)

    expect(winter.events).toHaveLength(2)
    expect(winter.events[0].ratingBefore).toBe(RATING.R0)
    expect(winter.events[0].rdBefore).toBe(RATING.RD0)
    expect([...winter.states.values()].find((s) => s.playerId === 'pa')?.games).toBe(1)
  })

  it('carries no RD decay across the boundary', () => {
    const autumn = getMockMatch({ id: 'a', ended_at: at(2026, 8, 2) })
    const winter = getMockMatch({ id: 'w', ended_at: at(2027, 1, 20) })
    const scoped = replayRatings(matchesInSeason([autumn, winter], 'hiver-2026'), players)
    // Five months of inactivity would have inflated RD had the boundary been crossed.
    expect(scoped.events[0].rdBefore).toBe(RATING.RD0)
  })

  it('excludes an unranked tournament inside the window from season Elo', () => {
    const tournaments = [
      getMockTournament({ id: 't1', unranked: false }),
      getMockTournament({ id: 't2', unranked: true }),
    ]
    const ranked = getMockMatch({ id: 'r', tournament_id: 't1', ended_at: at(2026, 9, 4) })
    const unranked = getMockMatch({ id: 'u', tournament_id: 't2', ended_at: at(2026, 9, 5) })

    // Season window first, then ratedMatches — the order the spec fixes.
    const scoped = ratedMatches(matchesInSeason([ranked, unranked], 'automne-2026'), tournaments)
    expect(scoped.map((m) => m.id)).toEqual(['r'])
    expect(replayRatings(scoped, players).events).toHaveLength(2)
  })

  it('produces a bare ladder when every match in the window is unranked', () => {
    const tournaments = [getMockTournament({ id: 't2', unranked: true })]
    const unranked = getMockMatch({ id: 'u', tournament_id: 't2', ended_at: at(2026, 9, 5) })
    const scoped = ratedMatches(matchesInSeason([unranked], 'automne-2026'), tournaments)
    expect(scoped).toEqual([])
    expect(rankRatings(replayRatings(scoped, players), players)).toEqual([])
  })
})

describe('parseLadderScope', () => {
  const now = new Date(2026, 9, 15)

  it('defaults to the current season', () => {
    expect(parseLadderScope('', now)).toEqual({ kind: 'season', id: 'automne-2026' })
  })

  it('reads an explicit season', () => {
    expect(parseLadderScope('?s=automne-2026', now)).toEqual({
      kind: 'season',
      id: 'automne-2026',
    })
  })

  it('reads all-time', () => {
    expect(parseLadderScope('?s=all', now)).toEqual({ kind: 'all' })
  })

  it('falls back to the current season for an unknown id', () => {
    expect(parseLadderScope('?s=nawak-1999', now)).toEqual({ kind: 'season', id: 'automne-2026' })
  })

  it('falls back to all-time before any season has started', () => {
    expect(parseLadderScope('?s=nawak-1999', new Date(2026, 7, 1))).toEqual({ kind: 'all' })
  })
})

describe('ladderScopeSearch', () => {
  const now = new Date(2026, 9, 15)

  it('writes nothing for the default scope', () => {
    expect(ladderScopeSearch({ kind: 'season', id: 'automne-2026' }, now)).toBe('')
  })

  it('writes a past season and all-time', () => {
    expect(ladderScopeSearch({ kind: 'season', id: 'ete-2027' }, now)).toBe('?s=ete-2027')
    expect(ladderScopeSearch({ kind: 'all' }, now)).toBe('?s=all')
  })

  it('writes nothing for all-time before any season has started', () => {
    expect(ladderScopeSearch({ kind: 'all' }, new Date(2026, 7, 1))).toBe('')
  })

  it('round-trips every scope it writes', () => {
    const scopes: LadderScope[] = [
      { kind: 'season', id: 'automne-2026' },
      { kind: 'season', id: 'ete-2027' },
      { kind: 'all' },
    ]
    for (const scope of scopes) {
      expect(parseLadderScope(ladderScopeSearch(scope, now), now)).toEqual(scope)
    }
  })
})

const getMockIdentityInput = (
  overrides?: Partial<LadderIdentityInput>,
): LadderIdentityInput => ({
  scope: { kind: 'season', id: 'automne-2026' },
  now: new Date(2026, 9, 15),
  matchCount: 24,
  champion: null,
  eligibilityGames: RATING.provisionalGames,
  ...overrides,
})

describe('ladderIdentity', () => {
  it('tells a running season what it is and how long is left', () => {
    expect(ladderIdentity(getMockIdentityInput())).toBe(
      '1 septembre → 30 novembre 2026 · reparti de 1500 · J-47',
    )
  })

  it('says an open season is still empty rather than showing a countdown', () => {
    expect(ladderIdentity(getMockIdentityInput({ matchCount: 0 }))).toBe(
      "1 septembre → 30 novembre 2026 · aucune partie jouée pour l'instant",
    )
  })

  it('names the champion of a closed season', () => {
    const input = getMockIdentityInput({ now: new Date(2026, 11, 20), champion: 'Léo' })
    expect(ladderIdentity(input)).toBe('Archive · 1 septembre → 30 novembre 2026 · champion Léo')
  })

  it('says why a closed season crowned nobody, naming the real gate', () => {
    const input = getMockIdentityInput({ now: new Date(2026, 11, 20), champion: null })
    expect(ladderIdentity(input)).toBe(
      "Archive · 1 septembre → 30 novembre 2026 · aucun champion — personne n'a atteint 10 parties",
    )
  })

  it('does not blame anyone for a closed season nobody played', () => {
    const input = getMockIdentityInput({ now: new Date(2026, 11, 20), matchCount: 0 })
    expect(ladderIdentity(input)).toBe(
      'Archive · 1 septembre → 30 novembre 2026 · aucune partie jouée',
    )
  })

  it('describes the all-time ladder as the one that never resets', () => {
    const input = getMockIdentityInput({ scope: { kind: 'all' }, matchCount: 312 })
    expect(ladderIdentity(input)).toBe(
      'Depuis le tout premier match · 312 parties · aucune remise à zéro',
    )
  })

  it('explains that all-time stands in until the first season opens', () => {
    const input = getMockIdentityInput({ scope: { kind: 'all' }, now: new Date(2026, 5, 1) })
    expect(ladderIdentity(input)).toBe(
      "Aucune saison en cours — le classement de tous les temps fait foi jusqu'au 1er septembre.",
    )
  })

  it('falls back to the all-time sentence for a scope naming no real season', () => {
    const input = getMockIdentityInput({ scope: { kind: 'season', id: 'nawak-1999' } })
    expect(ladderIdentity(input)).toBe(
      'Depuis le tout premier match · 24 parties · aucune remise à zéro',
    )
  })
})

describe('daysLeft across the clock change', () => {
  it('counts calendar days, so the October change does not add a phantom day', () => {
    // 15 Oct → 1 Dec is 47 days; the raw millisecond gap is 47 days and an hour.
    expect(daysLeft(seasonById('automne-2026')!, new Date(2026, 9, 15))).toBe(47)
  })

  it('shows J-1 all through the closing day, whatever the hour', () => {
    const s = seasonById('automne-2026')!
    expect(daysLeft(s, new Date(2026, 10, 30, 0, 1))).toBe(1)
    expect(daysLeft(s, new Date(2026, 10, 30, 23, 59))).toBe(1)
  })
})

describe('ladderScopeSearch before the first season', () => {
  it('still writes a season into the URL when none is running yet', () => {
    // ?s=<future season> is reachable from a shared link: parseLadderScope accepts
    // any well-formed id, started or not.
    expect(ladderScopeSearch({ kind: 'season', id: 'ete-2027' }, new Date(2026, 7, 1))).toBe(
      '?s=ete-2027',
    )
  })
})
