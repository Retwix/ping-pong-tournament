import { IconPencil } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { cleanBio } from '../lib/playerBio'

type Save = (bio: string | null) => Promise<void>

function BioForm({ bio, onSave, onClose }: { bio: string | null; onSave: Save; onClose: () => void }) {
  const [draft, setDraft] = useState(bio ?? '')
  const [refused, setRefused] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await onSave(cleanBio(draft))
      onClose()
    } catch {
      setRefused(true)
    }
  }

  return (
    <form className="pm-bio-form" onSubmit={save}>
      <input
        className="pl-finput"
        aria-label="Ma bio"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      {refused && (
        <p className="rv-claim-error" role="alert">
          Bio non enregistrée. Réessaie dans un instant.
        </p>
      )}
      <button className="rv-nav-link rv-nav-auth" type="button" onClick={onClose}>
        Annuler
      </button>
      <button className="btn-primary" type="submit">
        Enregistrer
      </button>
    </form>
  )
}

/** Your bio on your own card, with the means to change it. */
export default function BioEditor({ bio, onSave }: { bio: string | null; onSave: Save }) {
  const [editing, setEditing] = useState(false)

  if (editing) return <BioForm bio={bio} onSave={onSave} onClose={() => setEditing(false)} />

  return (
    <div className="pm-bio-line">
      {bio && <span className="pm-bio">{bio}</span>}
      <button className="pm-bio-edit" onClick={() => setEditing(true)} aria-label="Modifier ma bio">
        <IconPencil size={14} stroke={1.8} />
      </button>
    </div>
  )
}
