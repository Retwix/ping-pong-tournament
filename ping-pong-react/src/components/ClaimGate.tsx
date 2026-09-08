import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconLogout } from '@tabler/icons-react'
import { claimPlayer, createPlayer, listPlayers } from '../lib/db'
import { claimErrorMessage, claimPrompt, matchPlayer, slackIdentity } from '../lib/slackIdentity'
import type { RosterLoad } from '../lib/slackIdentity'
import ClaimModal from './ClaimModal'

interface Props {
  userId: string
  /** The whole session user — slackIdentity reads `identities`, not metadata. */
  user: unknown
  onSignOut: () => void
}

/**
 * Holds the claim modal open until this account is linked to a roster row.
 *
 * Reads the roster once rather than subscribing: the question it answers —
 * which rows are unclaimed — only matters while the modal is up, and a realtime
 * channel on every page for a one-off decision is not worth its cost.
 *
 * An auto-match preselects a row; it never confirms it. matchPlayer degrades to
 * the plain picker on zero matches or more than one, and a nameless payload —
 * Slack granted only `openid` — preselects nothing at all.
 *
 * Both branches render through a portal, and that is load-bearing rather than
 * tidy. This component sits inside DashboardNav, whose .rv-nav carries
 * backdrop-filter — which makes it the containing block for position: fixed,
 * exactly as filter does. Left in place, `.scrim { position: fixed; inset: 0 }`
 * resolves against the nav bar and measures 1870x63 instead of the viewport, so
 * the modal that is supposed to make linking mandatory covers the header and
 * leaves the whole app underneath live and clickable.
 */
export default function ClaimGate({ userId, user, onSignOut }: Props) {
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

  const { slackUserId, profile } = slackIdentity(user)

  const prompt = claimPrompt(userId, roster)
  if (prompt.kind === 'none') return null

  if (prompt.kind === 'unreadable')
    return createPortal(
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
      </div>,
      document.body,
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
    attempt(() => claimPlayer({ playerId, authUserId: userId, slackUserId }))

  const create = (name: string) =>
    attempt(async () => {
      const player = await createPlayer(name, 'tech')
      await claimPlayer({ playerId: player.id, authUserId: userId, slackUserId })
    })

  const match = profile === null ? null : matchPlayer(profile, prompt.candidates)
  const preselected = match !== null && match.kind === 'matched' ? match.player.id : null

  return createPortal(
    <ClaimModal
      candidates={prompt.candidates}
      preselected={preselected}
      saving={saving}
      error={error}
      onConfirm={confirm}
      onCreate={create}
      onSignOut={onSignOut}
    />,
    document.body,
  )
}
