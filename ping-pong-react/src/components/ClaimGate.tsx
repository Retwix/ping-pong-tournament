import { useCallback, useEffect, useState } from 'react'
import { IconLogout } from '@tabler/icons-react'
import { claimPlayer, createPlayer, listPlayers } from '../lib/db'
import { claimErrorMessage, claimPrompt } from '../lib/slackIdentity'
import type { RosterLoad } from '../lib/slackIdentity'
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
  const [roster, setRoster] = useState<RosterLoad>({ kind: 'loading' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    listPlayers()
      .then((players) => setRoster({ kind: 'loaded', players }))
      .catch((e) => {
        console.error('Chargement du classement impossible', e)
        setRoster({ kind: 'unreadable' })
      })
  }, [])

  useEffect(load, [load])

  const prompt = claimPrompt(userId, roster)
  if (prompt.kind === 'none') return null

  if (prompt.kind === 'unreadable')
    return (
      <div className="scrim">
        <div className="modal" role="dialog" aria-modal="true" aria-label="Classement indisponible">
          <h2>Classement indisponible</h2>
          <p className="modal-hint">
            Impossible de lire le classement pour l’instant. Ta ligne y est peut-être déjà : réessaie
            plutôt que d’en créer une seconde.
          </p>
          <div className="modal-actions rv-claim-actions">
            <button className="rv-nav-link rv-nav-auth" onClick={onSignOut}>
              <IconLogout size={16} stroke={1.8} /> Se déconnecter
            </button>
            <button className="btn-primary" onClick={load}>
              Réessayer
            </button>
          </div>
        </div>
      </div>
    )

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
      candidates={prompt.candidates}
      preselected={null}
      saving={saving}
      error={error}
      onConfirm={confirm}
      onCreate={create}
      onSignOut={onSignOut}
    />
  )
}
