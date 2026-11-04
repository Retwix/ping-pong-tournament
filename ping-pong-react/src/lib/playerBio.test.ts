import { describe, expect, it } from 'vitest'
import type { Player } from '../types'
import { cleanBio, playerBio, sideBios } from './playerBio'

function player(over: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    created_at: '2026-01-01T00:00:00Z',
    name: 'Léo',
    team: 'tech',
    slack_user_id: null,
    auth_user_id: null,
    avatar_url: null,
    bio: null,
    status: 'active',
    left_at: null,
    ...over,
  }
}

describe('playerBio', () => {
  it('follows a renamed player by id, whatever name the match recorded', () => {
    const players = [player({ id: 'p1', name: 'Léo Martin', bio: 'Roi du smash' })]

    expect(playerBio(players, 'p1', 'Léo')).toBe('Roi du smash')
  })

  it('finds a legacy side that only has a name', () => {
    const players = [player({ id: 'p1', name: 'Léo', bio: 'Roi du smash' })]

    expect(playerBio(players, null, 'Léo')).toBe('Roi du smash')
  })

  it('does not lend a bio to a namesake when the side has its own id', () => {
    const players = [
      player({ id: 'p1', name: 'Léo', bio: 'Roi du smash' }),
      player({ id: 'p2', name: 'Inès', bio: null }),
    ]

    expect(playerBio(players, 'p2', 'Léo')).toBeNull()
  })

  it('has nothing to say about a name off the roster', () => {
    expect(playerBio([player({ bio: 'Roi du smash' })], null, 'Invité')).toBeNull()
  })
})

describe('sideBios', () => {
  it('reads each side of a match from its own player', () => {
    const players = [
      player({ id: 'p1', name: 'Léo', bio: 'Roi du smash' }),
      player({ id: 'p2', name: 'Inès', bio: 'Revers lifté' }),
    ]

    expect(
      sideBios(players, {
        player_a: 'Léo',
        player_a_id: 'p1',
        player_b: 'Inès',
        player_b_id: 'p2',
      }),
    ).toEqual({ a: 'Roi du smash', b: 'Revers lifté' })
  })
})

describe('cleanBio', () => {
  it('drops the spaces around what was typed', () => {
    expect(cleanBio('  Roi du smash ')).toBe('Roi du smash')
  })

  it('reads a blank bio as no bio', () => {
    expect(cleanBio('   ')).toBeNull()
  })
})
