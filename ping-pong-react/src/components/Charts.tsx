// Charts for the app — hand-rolled CSS/SVG plus the nivo rating line, themed via CSS variables.
import type { DayCount } from '../lib/stats'
import { teamColor } from '../lib/teams'
import { linearGradientDef } from '@nivo/core'
import { ResponsiveLine } from '@nivo/line'
import { useEffect, useState } from 'react'
import { gridValues, labelIndices, yDomain } from '../lib/ratingLine'

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

const THEME_VARS = ['--fg-1', '--fg-3', '--border', '--surface'] as const

function readCssVars(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement)
  return Object.fromEntries(THEME_VARS.map((n) => [n, cs.getPropertyValue(n).trim()]))
}

/** Current values of the theme CSS variables, refreshed when data-theme flips. */
function useCssVars(): Record<string, string> {
  const [vars, setVars] = useState(readCssVars)
  useEffect(() => {
    const observer = new MutationObserver(() => setVars(readCssVars()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])
  return vars
}

const nivoTheme = (v: Record<string, string>) => ({
  axis: { ticks: { text: { fill: v['--fg-3'], fontSize: 11 } } },
  grid: { line: { stroke: v['--border'], strokeWidth: 1 } },
  crosshair: { line: { stroke: v['--fg-3'], strokeWidth: 1, strokeOpacity: 0.5 } },
})

/** Rating-over-time area chart (chess.com style), themed from the CSS variables. */
export function RatingLine({ points, color }: { points: RatingPoint[]; color: string }) {
  const cssVars = useCssVars()
  if (points.length === 0) return null
  const ratings = points.map((p) => p.rating)
  const dom = yDomain(ratings)
  const ticks = gridValues(dom)
  const data = [
    { id: 'elo', data: points.map((p, i) => ({ x: i, y: p.rating })) },
  ]
  return (
    <div className="rl-nivo" role="img" aria-label="Évolution de la note">
      <ResponsiveLine
        data={data}
        margin={{ top: 10, right: 16, bottom: 28, left: 44 }}
        xScale={{ type: 'linear', min: 0, max: Math.max(1, points.length - 1) }}
        yScale={{ type: 'linear', min: dom.min, max: dom.max }}
        curve="monotoneX"
        axisBottom={{
          tickSize: 0,
          tickPadding: 10,
          tickValues: labelIndices(points.length),
          format: (i) => ptLabel(points[Number(i)]?.at ?? null),
        }}
        axisLeft={{ tickSize: 0, tickPadding: 8, tickValues: ticks }}
        gridYValues={ticks}
        enableGridX={false}
        colors={[color]}
        lineWidth={2.5}
        enablePoints={points.length === 1}
        pointSize={9}
        enableArea
        defs={[
          linearGradientDef('rlFill', [
            { offset: 0, color, opacity: 0.28 },
            { offset: 100, color, opacity: 0.02 },
          ]),
        ]}
        fill={[{ match: '*', id: 'rlFill' }]}
        useMesh
        enableCrosshair
        crosshairType="x"
        animate={false}
        tooltip={({ point }) => {
          const i = Number(point.data.x)
          const delta =
            i > 0 ? Math.round(points[i].rating) - Math.round(points[i - 1].rating) : null
          return (
            <div className="rl-tip">
              <span className="rl-tip-date">{ptLabel(points[i].at)}</span>
              <span className="rl-tip-rating">{Math.round(points[i].rating)}</span>
              {delta !== null && delta !== 0 && (
                <span className={`rt-trend ${delta > 0 ? 'up' : 'down'}`}>
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                </span>
              )}
            </div>
          )
        }}
        theme={nivoTheme(cssVars)}
      />
    </div>
  )
}
