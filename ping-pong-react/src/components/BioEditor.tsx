import { IconPencil } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'

/** Your bio on your own card, with the means to change it. */
export default function BioEditor({
  bio,
  onSave,
}: {
  bio: string | null
  onSave: (bio: string | null) => Promise<void>
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    await onSave(draft)
    setDraft(null)
  }

  if (draft === null) {
    return (
      <div className="pm-bio-line">
        {bio && <span className="pm-bio">{bio}</span>}
        <button className="pm-bio-edit" onClick={() => setDraft(bio ?? '')} aria-label="Modifier ma bio">
          <IconPencil size={14} stroke={1.8} />
        </button>
      </div>
    )
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
      <button className="btn-primary" type="submit">
        Enregistrer
      </button>
    </form>
  )
}
