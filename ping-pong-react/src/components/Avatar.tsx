import type { CSSProperties } from 'react'
import { teamColor } from '../lib/teams'

interface Props {
  name: string
  team: string | null
  /** 'sm' = 30px, 'lg' = 44px (default). Use `px` for a custom diameter. */
  size?: 'sm' | 'lg'
  /** Override the diameter in pixels (also scales the initial). */
  px?: number
  className?: string
  style?: CSSProperties
}

/** Coloured initial circle, tinted by the player's team. Shared across views. */
export default function Avatar({ name, team, size = 'lg', px, className, style }: Props) {
  const color = teamColor(team ?? '')
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  const cls = `avatar${size === 'sm' ? ' sm' : ''}${className ? ` ${className}` : ''}`
  const merged: CSSProperties = { background: `${color}24`, color, ...style }
  if (px != null) {
    merged.width = px
    merged.height = px
    merged.fontSize = Math.round(px * 0.4)
  }
  return (
    <span className={cls} style={merged}>
      {initial}
    </span>
  )
}
