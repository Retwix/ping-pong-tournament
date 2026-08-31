import { useEffect } from 'react'
import { IconX } from '@tabler/icons-react'
import type { Player } from '../types'

interface Props {
  candidates: Player[]
  saving: boolean
  onPick: (playerId: string) => void
  onClose: () => void
}

/**
 * « Qui es-tu ? » — links a signed-in Slack account to a roster row.
 *
 * The picker only. The spec also wants an auto-matched name to confirm first;
 * matchPlayer is written and tested and waits solely on the identity payload
 * being confirmed. Picking works without it, so it ships first.
 *
 * Only unclaimed rows are ever passed in: a row someone else has taken is not a
 * candidate, and the database refuses the claim regardless.
 */
export default function ClaimModal({ candidates, saving, onPick, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" role="dialog" aria-label="Lier ton compte Slack">
        <h2>Qui es-tu ?</h2>
        <p className="modal-hint">
          Choisis ta ligne dans le classement pour lier ton compte Slack. Une seule fois.
        </p>
        <div className="rv-claim-list">
          {candidates.map((p) => (
            <button
              key={p.id}
              className="rv-claim-option"
              disabled={saving}
              onClick={() => onPick(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="rv-nav-link" onClick={onClose} disabled={saving}>
            <IconX size={16} stroke={2} /> Plus tard
          </button>
        </div>
      </div>
    </div>
  )
}
