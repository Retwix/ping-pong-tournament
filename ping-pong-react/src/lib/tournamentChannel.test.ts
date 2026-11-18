import { expect, it, vi } from 'vitest'
import { watchTournament } from './tournamentChannel'

type Listener = {
  config: { event: string; table: string; filter?: string }
  deliver: (change: object) => void
}

const listeners = vi.hoisted(() => new Array<Listener>())

vi.mock('./supabase', () => {
  const channel = {
    on: (_type: string, config: Listener['config'], deliver: Listener['deliver']) => {
      listeners.push({ config, deliver })
      return channel
    },
    subscribe: () => channel,
  }
  return { supabase: { channel: () => channel } }
})

const passesFilter = (filter: string | undefined, row: object) => {
  if (!filter) return true
  const [key, value] = filter.split('=eq.')
  return Object.entries(row).some(([k, v]) => k === key && v === value)
}

const filteredListenersNeverHearDeletes = (filter: string | undefined) => filter === undefined

const emit = (change: {
  table: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: object
  old: object
}) =>
  listeners
    .filter(({ config }) => config.table === change.table)
    .filter(({ config }) => config.event === '*' || config.event === change.eventType)
    .filter(({ config }) =>
      change.eventType === 'DELETE'
        ? filteredListenersNeverHearDeletes(config.filter)
        : passesFilter(config.filter, change.new),
    )
    .forEach(({ deliver }) => deliver(change))

it('a game deleted on another device, abandoned at the table, leaves this one too', () => {
  const gone: string[] = []
  watchTournament('t-king', {
    onMatch: () => undefined,
    onMatchGone: (id) => gone.push(id),
    onTournament: () => undefined,
    onSubscribed: () => undefined,
  })

  emit({ table: 'matches', eventType: 'DELETE', new: {}, old: { id: 'm-on' } })

  expect(gone).toEqual(['m-on'])
})
