import { useState } from 'react'
import { IconLogout } from '@tabler/icons-react'
import type { Player } from '../types'

interface Props {
  candidates: Player[]
  /** The auto-matched row, preselected for confirmation — never committed on its own. */
  preselected: string | null
  saving: boolean
  onConfirm: (playerId: string) => void
  onSignOut: () => void
}

/**
 * « Qui es-tu ? » — links a signed-in Slack account to a roster row.
 *
 * Linking is not optional. Signing in and staying unlinked is the state where
 * the app looks broken: the delete policies require a claimed row, and a delete
 * they refuse affects zero rows without raising, so nothing visibly happens.
 * There is no "later" — the way out is to sign out again.
 *
 * A match on the Slack name preselects, it never confirms. Auto-matching is a
 * guess about which human this is, and the person is the only one who can
 * settle that; the picker stays open with their name already highlighted.
 *
 * Only unclaimed rows are ever passed in, and the database refuses a claim on a
 * taken row regardless.
 */
export default function ClaimModal({
  candidates,
  preselected,
  saving,
  onConfirm,
  onSignOut,
}: Props) {
  const [selected, setSelected] = useState<string | null>(preselected)

  return (
    <div className="scrim">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Lier ton compte Slack">
        <h2>Qui es-tu ?</h2>
        <p className="modal-hint">
          Choisis ta ligne dans le classement pour lier ton compte Slack. Une seule fois.
        </p>
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
        <div className="modal-actions rv-claim-actions">
          <button className="rv-nav-link rv-nav-auth" onClick={onSignOut} disabled={saving}>
            <IconLogout size={16} stroke={1.8} /> Se déconnecter
          </button>
          <button
            className="btn-primary"
            disabled={saving || selected === null}
            onClick={() => selected !== null && onConfirm(selected)}
          >
            {saving ? 'Liaison…' : 'C’est moi'}
          </button>
        </div>
      </div>
    </div>
  )
}
