// Charts for the app — the nivo rating line, themed via CSS variables.
import { perDayPoints, type PlayerHistoryMatch } from '../lib/playerHistory'
import { linearGradientDef } from '@nivo/core'
import { ResponsiveLine } from '@nivo/line'
import { useEffect, useState } from 'react'
import { gridValues, labelIndices, yDomain } from '../lib/ratingLine'

const MONTHS_FR = [
  'jan',
  'fév',
  'mar',
  'avr',
  'mai',
  'juin',
  'juil',
  'aoû',
  'sep',
  'oct',
  'nov',
  'déc',
]

function shortDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS_FR[Number(m) - 1]}`
}

export interface RatingPoint {
  at: string | null
  rating: number
  match?: PlayerHistoryMatch
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

type RatingLineMode = 'match' | 'day'

/** Rating-over-time area chart (chess.com style), themed from the CSS variables. */
export function RatingLine({ points, color }: { points: RatingPoint[]; color: string }) {
  const cssVars = useCssVars()
  const [mode, setMode] = useState<RatingLineMode>('match')
  if (points.length === 0) return null
  const shown = mode === 'day' ? perDayPoints(points) : points
  const ratings = shown.map((p) => p.rating)
  const dom = yDomain(ratings)
  const ticks = gridValues(dom)
  const data = [{ id: 'elo', data: shown.map((p, i) => ({ x: i, y: p.rating })) }]
  return (
    <div className="rl-block">
      <div className="rl-toggle" role="tablist" aria-label="Granularité de la courbe">
        <button
          role="tab"
          aria-selected={mode === 'match'}
          className={mode === 'match' ? 'active' : ''}
          onClick={() => setMode('match')}
        >
          Par match
        </button>
        <button
          role="tab"
          aria-selected={mode === 'day'}
          className={mode === 'day' ? 'active' : ''}
          onClick={() => setMode('day')}
        >
          Par jour
        </button>
      </div>
      <div className="rl-nivo" role="img" aria-label="Évolution de la note">
        <ResponsiveLine
          data={data}
          margin={{ top: 10, right: 16, bottom: 28, left: 44 }}
          xScale={{ type: 'linear', min: 0, max: Math.max(1, shown.length - 1) }}
          yScale={{ type: 'linear', min: dom.min, max: dom.max }}
          curve="monotoneX"
          axisBottom={{
            tickSize: 0,
            tickPadding: 10,
            tickValues: labelIndices(shown.length),
            format: (i) => ptLabel(shown[Number(i)]?.at ?? null),
          }}
          axisLeft={{ tickSize: 0, tickPadding: 8, tickValues: ticks }}
          gridYValues={ticks}
          enableGridX={false}
          colors={[color]}
          lineWidth={2.5}
          enablePoints={shown.length === 1}
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
              i > 0 ? Math.round(shown[i].rating) - Math.round(shown[i - 1].rating) : null
            const match = shown[i].match
            return (
              <div className="rl-tip">
                <div className="rl-tip-head">
                  <span className="rl-tip-date">{ptLabel(shown[i].at)}</span>
                  <span className="rl-tip-rating">{Math.round(shown[i].rating)}</span>
                  {delta !== null && delta !== 0 && (
                    <span className={`rt-trend ${delta > 0 ? 'up' : 'down'}`}>
                      {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                    </span>
                  )}
                </div>
                {match && (
                  <div className="rl-tip-match">
                    <span className={`rl-tip-res ${match.won ? 'w' : 'l'}`}>
                      {match.won ? 'V' : 'D'}
                    </span>
                    <span className="rl-tip-score">
                      {match.scoreFor}-{match.scoreAgainst}
                    </span>
                    <span className="rl-tip-opp">vs {match.opponent}</span>
                  </div>
                )}
              </div>
            )
          }}
          theme={nivoTheme(cssVars)}
        />
      </div>
    </div>
  )
}
