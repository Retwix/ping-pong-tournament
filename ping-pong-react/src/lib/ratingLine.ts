// Pure scale/tick logic for the rating-history line chart. No I/O, no React.

export interface YDomain {
  min: number
  max: number
}

const MIN_SPAN = 40
const PAD = 1.3
const GRID_STEPS = [10, 20, 50, 100, 200, 500]

/** Padded y-domain centered on the data; flat histories get a minimum band. */
export function yDomain(ratings: number[]): YDomain {
  const lo = Math.min(...ratings)
  const hi = Math.max(...ratings)
  const mid = (lo + hi) / 2
  const half = Math.max((hi - lo) / 2, MIN_SPAN / 2) * PAD
  return { min: mid - half, max: mid + half }
}

/** 1–4 round gridline values (multiples of 10), at the finest step that fits. */
export function gridValues(dom: YDomain): number[] {
  for (const step of GRID_STEPS) {
    const values = multiplesWithin(dom, step)
    if (values.length <= 4) return values
  }
  return multiplesWithin(dom, 1000)
}

function multiplesWithin(dom: YDomain, step: number): number[] {
  const first = Math.ceil(dom.min / step) * step
  const out: number[] = []
  for (let v = first; v <= dom.max; v += step) out.push(v)
  return out
}

/** Up to `maxLabels` x-label positions, endpoints always included. */
export function labelIndices(n: number, maxLabels = 4): number[] {
  if (n <= maxLabels) return Array.from({ length: n }, (_, i) => i)
  const picked = Array.from({ length: maxLabels }, (_, k) =>
    Math.round((k * (n - 1)) / (maxLabels - 1)),
  )
  return [...new Set(picked)]
}
