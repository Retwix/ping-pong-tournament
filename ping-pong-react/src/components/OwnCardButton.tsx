import { IconUserCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PlayerHistory } from '../lib/playerHistory'
import type { RatingRow } from '../lib/rating'
import PlayerModal from './PlayerModal'

/**
 * Your name in the top bar, opening your own player card.
 *
 * The card is portalled to <body>: `.rv-nav` has a backdrop-filter, which
 * makes it the containing block for fixed descendants, so a scrim rendered
 * in place would cover the bar and leave the page clickable beneath it.
 */
export default function OwnCardButton({
  row,
  history,
  onSignOut,
}: {
  row: RatingRow
  history: PlayerHistory | null
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="rv-nav-link rv-nav-auth"
        onClick={() => setOpen(true)}
        aria-label={`Ma fiche (${row.name})`}
        title="Ma fiche"
      >
        <IconUserCircle size={16} stroke={1.8} />
        <span className="rv-nav-auth-label">{row.name}</span>
      </button>
      {open &&
        createPortal(
          <PlayerModal row={row} history={history} onClose={() => setOpen(false)} onSignOut={onSignOut} />,
          document.body,
        )}
    </>
  )
}
