import { useCallback, useEffect, useState } from 'react'
import { claimPlayer, createPlayer, listPlayers } from '../lib/db'
import { claimErrorMessage, linkedPlayer } from '../lib/slackIdentity'
import type { Player } from '../types'
import ClaimModal from './ClaimModal'

interface Props {
  userId: string
  onSignOut: () => void
}

/**
 * Holds the claim modal open until this account is linked to a roster row.
 *
 * Reads the roster once rather than subscribing: the question it answers —
 * which rows are unclaimed — only matters while the modal is up, and a realtime
 * channel on every page for a one-off decision is not worth its cost.
 *
 * `preselected` is null until the Slack identity payload is confirmed. Once it
 * is, matchPlayer supplies the id here and the row arrives highlighted.
 */
export default function ClaimGate({ userId, onSignOut }: Props) {
  const [players, setPlayers] = useState<Player[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    listPlayers()
      .then(setPlayers)
      .catch((e) => {
        // Not silent: an unreadable roster still has to show the modal, or a
        // signed-in person is left with no prompt and no way to link at all.
        console.error('Chargement du classement impossible', e)
        setPlayers([])
      })
  }, [])

  useEffect(load, [load])

  if (players === null || linkedPlayer(userId, players) !== null) return null

  // A claim can genuinely fail: the trigger rejects a row taken between the
  // read and the click, and players.name is unique, so a newcomer's name may
  // collide with someone already on the ladder. Both must be said out loud —
  // this modal is the only thing standing between them and the app.
  const attempt = async (run: () => Promise<void>) => {
    setSaving(true)
    setError(null)
    try {
      await run()
      load()
    } catch (e) {
      setError(claimErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const confirm = (playerId: string) =>
    attempt(() => claimPlayer({ playerId, authUserId: userId, slackUserId: null }))

  const create = (name: string) =>
    attempt(async () => {
      const player = await createPlayer(name, 'tech')
      await claimPlayer({ playerId: player.id, authUserId: userId, slackUserId: null })
    })

  return (
    <ClaimModal
      candidates={players.filter((p) => p.auth_user_id === null)}
      preselected={null}
      saving={saving}
      error={error}
      onConfirm={confirm}
      onCreate={create}
      onSignOut={onSignOut}
    />
  )
}
