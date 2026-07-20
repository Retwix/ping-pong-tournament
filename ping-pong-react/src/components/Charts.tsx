// Lightweight, dependency-free charts — pure CSS/SVG, themed via CSS variables.
import type { DayCount } from '../lib/stats'
import { teamColor } from '../lib/teams'
import {
  areaPath,
  gridValues,
  labelIndices,
  linePath,
  scalePoints,
  yDomain,
} from '../lib/ratingLine'

export interface BarDatum {
  key: string
  name: string
  team: string | null
  value: number // win rate, 0..1
  sub?: string // small caption (e.g. "12 matchs")
}

/** Horizontal win-rate bars — a visual companion to the leaderboard. */
export function WinRateBars({ data }: { data: BarDatum[] }) {
  if (data.length === 0) return null
  return (
    <div className="bars">
      {data.map((d) => {
        const color = teamColor(d.team ?? '')
        return (
          <div className="bar-row" key={d.key}>
            <span className="bar-name" title={d.name}>
              {d.name}
            </span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{ width: `${Math.max(2, d.value * 100)}%`, background: color }}
              />
            </span>
            <span className="bar-val">{Math.round(d.value * 100)}%</span>
          </div>
        )
      })}
    </div>
  )
}

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']

function shortDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS_FR[Number(m) - 1]}`
}

/** Vertical bar chart of matches played per day. Shows at most `max` most-recent days. */
export function ActivityChart({ data, max = 30 }: { data: DayCount[]; max?: number }) {
  if (data.length === 0) return null
  const days = data.slice(-max)
  const peak = Math.max(1, ...days.map((d) => d.count))
  // Label every Nth column to avoid crowding.
  const step = Math.ceil(days.length / 8)
  return (
    <div className="activity-chart">
      <div className="act-plot">
        {days.map((d, i) => (
          <div className="act-col" key={d.date} title={`${shortDay(d.date)} — ${d.count} match${d.count > 1 ? 's' : ''}`}>
            <div className="act-bar" style={{ height: `${(d.count / peak) * 100}%` }}>
              <span className="act-count">{d.count}</span>
            </div>
            <div className="act-x">{i % step === 0 ? shortDay(d.date) : ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface RatingPoint {
  at: string | null
  rating: number
}

const ptLabel = (at: string | null): string => (at ? shortDay(at.slice(0, 10)) : '—')

/** Rating-over-time area chart (chess.com style). Pure SVG, themed via CSS vars. */
export function RatingLine({ points, color }: { points: RatingPoint[]; color: string }) {
  if (points.length === 0) return null
  const W = 560
  const H = 180
  const ratings = points.map((p) => p.rating)
  const dom = yDomain(ratings)
  const pts = scalePoints(ratings, dom, W, H)
  const grid = gridValues(dom)
  const labels = labelIndices(points.length)
  return (
    <div className="rl-wrap">
      <svg className="rl-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Évolution de la note">
        <defs>
          <linearGradient id="rl-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {grid.map((v) => {
          const y = H - ((v - dom.min) / (dom.max - dom.min)) * H
          return (
            <g key={v}>
              <line className="rl-grid" x1={0} x2={W} y1={y} y2={y} />
              <text className="rl-yv" x={4} y={y - 4}>
                {v}
              </text>
            </g>
          )
        })}
        {pts.length >= 2 && <path d={areaPath(pts, H)} fill="url(#rl-fill)" />}
        {pts.length >= 2 && <path className="rl-line" d={linePath(pts)} style={{ stroke: color }} />}
        {pts.map((p, i) => (
          <circle
            key={`${points[i].at ?? 'start'}-${i}`}
            className="rl-dot"
            cx={p.x}
            cy={p.y}
            r={pts.length === 1 ? 5 : 3}
            style={{ fill: color }}
          >
            <title>{`${ptLabel(points[i].at)} · ${Math.round(points[i].rating)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="rl-x">
        {labels.map((i) => (
          <span key={i}>{ptLabel(points[i].at)}</span>
        ))}
      </div>
    </div>
  )
}
