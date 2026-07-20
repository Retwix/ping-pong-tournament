import { describe, expect, it } from 'vitest'
import {
  areaPath,
  gridValues,
  labelIndices,
  linePath,
  scalePoints,
  yDomain,
} from './ratingLine'

describe('yDomain', () => {
  it('pads beyond the data so the line never touches the edges', () => {
    const d = yDomain([1480, 1520])
    expect(d.min).toBeLessThan(1480)
    expect(d.max).toBeGreaterThan(1520)
  })

  it('stays centered on the data', () => {
    const d = yDomain([1480, 1520])
    expect((d.min + d.max) / 2).toBe(1500)
  })

  it('opens a minimum band around a flat history instead of collapsing', () => {
    const d = yDomain([1500, 1500, 1500])
    expect(d.max - d.min).toBeGreaterThanOrEqual(40)
    expect((d.min + d.max) / 2).toBe(1500)
  })
})

describe('gridValues', () => {
  it('returns round values inside the domain', () => {
    const values = gridValues({ min: 1483, max: 1547 })
    expect(values.length).toBeGreaterThanOrEqual(1)
    expect(values.length).toBeLessThanOrEqual(4)
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(1483)
      expect(v).toBeLessThanOrEqual(1547)
      expect(v % 10).toBe(0)
    }
  })

  it('uses a coarser step for a wide domain', () => {
    const values = gridValues({ min: 1200, max: 1800 })
    for (const v of values) expect(v % 200).toBe(0)
  })
})

describe('scalePoints', () => {
  it('spreads points evenly across the width and maps ratings to y (inverted)', () => {
    const pts = scalePoints([1500, 1550, 1600], { min: 1500, max: 1600 }, 100, 50)
    expect(pts).toEqual([
      { x: 0, y: 50 },
      { x: 50, y: 25 },
      { x: 100, y: 0 },
    ])
  })

  it('centers a single point horizontally', () => {
    expect(scalePoints([1500], { min: 1450, max: 1550 }, 100, 50)).toEqual([{ x: 50, y: 25 }])
  })
})

describe('labelIndices', () => {
  it('returns all indices when there are few points', () => {
    expect(labelIndices(3)).toEqual([0, 1, 2])
  })

  it('picks at most maxLabels indices, always including first and last', () => {
    const idx = labelIndices(20)
    expect(idx.length).toBeLessThanOrEqual(4)
    expect(idx[0]).toBe(0)
    expect(idx[idx.length - 1]).toBe(19)
  })
})

describe('paths', () => {
  const pts = [
    { x: 0, y: 50 },
    { x: 50, y: 25 },
    { x: 100, y: 0 },
  ]

  it('builds an SVG line path through every point', () => {
    expect(linePath(pts)).toBe('M0,50 L50,25 L100,0')
  })

  it('closes the area path down to the baseline', () => {
    expect(areaPath(pts, 50)).toBe('M0,50 L50,25 L100,0 L100,50 L0,50 Z')
  })

  it('returns an empty area path for no points', () => {
    expect(areaPath([], 50)).toBe('')
  })
})
