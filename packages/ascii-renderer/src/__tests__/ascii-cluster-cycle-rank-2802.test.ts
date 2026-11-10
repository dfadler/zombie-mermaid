/**
 * A cycle through a cluster boundary (`S --> X --> B`, B inside S) ranks
 * differently by declaration order, in mermaid@12.3.0 too (#2802, #2800).
 * Measured headless (node y; 12.3.0 and the 12.2.0 pin agree):
 *
 *   R, T:  R 36  T 124  X 124  A 273  B 381   X beside T, above A
 *   T, R:  T 36  A 185  B 293  R 317  X 405   X below B
 *
 * The two orders are not meant to rank alike. With ELK hints (what the CLI and
 * root entry use) both match. The plain grid matches only T, R: for R, T it
 * puts X between A and B, because mermaid ranks T beside X though no edge
 * pushes it down, and `computeMinLevels` has no rule that says so (#2802).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { registerAsciiLayout } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidASCII } from '../index.ts'
import { renderMermaidSVG } from '../../../svg-renderer/src/index.ts'
import { asciiLayoutProvider } from '../../../../src/ascii-layout-provider.ts'

const src = (first: string, second: string): string => `flowchart TD
  ${first}
  ${second}
  subgraph S
    A --> B
  end
  R --> X
  T --> A
  X --> B
  S --> X`

const RT = src('R', 'T')
const TR = src('T', 'R')

const draw = (s: string, hints: boolean): string => {
  registerAsciiLayout(hints ? asciiLayoutProvider : undefined)
  return renderMermaidASCII(s, { colorMode: 'none' })
}
afterEach(() => registerAsciiLayout(undefined))

// Row of the box line that carries the label.
const rowOf = (out: string, label: string): number =>
  out.split('\n').findIndex((l) => new RegExp(`│\\s+${label}\\s+│`).test(l))

const xBesideTAboveA = (out: string): void => {
  const [x, t, a] = ['X', 'T', 'A'].map((l) => rowOf(out, l)) as number[]
  expect(x).toBeGreaterThanOrEqual(0)
  expect(x).toBe(t)
  expect(x).toBeLessThan(a!)
}
const xBelowB = (out: string): void => {
  expect(rowOf(out, 'B')).toBeGreaterThan(0)
  expect(rowOf(out, 'X')).toBeGreaterThan(rowOf(out, 'B'))
}

describe('cluster-boundary cycle ranks as mermaid@12.3.0 (#2802)', () => {
  it('R, T with ELK hints: X beside T, above A', () => {
    xBesideTAboveA(draw(RT, true))
  })
  it('T, R with ELK hints: X below B', () => {
    xBelowB(draw(TR, true))
  })
  it('T, R on the grid: X below B', () => {
    xBelowB(draw(TR, false))
  })
  // Known gap (#2802): flips to a failure the day the grid matches; then use `it`.
  it.fails('R, T on the grid: X beside T, above A', () => {
    xBesideTAboveA(draw(RT, false))
  })

  it.each([
    ['R, T', RT],
    ['T, R', TR],
  ])('snapshots SVG and ASCII (grid and ELK hints) for %s', (_n, s) => {
    expect(renderMermaidSVG(s)).toMatchSnapshot('svg')
    expect(draw(s, false)).toMatchSnapshot('ascii-grid')
    expect(draw(s, true)).toMatchSnapshot('ascii-hints')
  })
})
