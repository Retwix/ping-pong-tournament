import type { Player } from '../types'
import { fold } from './fold'

/** What Slack tells us about the person signing in, narrowed to what we match a roster row on. */
export interface SlackProfile {
  displayName: string
  realName: string
}

/** Roster names are typed by hand, so compare them past case, accents and stray padding. */
const canonical = (name: string): string => fold(name).trim().replace(/\s+/g, ' ')

/** The rows still up for grabs — no account has linked itself to them. */
const unclaimed = (players: Player[]): Player[] => players.filter((p) => p.auth_user_id === null)

/**
 * Either the one roster row this Slack account belongs to, or the roster itself
 * for the person to pick from. A wrong confident match is worse than no match,
 * so anything short of a single hit degrades to the picker.
 */
export type PlayerMatch =
  | { kind: 'matched'; player: Player }
  | { kind: 'choose'; candidates: Player[] }

export function matchPlayer(profile: SlackProfile, players: Player[]): PlayerMatch {
  const free = unclaimed(players)
  const wanted = [canonical(profile.displayName), canonical(profile.realName)]
  const matches = free.filter((p) => wanted.includes(canonical(p.name)))
  if (matches.length !== 1) return { kind: 'choose', candidates: free }
  return { kind: 'matched', player: matches[0] }
}

/**
 * The roster row a signed-in account has claimed, or null when it has claimed
 * none. Being linked — not merely being signed in — is what the delete policies
 * require, so this is what the UI must gate the delete buttons on.
 *
 * Unlike matchPlayer, this may take the first hit: players_auth_user_id_key
 * makes auth_user_id unique among claimed rows, so there is never a second one
 * to choose between.
 */
export function linkedPlayer(userId: string, players: Player[]): Player | null {
  return players.find((p) => p.auth_user_id === userId) ?? null
}

/**
 * What a guarded delete button should do next. Three states, not two: being
 * signed in is not the same as being allowed, because the delete policies
 * require a claimed row rather than a session.
 *
 * The distinction has to live in the UI, because Postgres will not raise. A
 * delete refused by RLS affects zero rows and returns no error, so a button
 * that offers to delete when the account is unlinked appears to do nothing at
 * all.
 */
export type DeleteAction = 'sign-in' | 'claim' | 'delete'

export function deleteAction(userId: string | null, players: Player[]): DeleteAction {
  if (userId === null) return 'sign-in'
  return linkedPlayer(userId, players) === null ? 'claim' : 'delete'
}

/**
 * Shown when a guarded delete is clicked by an account that has claimed no row.
 *
 * Reachable despite ClaimGate blocking the page: while the roster is still
 * loading the gate shows nothing, so the delete buttons are live and this is
 * the state behind them.
 */
export const CLAIM_REQUIRED_TO_DELETE =
  'Ton compte Slack n’est pas encore lié à une ligne du classement. Termine la liaison pour pouvoir supprimer.'

const GENERIC_CLAIM_FAILURE = 'La liaison a échoué. Réessaie dans un instant.'

/**
 * What to tell someone whose claim just failed.
 *
 * Postgres is the only thing enforcing these rules, so its errors are the only
 * signal there is — but its wording is English, mentions constraint names, and
 * says nothing about what to do next. Each case here is a rule from
 * auth-migration.sql: the two unique indexes, and the claim trigger.
 *
 * Anything unrecognised falls back rather than leaking raw database text into a
 * modal the person cannot dismiss.
 */
export function claimErrorMessage(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : ''

  if (message.includes('players_name_key')) return 'Ce nom est déjà pris dans le classement.'
  if (message.includes('players_auth_user_id_key'))
    return 'Ton compte Slack est déjà lié à un joueur.'
  if (message.includes('player already claimed'))
    return 'Quelqu’un vient de prendre cette ligne. Choisis-en une autre.'
  return GENERIC_CLAIM_FAILURE
}

/** Reading the roster has three outcomes, and an unreadable one is not an empty one. */
export type RosterLoad =
  | { kind: 'loading' }
  | { kind: 'unreadable' }
  | { kind: 'loaded'; players: Player[] }

/** What the claim gate should put in front of a signed-in account. */
export type ClaimPrompt =
  | { kind: 'none' }
  | { kind: 'unreadable' }
  | { kind: 'pick'; candidates: Player[] }

/**
 * Which prompt a signed-in account is owed.
 *
 * A roster we failed to read must not collapse into 'pick' with no candidates:
 * that is the shape of a ladder where every row is taken, and the modal answers
 * it by offering to create a new row. Someone whose row exists but could not be
 * fetched would be walked into a duplicate — and players.name is unique, so it
 * fails at the very end, after they have typed their name.
 */
export function claimPrompt(userId: string, roster: RosterLoad): ClaimPrompt {
  if (roster.kind === 'loading') return { kind: 'none' }
  if (roster.kind === 'unreadable') return { kind: 'unreadable' }
  if (linkedPlayer(userId, roster.players) !== null) return { kind: 'none' }
  return { kind: 'pick', candidates: unclaimed(roster.players) }
}
