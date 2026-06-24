import { useCallback, useMemo } from 'react'
import { usePlayers } from './usePlayers'

/**
 * Resolves a player's photo URL from the live registry. Matches store players by
 * id (rename-proof) and by name snapshot, so we look up by id first and fall
 * back to name. Returns null when the player has no photo.
 */
export function useAvatars() {
  const { players } = usePlayers()

  const byId = useMemo(
    () => new Map(players.map((p) => [p.id, p.avatar_url ?? null])),
    [players]
  )
  const byName = useMemo(
    () => new Map(players.map((p) => [p.name, p.avatar_url ?? null])),
    [players]
  )

  const avatarOf = useCallback(
    (id: string | null | undefined, name: string | null | undefined): string | null => {
      if (id && byId.has(id)) return byId.get(id) ?? null
      if (name && byName.has(name)) return byName.get(name) ?? null
      return null
    },
    [byId, byName]
  )

  return { avatarOf }
}
