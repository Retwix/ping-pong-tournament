import { describe, expect, it } from 'vitest'
import type { Player } from '../types'
import { matchPlayer } from './slackIdentity'

function player(over: Partial<Player> & Pick<Player, 'id' | 'name'>): Player {
  return {
    created_at: '2026-01-01T00:00:00Z',
    team: 'tech',
    slack_user_id: null,
    avatar_url: null,
    status: 'active',
    left_at: null,
    ...over,
  }
}

describe('matchPlayer', () => {
  it('picks out the roster entry bearing the name Slack knows the person by', () => {
    const leo = player({ id: 'p2', name: 'Léo' })

    const result = matchPlayer({ displayName: 'Léo' }, [
      player({ id: 'p1', name: 'Thomas' }),
      leo,
    ])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('offers the whole roster to choose from when no name resembles the Slack one', () => {
    const roster = [player({ id: 'p1', name: 'Thomas' }), player({ id: 'p2', name: 'Léo' })]

    const result = matchPlayer({ displayName: 'Inconnue' }, roster)

    expect(result).toEqual({ kind: 'choose', candidates: roster })
  })

  it('refuses to guess when two roster entries answer to the same name', () => {
    const roster = [player({ id: 'p1', name: 'Léo' }), player({ id: 'p2', name: 'Léo' })]

    const result = matchPlayer({ displayName: 'Léo' }, roster)

    expect(result).toEqual({ kind: 'choose', candidates: roster })
  })

  it('matches a roster name that differs only by case and accents', () => {
    const leo = player({ id: 'p2', name: 'Léo' })

    const result = matchPlayer({ displayName: 'LEO' }, [player({ id: 'p1', name: 'Thomas' }), leo])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('matches a roster name saved with stray spaces around it', () => {
    const leo = player({ id: 'p2', name: '  Léo  ' })

    const result = matchPlayer({ displayName: 'Léo' }, [player({ id: 'p1', name: 'Thomas' }), leo])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('matches a roster name split by a doubled space', () => {
    const leo = player({ id: 'p2', name: 'Léo  Martin' })

    const result = matchPlayer({ displayName: 'Léo Martin' }, [
      player({ id: 'p1', name: 'Thomas' }),
      leo,
    ])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('collapses runs of whitespace without deleting the gaps altogether', () => {
    const roster = [player({ id: 'p1', name: 'LéoMartin' })]

    const result = matchPlayer({ displayName: 'Léo Martin' }, roster)

    expect(result).toEqual({ kind: 'choose', candidates: roster })
  })

  it('matches a roster name doubled up at more than one space', () => {
    const leo = player({ id: 'p2', name: 'Léo  Van  Martin' })

    const result = matchPlayer({ displayName: 'Léo Van Martin' }, [
      player({ id: 'p1', name: 'Thomas' }),
      leo,
    ])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('matches a roster name pasted with a non-breaking space', () => {
    const leo = player({ id: 'p2', name: 'L\u00e9o\u00a0Martin' })

    const result = matchPlayer({ displayName: 'Léo Martin' }, [
      player({ id: 'p1', name: 'Thomas' }),
      leo,
    ])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })
})
