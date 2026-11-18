import { useEffect, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { isWorkspaceRefusal, withoutAuthError } from '../lib/authRefusal'
import Brand from './Brand'

export default function WorkspaceRefusal() {
  const [refused, setRefused] = useState(() => isWorkspaceRefusal(window.location.href))

  useEffect(() => {
    if (refused) history.replaceState(history.state, '', withoutAuthError(window.location.href))
  }, [refused])

  if (!refused) return null

  return (
    <div className="error-banner workspace-refusal" role="alert">
      <span>
        Ton espace Slack n'est pas encore sur <Brand org={null} />.
      </span>
      <button className="workspace-refusal-close" aria-label="Fermer" onClick={() => setRefused(false)}>
        <IconX size={16} stroke={2} />
      </button>
    </div>
  )
}
