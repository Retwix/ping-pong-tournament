import { useState } from 'react'
import { IconCalendar, IconChevronDown } from '@tabler/icons-react'
import { isClosed, ladderLabel, type LadderScope, type Season } from '../lib/seasons'

interface Props {
  value: LadderScope
  /** Newest first, from seasonsUpTo(now). */
  seasons: Season[]
  /** Season id → champion name, or null when that season crowned nobody. */
  championById: Map<string, string | null>
  now: Date
  onChange: (scope: LadderScope) => void
}

const championLabel = (name: string | null | undefined): string =>
  name == null ? 'Aucun champion' : `Champion ${name}`

export default function SeasonScope({ value, seasons, championById, now, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const current = seasons.find((s) => !isClosed(s, now)) ?? null
  const past = seasons.filter((s) => isClosed(s, now))
  const selected = value.kind === 'all' ? null : (seasons.find((s) => s.id === value.id) ?? null)

  const badge =
    selected === null
      ? null
      : !isClosed(selected, now)
        ? { text: 'En cours', cls: 'live' }
        : { text: 'Archive', cls: 'archive' }

  const pick = (scope: LadderScope) => {
    onChange(scope)
    setOpen(false)
  }

  return (
    <div className="sn-scope">
      <button className="sn-scope-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <IconCalendar size={16} stroke={1.8} />
        <span className="sn-scope-label">{ladderLabel(selected)}</span>
        {badge && <span className={`sn-scope-badge ${badge.cls}`}>{badge.text}</span>}
        <IconChevronDown size={16} stroke={1.8} />
      </button>

      {open && (
        <>
          <div className="sn-scope-veil" onClick={() => setOpen(false)} />
          <div className="sn-scope-menu" role="listbox">
            {current && (
              <div className="sn-scope-zone">
                <div className="sn-scope-zone-title">Saison en cours</div>
                <button
                  className="sn-scope-item"
                  onClick={() => pick({ kind: 'season', id: current.id })}
                >
                  <span>{current.label}</span>
                </button>
              </div>
            )}

            {past.length > 0 && (
              <div className="sn-scope-zone sn-scope-past">
                <div className="sn-scope-zone-title">Saisons passées</div>
                {past.map((s) => (
                  <button
                    key={s.id}
                    className="sn-scope-item"
                    onClick={() => pick({ kind: 'season', id: s.id })}
                  >
                    <span>{s.label}</span>
                    <span className="sn-scope-champ">{championLabel(championById.get(s.id))}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="sn-scope-zone">
              <button className="sn-scope-item" onClick={() => pick({ kind: 'all' })}>
                <span>{ladderLabel(null)}</span>
                <span className="sn-scope-champ">Depuis le premier match · sans remise à zéro</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
