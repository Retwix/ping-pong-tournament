import { describe, expect, it } from 'vitest'
import type { Player } from '../types'
import {
  claimErrorMessage,
  claimPrompt,
  deleteAttempt,
  matchPlayer,
} from './slackIdentity'

function player(over: Partial<Player> & Pick<Player, 'id' | 'name'>): Player {
  return {
    created_at: '2026-01-01T00:00:00Z',
    team: 'tech',
    slack_user_id: null,
    auth_user_id: null,
    avatar_url: null,
    status: 'active',
    left_at: null,
    ...over,
  }
}

describe('matchPlayer', () => {
  it('picks out the roster entry bearing the name Slack knows the person by', () => {
    const leo = player({ id: 'p2', name: 'Léo' })

    const result = matchPlayer({ displayName: 'Léo', realName: 'Léo' }, [
      player({ id: 'p1', name: 'Thomas' }),
      leo,
    ])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('offers the whole roster to choose from when no name resembles the Slack one', () => {
    const roster = [player({ id: 'p1', name: 'Thomas' }), player({ id: 'p2', name: 'Léo' })]

    const result = matchPlayer({ displayName: 'Inconnue', realName: 'Inconnue' }, roster)

    expect(result).toEqual({ kind: 'choose', candidates: roster })
  })

  it('refuses to guess when two roster entries answer to the same name', () => {
    const roster = [player({ id: 'p1', name: 'Léo' }), player({ id: 'p2', name: 'Léo' })]

    const result = matchPlayer({ displayName: 'Léo', realName: 'Léo' }, roster)

    expect(result).toEqual({ kind: 'choose', candidates: roster })
  })

  it('matches a roster name that differs only by case and accents', () => {
    const leo = player({ id: 'p2', name: 'Léo' })

    const result = matchPlayer({ displayName: 'LEO', realName: 'LEO' }, [player({ id: 'p1', name: 'Thomas' }), leo])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('matches a roster name saved with stray spaces around it', () => {
    const leo = player({ id: 'p2', name: '  Léo  ' })

    const result = matchPlayer({ displayName: 'Léo', realName: 'Léo' }, [player({ id: 'p1', name: 'Thomas' }), leo])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('matches a roster name split by a doubled space', () => {
    const leo = player({ id: 'p2', name: 'Léo  Martin' })

    const result = matchPlayer({ displayName: 'Léo Martin', realName: 'Léo Martin' }, [
      player({ id: 'p1', name: 'Thomas' }),
      leo,
    ])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('collapses runs of whitespace without deleting the gaps altogether', () => {
    const roster = [player({ id: 'p1', name: 'LéoMartin' })]

    const result = matchPlayer({ displayName: 'Léo Martin', realName: 'Léo Martin' }, roster)

    expect(result).toEqual({ kind: 'choose', candidates: roster })
  })

  it('matches a roster name doubled up at more than one space', () => {
    const leo = player({ id: 'p2', name: 'Léo  Van  Martin' })

    const result = matchPlayer({ displayName: 'Léo Van Martin', realName: 'Léo Van Martin' }, [
      player({ id: 'p1', name: 'Thomas' }),
      leo,
    ])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('matches a roster name pasted with a non-breaking space', () => {
    const leo = player({ id: 'p2', name: 'L\u00e9o\u00a0Martin' })

    const result = matchPlayer({ displayName: 'Léo Martin', realName: 'Léo Martin' }, [
      player({ id: 'p1', name: 'Thomas' }),
      leo,
    ])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('never lands on a row another account has already claimed', () => {
    const thomas = player({ id: 'p1', name: 'Thomas' })

    const result = matchPlayer({ displayName: 'Léo', realName: 'Léo' }, [
      player({ id: 'p2', name: 'Léo', auth_user_id: 'u-someone-else' }),
      thomas,
    ])

    expect(result).toEqual({ kind: 'choose', candidates: [thomas] })
  })

  it('matches the roster name when Slack knows it as the real name, not the handle', () => {
    const leo = player({ id: 'p2', name: 'Léo Martin' })

    const result = matchPlayer({ displayName: 'leomartin92', realName: 'Léo Martin' }, [
      player({ id: 'p1', name: 'Thomas' }),
      leo,
    ])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })

  it('matches the roster name when Slack knows it as the display name, not the real one', () => {
    const leo = player({ id: 'p2', name: 'Léo' })

    const result = matchPlayer({ displayName: 'Léo', realName: 'Leonard Martin' }, [
      player({ id: 'p1', name: 'Thomas' }),
      leo,
    ])

    expect(result).toEqual({ kind: 'matched', player: leo })
  })
})

describe('claimErrorMessage', () => {
  it('says the name is taken when the roster already has it', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "players_name_key"',
    }

    expect(claimErrorMessage(error)).toBe('Ce nom est déjà pris dans le classement.')
  })

  it('says the account is already linked when it has claimed a row before', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "players_auth_user_id_key"',
    }

    expect(claimErrorMessage(error)).toBe('Ton compte Slack est déjà lié à un joueur.')
  })

  it('says the row was taken when someone claimed it first', () => {
    const error = { code: 'P0001', message: 'player already claimed' }

    expect(claimErrorMessage(error)).toBe('Quelqu’un vient de prendre cette ligne. Choisis-en une autre.')
  })

  it('falls back to something a person can act on when the cause is unknown', () => {
    expect(claimErrorMessage(new Error('Failed to fetch'))).toBe(
      'La liaison a échoué. Réessaie dans un instant.',
    )
  })

  it('falls back when there is no error object at all', () => {
    expect(claimErrorMessage(null)).toBe('La liaison a échoué. Réessaie dans un instant.')
  })
})

describe('claimPrompt', () => {
  it('says the roster could not be read rather than passing it off as an empty one', () => {
    expect(claimPrompt('u1', { kind: 'unreadable' })).toEqual({ kind: 'unreadable' })
  })

  it('offers the unclaimed rows once the roster has been read', () => {
    const libre = player({ id: 'p2', name: 'Léo' })

    const prompt = claimPrompt('u1', {
      kind: 'loaded',
      players: [player({ id: 'p1', name: 'Thomas', auth_user_id: 'u9' }), libre],
    })

    expect(prompt).toEqual({ kind: 'pick', candidates: [libre] })
  })

  it('offers an empty pick when the roster is read and every row is taken', () => {
    const prompt = claimPrompt('u1', {
      kind: 'loaded',
      players: [player({ id: 'p1', name: 'Thomas', auth_user_id: 'u9' })],
    })

    expect(prompt).toEqual({ kind: 'pick', candidates: [] })
  })

  it('prompts for nothing while the roster is still being read', () => {
    expect(claimPrompt('u1', { kind: 'loading' })).toEqual({ kind: 'none' })
  })

  it('prompts for nothing once this account has claimed a row', () => {
    const prompt = claimPrompt('u1', {
      kind: 'loaded',
      players: [player({ id: 'p1', name: 'Thomas', auth_user_id: 'u1' })],
    })

    expect(prompt).toEqual({ kind: 'none' })
  })
})

describe('deleteAttempt', () => {
  it('offers a signed-out visitor the sign-in, naming what they tried to delete', () => {
    const attempt = deleteAttempt(null, [player({ id: 'p1', name: 'Léo' })], 'un tournoi')

    expect(attempt).toEqual({
      kind: 'ask-sign-in',
      message: 'Seuls les joueurs connectés peuvent supprimer un tournoi. Se connecter avec Slack ?',
    })
  })

  it('names the other thing when that is what was clicked', () => {
    const attempt = deleteAttempt(null, [player({ id: 'p1', name: 'Léo' })], 'un joueur')

    expect(attempt).toEqual({
      kind: 'ask-sign-in',
      message: 'Seuls les joueurs connectés peuvent supprimer un joueur. Se connecter avec Slack ?',
    })
  })

  it('tells a signed-in account that has claimed nobody to finish linking first', () => {
    const attempt = deleteAttempt('u-leo', [player({ id: 'p1', name: 'Léo' })], 'un joueur')

    expect(attempt).toEqual({
      kind: 'explain',
      message:
        'Ton compte Slack n’est pas encore lié à une ligne du classement. Termine la liaison pour pouvoir supprimer.',
    })
  })

  it('lets an account linked to a row go ahead, with nothing to say', () => {
    const roster = [player({ id: 'p1', name: 'Léo', auth_user_id: 'u-leo' })]

    expect(deleteAttempt('u-leo', roster, 'un joueur')).toEqual({ kind: 'proceed' })
  })
})
