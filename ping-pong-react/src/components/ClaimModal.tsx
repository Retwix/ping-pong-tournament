import { useState } from 'react'
import { IconLogout } from '@tabler/icons-react'
import type { Player } from '../types'

interface Props {
  candidates: Player[]
  /** The auto-matched row, preselected for confirmation — never committed on its own. */
  preselected: string | null
  saving: boolean
  error: string | null
  onConfirm: (playerId: string) => void
  onCreate: (name: string) => void
  onSignOut: () => void
}

/**
 * « Qui es-tu ? » — links a signed-in Slack account to a roster row.
 *
 * Linking is not optional. Signing in and staying unlinked is the state where
 * the app looks broken: the delete policies require a claimed row, and a delete
 * they refuse affects zero rows without raising, so nothing visibly happens.
 *
 * A match on the Slack name preselects, it never confirms. Auto-matching is a
 * guess about which human this is, and only that human can settle it.
 *
 * Someone new to the ladder creates their row here instead of being turned
 * away. Making linking mandatory closed the door they would otherwise use —
 * adding players is open to everyone, but not from behind this modal.
 */
export default function ClaimModal({
  candidates,
  preselected,
  saving,
  error,
  onConfirm,
  onCreate,
  onSignOut,
}: Props) {
  const [selected, setSelected] = useState<string | null>(preselected)
  const [newcomer, setNewcomer] = useState(candidates.length === 0)
  const [name, setName] = useState('')

  const ready = newcomer ? name.trim() !== '' : selected !== null
  const submit = () => {
    if (newcomer) onCreate(name.trim())
    else if (selected !== null) onConfirm(selected)
  }

  return (
    <div className="scrim">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Lier ton compte Slack">
        <h2>Qui es-tu ?</h2>
        <p className="modal-hint">
          {newcomer
            ? 'Ton nom rejoint le classement et ton compte Slack y est lié.'
            : 'Choisis ta ligne dans le classement pour lier ton compte Slack. Une seule fois.'}
        </p>

        {newcomer ? (
          <div className="pl-field">
            <div className="pl-flabel">Nom</div>
            <input
              className="pl-finput"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ready && !saving && submit()}
              placeholder="Prénom ou pseudo"
              maxLength={40}
            />
          </div>
        ) : (
          <div className="rv-claim-list" role="radiogroup" aria-label="Joueurs disponibles">
            {candidates.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected === p.id}
                className={`rv-claim-option${selected === p.id ? ' selected' : ''}`}
                disabled={saving}
                onClick={() => setSelected(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {candidates.length > 0 && (
          <button className="rv-claim-switch" disabled={saving} onClick={() => setNewcomer(!newcomer)}>
            {newcomer ? '← Choisir dans la liste' : 'Je ne suis pas dans la liste'}
          </button>
        )}

        {error !== null && <p className="rv-claim-error">{error}</p>}

        <div className="modal-actions rv-claim-actions">
          <button className="rv-nav-link rv-nav-auth" onClick={onSignOut} disabled={saving}>
            <IconLogout size={16} stroke={1.8} /> Se déconnecter
          </button>
          <button className="btn-primary" disabled={saving || !ready} onClick={submit}>
            {saving ? 'Liaison…' : newcomer ? 'Créer et lier' : 'C’est moi'}
          </button>
        </div>
      </div>
    </div>
  )
}
