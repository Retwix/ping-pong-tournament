// Lightweight, dependency-free charts — pure CSS/SVG, themed via CSS variables.
import type { DayCount } from '../lib/stats'
import { teamColor } from '../lib/teams'

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
