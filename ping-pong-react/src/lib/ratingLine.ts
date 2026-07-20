// Pure geometry for the rating-history SVG line chart. No I/O, no React.

export interface XY {
  x: number
  y: number
}

export interface YDomain {
  min: number
  max: number
}

const MIN_SPAN = 40
const PAD = 1.3
const GRID_STEPS = [10, 20, 25, 50, 100, 200, 500]

/** Padded y-domain centered on the data; flat histories get a minimum band. */
export function yDomain(ratings: number[]): YDomain {
  const lo = Math.min(...ratings)
  const hi = Math.max(...ratings)
  const mid = (lo + hi) / 2
  const half = Math.max((hi - lo) / 2, MIN_SPAN / 2) * PAD
  return { min: mid - half, max: mid + half }
}

/** 1–4 round gridline values inside the domain, at the finest step that fits. */
export function gridValues(dom: YDomain): number[] {
  const span = dom.max - dom.min
  const step = GRID_STEPS.find((s) => span / s <= 4) ?? 1000
  const first = Math.ceil(dom.min / step) * step
  const out: number[] = []
  for (let v = first; v <= dom.max; v += step) out.push(v)
  return out
}

/** Even x-spacing, y linear in the domain (SVG y grows downward). */
export function scalePoints(
  ratings: number[],
  dom: YDomain,
  width: number,
  height: number,
): XY[] {
  const n = ratings.length
  return ratings.map((r, i) => ({
    x: n === 1 ? width / 2 : (i / (n - 1)) * width,
    y: height - ((r - dom.min) / (dom.max - dom.min)) * height,
  }))
}

/** Up to `maxLabels` x-label positions, endpoints always included. */
export function labelIndices(n: number, maxLabels = 4): number[] {
  if (n <= maxLabels) return Array.from({ length: n }, (_, i) => i)
  const picked = Array.from({ length: maxLabels }, (_, k) =>
    Math.round((k * (n - 1)) / (maxLabels - 1)),
  )
  return [...new Set(picked)]
}

const fmt = (v: number): string => String(Math.round(v * 10) / 10)

/** SVG path through every point: "M… L… L…". */
export function linePath(pts: XY[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)},${fmt(p.y)}`).join(' ')
}

/** Line path closed down to the baseline, for the gradient fill. */
export function areaPath(pts: XY[], height: number): string {
  if (pts.length === 0) return ''
  const first = pts[0]
  const last = pts[pts.length - 1]
  return `${linePath(pts)} L${fmt(last.x)},${fmt(height)} L${fmt(first.x)},${fmt(height)} Z`
}
