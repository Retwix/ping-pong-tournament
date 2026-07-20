import { describe, expect, it } from 'vitest'
import { gridValues, labelIndices, yDomain } from './ratingLine'

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

  it('sizes the padding from the rating swing, not the absolute rating level', () => {
    const low = yDomain([1300, 1500])
    const high = yDomain([1700, 1900])
    expect(high.max - high.min).toBe(low.max - low.min)
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

  it('caps at 4 gridlines even for awkwardly aligned domains', () => {
    const values = gridValues({ min: 1460, max: 1540 })
    expect(values.length).toBeGreaterThanOrEqual(1)
    expect(values.length).toBeLessThanOrEqual(4)
    for (const v of values) expect(v % 10).toBe(0)
  })

  it('only ever returns multiples of 10, never quarter steps like 1525', () => {
    const values = gridValues({ min: 1455, max: 1545 })
    expect(values.length).toBeGreaterThanOrEqual(1)
    expect(values.length).toBeLessThanOrEqual(4)
    for (const v of values) expect(v % 10).toBe(0)
  })

  it('includes the domain max itself when it lands exactly on a round step', () => {
    const values = gridValues({ min: 1500, max: 1600 })
    expect(values).toContain(1600)
  })
})

describe('labelIndices', () => {
  it('returns no labels for zero points', () => {
    expect(labelIndices(0)).toEqual([])
  })

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
