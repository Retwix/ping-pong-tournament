import { describe, expect, it, test } from 'vitest'
import {
  afterGame,
  crownsWhenAllMatchesDone,
  cardRecap,
  closingCrowns,
  kingRecap,
  longestReign,
  nextGame,
  reignOf,
} from './king'
import type { Match, Tournament, TournamentFormat, TournamentKind } from '../types'

type KingCard = Pick<Tournament, 'id' | 'kind' | 'status'>

describe('nextGame', () => {
  it('puts the first two of the rotation at the table, the challenger serving', () => {
    expect(nextGame(['Inès', 'Sam', 'Léo'])).toEqual({
      player_a: 'Inès',
      player_b: 'Sam',
      serve_start: 'b',
    })
  })
})

describe('afterGame', () => {
  test.for([
    { when: 'the King wins', rotation: ['Inès', 'Sam', 'Léo', 'Zoé'], winner: 'Inès', next: ['Inès', 'Léo', 'Zoé', 'Sam'] },
    { when: 'the challenger wins', rotation: ['Inès', 'Sam', 'Léo', 'Zoé'], winner: 'Sam', next: ['Sam', 'Léo', 'Zoé', 'Inès'] },
    { when: 'two players only', rotation: ['Inès', 'Sam'], winner: 'Sam', next: ['Sam', 'Inès'] },
  ])('$when: the winner stays, the loser goes to the back', ({ rotation, winner, next }) => {
    expect(afterGame(rotation, winner)).toEqual(next)
  })
})

const game = (over: Partial<Match>): Match => ({
  id: `m${over.idx ?? 0}`,
  tournament_id: 't1',
  round: 0,
  idx: 0,
  player_a: 'Inès',
  player_b: 'Sam',
  player_a_id: null,
  player_b_id: null,
  score_a: 7,
  score_b: 4,
  done: true,
  serve_start: 'b',
  started_at: null,
  ended_at: null,
  bracket: null,
  match_key: null,
  win_to: null,
  win_slot: null,
  lose_to: null,
  lose_slot: null,
  bye: false,
  mb_saved_a: 0,
  mb_saved_b: 0,
  ...over,
})

const aWins = (idx: number, a: string, b: string): Match => game({ idx, player_a: a, player_b: b })
const bWins = (idx: number, a: string, b: string): Match =>
  game({ idx, player_a: a, player_b: b, score_a: 5, score_b: 7 })

describe('longestReign', () => {
  test.for([
    {
      when: 'a tie goes to the reign that got there first',
      games: [aWins(0, 'Inès', 'Sam'), aWins(1, 'Inès', 'Léo'), bWins(2, 'Inès', 'Léo'), aWins(3, 'Léo', 'Sam')],
      reign: { player: 'Inès', wins: 2 },
    },
    {
      when: 'a later, longer reign takes the Record',
      games: [aWins(0, 'Inès', 'Sam'), bWins(1, 'Inès', 'Léo'), aWins(2, 'Léo', 'Sam'), aWins(3, 'Léo', 'Inès')],
      reign: { player: 'Léo', wins: 3 },
    },
    {
      when: 'games arrive out of order',
      games: [aWins(3, 'Léo', 'Sam'), aWins(0, 'Inès', 'Sam'), aWins(2, 'Léo', 'Inès'), bWins(1, 'Inès', 'Léo')],
      reign: { player: 'Léo', wins: 3 },
    },
    {
      when: 'the game in progress has not counted yet',
      games: [aWins(0, 'Inès', 'Sam'), { ...aWins(1, 'Inès', 'Léo'), done: false, score_a: 5, score_b: 3 }],
      reign: { player: 'Inès', wins: 1 },
    },
  ])('$when', ({ games, reign }) => {
    expect(longestReign(games)).toEqual(reign)
  })

  it('has no reign before the first game is validated', () => {
    expect(longestReign([{ ...aWins(0, 'Inès', 'Sam'), done: false }])).toBeNull()
  })
})

describe('reignOf', () => {
  test.for([
    { when: 'a King who won the last two', games: [aWins(0, 'Inès', 'Sam'), bWins(1, 'Inès', 'Sam'), aWins(2, 'Sam', 'Léo')], king: 'Sam', wins: 2 },
    { when: 'the first King, before any game', games: [], king: 'Inès', wins: 0 },
    { when: 'a challenger left holding the table', games: [aWins(0, 'Inès', 'Sam')], king: 'Léo', wins: 0 },
  ])('$when: règne $wins', ({ games, king, wins }) => {
    expect(reignOf(games, king)).toBe(wins)
  })
})

describe('crownsWhenAllMatchesDone', () => {
  test.for<{ kind: TournamentKind; format: TournamentFormat; crowns: boolean }>([
    { kind: 'tournament', format: 'round_robin', crowns: true },
    { kind: 'tournament', format: 'double_elim', crowns: false },
    { kind: 'king', format: 'round_robin', crowns: false },
  ])('a $format $kind crowns itself once every match is done: $crowns', ({ kind, format, crowns }) => {
    expect(crownsWhenAllMatchesDone({ kind, format })).toBe(crowns)
  })
})

describe('kingRecap', () => {
  test.for([
    {
      when: 'Inès reigned 3 over 5 games',
      games: [bWins(0, 'Sam', 'Inès'), aWins(1, 'Inès', 'Léo'), aWins(2, 'Inès', 'Sam'), bWins(3, 'Inès', 'Léo'), aWins(4, 'Léo', 'Sam')],
      recap: "Inès 👑 3 victoires d'affilée · 5 parties",
    },
    {
      when: 'one game played, another left unfinished',
      games: [aWins(0, 'Sam', 'Inès'), { ...aWins(1, 'Sam', 'Léo'), done: false }],
      recap: "Sam 👑 1 victoire d'affilée · 1 partie",
    },
  ])('$when', ({ games, recap }) => {
    expect(kingRecap(games)).toBe(recap)
  })

  it('has nothing to say before a game is played', () => {
    expect(kingRecap([])).toBeNull()
  })
})

describe('cardRecap', () => {
  const session = (over?: Partial<KingCard>): KingCard => ({ id: 't1', kind: 'king', status: 'done', ...over })
  const games = [aWins(0, 'Inès', 'Sam'), { ...aWins(1, 'Léo', 'Sam'), tournament_id: 't2' }]

  it("recaps a finished session from its own games only", () => {
    expect(cardRecap(session(), games)).toBe("Inès 👑 1 victoire d'affilée · 1 partie")
  })

  test.for([
    { when: 'a session still running', t: session({ status: 'active' }) },
    { when: 'a quick game', t: session({ kind: 'game' }) },
  ])('has none for $when', ({ t }) => {
    expect(cardRecap(t, games)).toBeNull()
  })
})

describe('closingCrowns', () => {
  it('crowns each open session from its own validated games, nobody when it has none', () => {
    const games = [
      aWins(0, 'Inès', 'Sam'),
      { ...aWins(0, 'Léo', 'Sam'), tournament_id: 't2' },
      { ...aWins(1, 'Léo', 'Inès'), tournament_id: 't2' },
      { ...aWins(0, 'Zoé', 'Sam'), tournament_id: 't3', done: false },
    ]

    expect(closingCrowns(['t1', 't2', 't3'], games)).toEqual([
      { id: 't1', champion: 'Inès' },
      { id: 't2', champion: 'Léo' },
      { id: 't3', champion: null },
    ])
  })
})
