import { IconArrowLeft } from '@tabler/icons-react'

/** Small back link pinned at the top of a page, above the header. */
export default function TopBack({
  onClick,
  label = 'Accueil',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button type="button" className="link-btn page-back" onClick={onClick}>
      <IconArrowLeft size={16} stroke={1.8} /> {label}
    </button>
  )
}
