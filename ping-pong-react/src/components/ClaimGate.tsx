import { useCallback, useEffect, useState } from 'react'
import { claimPlayer, listPlayers } from '../lib/db'
import { linkedPlayer } from '../lib/slackIdentity'
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

  const confirm = async (playerId: string) => {
    setSaving(true)
    try {
      await claimPlayer({ playerId, authUserId: userId, slackUserId: null })
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <ClaimModal
      candidates={players.filter((p) => p.auth_user_id === null)}
      preselected={null}
      saving={saving}
      onConfirm={confirm}
      onSignOut={onSignOut}
    />
  )
}
