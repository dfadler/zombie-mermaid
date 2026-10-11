import { describe, expect, it } from 'vitest'
import { computeStats, percentile } from '../scripts/bench-mcp.ts'

describe('percentile', () => {
  it('returns 0 for an empty array', () => {
    expect(percentile([], 50)).toBe(0)
  })

  it('returns the single value for a one-element array regardless of p', () => {
    expect(percentile([42], 0)).toBe(42)
    expect(percentile([42], 50)).toBe(42)
    expect(percentile([42], 100)).toBe(42)
  })

  it('returns the minimum at p=0 and the maximum at p=100', () => {
    const sorted = [1, 2, 3, 4, 5]
    expect(percentile(sorted, 0)).toBe(1)
    expect(percentile(sorted, 100)).toBe(5)
  })

  it('picks the expected nearest-rank value for p50/p95 on a 10-element series', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(sorted, 50)).toBe(5)
    expect(percentile(sorted, 95)).toBe(10)
  })
})

describe('computeStats', () => {
  it('returns all-zero stats for an empty input', () => {
    expect(computeStats([])).toEqual({
      callCount: 0,
      totalMs: 0,
      meanMs: 0,
      medianMs: 0,
      p95Ms: 0,
      minMs: 0,
      maxMs: 0,
    })
  })

  it('computes callCount/total/mean/min/max from an unsorted input', () => {
    // Sabotage check: an implementation that forgot to sort before reading
    // min/max (e.g. `timesMs[0]`/`timesMs[length-1]`) would report the
    // input's first/last element instead of the true min/max here.
    const stats = computeStats([5, 1, 4, 2, 3])
    expect(stats.callCount).toBe(5)
    expect(stats.totalMs).toBe(15)
    expect(stats.meanMs).toBe(3)
    expect(stats.minMs).toBe(1)
    expect(stats.maxMs).toBe(5)
  })

  it('does not mutate the input array while sorting', () => {
    const input = [5, 1, 4, 2, 3]
    computeStats(input)
    expect(input).toEqual([5, 1, 4, 2, 3])
  })

  it('reports the same value for median/p95/min/max on a single-element input', () => {
    const stats = computeStats([7])
    expect(stats.medianMs).toBe(7)
    expect(stats.p95Ms).toBe(7)
    expect(stats.minMs).toBe(7)
    expect(stats.maxMs).toBe(7)
  })
})
