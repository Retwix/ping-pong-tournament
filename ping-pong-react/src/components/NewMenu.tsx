import { IconChevronDown, IconPlus } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  onNew: () => void
  onNewGame: () => void
  /**
   * Bare "+" trigger with no label/chevron and a dropdown that opens upward —
   * used for the mobile tab bar's center raised button, which sits at the
   * bottom edge of the viewport (a downward menu there would render off-screen).
   */
  compact?: boolean
}

/** "Nouveau" split button: a dropdown to start a quick game or a full tournament. */
export default function NewMenu({ onNew, onNewGame, compact = false }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  const item: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '9px 12px',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    font: 'inherit',
    color: 'var(--ink)',
    cursor: 'pointer',
    borderRadius: 8,
    whiteSpace: 'nowrap',
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        className={compact ? 'rv-tab-plus-btn' : 'btn-primary'}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? 'Nouveau' : undefined}
        style={compact ? undefined : { display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        {compact ? (
          <IconPlus size={26} stroke={2} />
        ) : (
          <>
            + Nouveau
            <IconChevronDown
              size={16}
              stroke={2}
              style={{
                transition: 'transform 150ms',
                transform: open ? 'rotate(180deg)' : 'none',
              }}
            />
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            ...(compact
              ? { bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)' }
              : { top: 'calc(100% + 6px)', right: 0 }),
            zIndex: 30,
            minWidth: 200,
            padding: 6,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <button
            role="menuitem"
            style={item}
            onClick={pick(onNewGame)}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ghost-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            ⚡ Partie rapide
          </button>
          <button
            role="menuitem"
            style={item}
            onClick={pick(onNew)}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ghost-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            🏆 Nouveau tournoi
          </button>
        </div>
      )}
    </div>
  )
}
